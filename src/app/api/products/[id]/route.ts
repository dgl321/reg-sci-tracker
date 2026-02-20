import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { Product, CountryUse, SectionAssessment } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

function buildProduct(id: string): Product | null {
  const db = getDb();

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Record<string, string> | undefined;
  if (!row) return null;

  const assessments = db
    .prepare("SELECT * FROM assessments WHERE product_id = ?")
    .all(id) as Record<string, string>[];

  const uses = db
    .prepare("SELECT * FROM gap_uses WHERE product_id = ? ORDER BY country_code, id")
    .all(id) as Record<string, string>[];

  const countriesMap = new Map<string, CountryUse>();
  for (const u of uses) {
    if (!countriesMap.has(u.country_code)) {
      countriesMap.set(u.country_code, { countryCode: u.country_code, uses: [] });
    }
    countriesMap.get(u.country_code)!.uses.push({
      id: u.id,
      description: u.description,
      ...(u.notes ? { notes: u.notes } : {}),
    });
  }

  return {
    id: row.id,
    activeSubstance: row.active_substance,
    productName: row.product_name,
    type: row.type as Product["type"],
    projectOwner: row.project_owner,
    submissionType: row.submission_type as Product["submissionType"],
    status: row.status,
    targetSubmissionDate: row.target_submission_date ?? undefined,
    dataResponsibility: row.data_responsibility,
    euApprovalStatus: row.eu_approval_status as Product["euApprovalStatus"],
    euExpiryDate: row.eu_expiry_date ?? undefined,
    conclusion: row.conclusion ?? undefined,
    countries: Array.from(countriesMap.values()),
    assessments: assessments.map((a) => ({
      sectionId: a.section_id,
      riskLevel: a.risk_level as SectionAssessment["riskLevel"],
      summary: a.summary,
      assessor: a.assessor ?? undefined,
      lastUpdated: a.last_updated ?? undefined,
      details: a.details ? JSON.parse(a.details) : undefined,
      useOutcomes: a.use_outcomes ? JSON.parse(a.use_outcomes) : undefined,
    })),
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const product = buildProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  db.prepare(`
    UPDATE products SET
      active_substance = @active_substance,
      product_name = @product_name,
      type = @type,
      project_owner = @project_owner,
      submission_type = @submission_type,
      status = @status,
      target_submission_date = @target_submission_date,
      data_responsibility = @data_responsibility,
      eu_approval_status = @eu_approval_status,
      eu_expiry_date = @eu_expiry_date,
      conclusion = @conclusion
    WHERE id = @id
  `).run({
    id,
    active_substance: body.activeSubstance,
    product_name: body.productName,
    type: body.type,
    project_owner: body.projectOwner,
    submission_type: body.submissionType,
    status: body.status,
    target_submission_date: body.targetSubmissionDate ?? null,
    data_responsibility: body.dataResponsibility,
    eu_approval_status: body.euApprovalStatus,
    eu_expiry_date: body.euExpiryDate ?? null,
    conclusion: body.conclusion ?? null,
  });

  return NextResponse.json(buildProduct(id));
}

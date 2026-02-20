import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { Product, CountryUse, SectionAssessment } from "@/lib/types";

export function GET() {
  const db = getDb();

  const rows = db.prepare("SELECT * FROM products ORDER BY product_name").all() as Record<string, string>[];

  const products: Product[] = rows.map((row) => {
    const assessments = db
      .prepare("SELECT * FROM assessments WHERE product_id = ?")
      .all(row.id) as Record<string, string>[];

    const uses = db
      .prepare("SELECT * FROM gap_uses WHERE product_id = ? ORDER BY country_code, id")
      .all(row.id) as Record<string, string>[];

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

    // Preserve country order from the original product (countries with no uses won't appear in gap_uses)
    // so we query distinct country codes from a separate source — gap_uses only has countries with uses.
    // Countries with empty uses[] were stored with no rows. We need to track them separately.
    // For now, build from gap_uses and accept that empty-use countries will be missing until
    // countries are updated via the PUT /countries route which will handle them explicitly.
    const countries = Array.from(countriesMap.values());

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
      countries,
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
  });

  return NextResponse.json(products);
}

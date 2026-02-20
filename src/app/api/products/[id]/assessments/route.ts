import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  db.prepare(`
    INSERT INTO assessments (product_id, section_id, risk_level, summary, assessor, last_updated, details, use_outcomes)
    VALUES (@product_id, @section_id, @risk_level, @summary, @assessor, @last_updated, @details, @use_outcomes)
    ON CONFLICT (product_id, section_id) DO UPDATE SET
      risk_level   = excluded.risk_level,
      summary      = excluded.summary,
      assessor     = excluded.assessor,
      last_updated = excluded.last_updated,
      details      = excluded.details,
      use_outcomes = excluded.use_outcomes
  `).run({
    product_id: id,
    section_id: body.sectionId,
    risk_level: body.riskLevel,
    summary: body.summary ?? "",
    assessor: body.assessor ?? null,
    last_updated: body.lastUpdated ?? null,
    details: body.details ? JSON.stringify(body.details) : null,
    use_outcomes: body.useOutcomes ? JSON.stringify(body.useOutcomes) : null,
  });

  return NextResponse.json({ ok: true });
}

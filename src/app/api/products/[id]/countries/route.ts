import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { CountryUse } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const countries: CountryUse[] = await req.json();

  const deleteUses = db.prepare("DELETE FROM gap_uses WHERE product_id = ?");
  const insertUse = db.prepare(`
    INSERT INTO gap_uses (id, product_id, country_code, description, notes)
    VALUES (@id, @product_id, @country_code, @description, @notes)
  `);

  const replace = db.transaction(() => {
    deleteUses.run(id);
    for (const country of countries) {
      for (const use of country.uses) {
        insertUse.run({
          id: use.id,
          product_id: id,
          country_code: country.countryCode,
          description: use.description,
          notes: use.notes ?? null,
        });
      }
    }
  });

  replace();
  return NextResponse.json({ ok: true });
}

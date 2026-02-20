"""
Import FOCUS SW scenario characteristics and crop × scenario irrigation from JSON.

Populates:
  - focus_sw_scenario_characteristics (weather/location/climate per D1–D6, R1–R4)
  - focus_crop_scenario_irrigation (average irrigation mm/year per crop × scenario)

Source: Generic FOCUS SWS v1.4 (May 2015). Run after focus_scenarios and focus_crops
(and optionally focus_crop_scenario_links) are populated.

Usage:
  python import_focus_sw_characteristics.py --db crop_db.sqlite
  python import_focus_sw_characteristics.py --db crop_db.sqlite --apply
"""

import argparse
import json
import os
import sqlite3
import sys

DEFAULT_CHAR_JSON = "FOCUS_SW_Scenario_Characteristics.json"
DEFAULT_IRR_JSON = "FOCUS_SW_Crop_Scenario_Irrigation.json"
SOURCE_REF = "Generic FOCUS SWS v1.4 May 2015"


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def import_characteristics(json_path, db_path, dry_run):
    data = load_json(json_path)
    scenarios = data.get("scenarios") or data.get("items") or []
    if not scenarios:
        sys.exit(f"No 'scenarios' or 'items' array in {json_path}")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    updated = 0
    for s in scenarios:
        code = (s.get("scenario_code") or "").strip()
        if not code:
            continue
        cur.execute("SELECT scenario_id FROM focus_scenarios WHERE scenario_code = ? AND scenario_type_id = 1", (code,))
        row = cur.fetchone()
        if not row:
            print(f"  Skip scenario {code}: not found in focus_scenarios (surface water)")
            continue
        scenario_id = row[0]
        lat = s.get("latitude_deg")
        lon = s.get("longitude_deg")
        updated += 1
        if not dry_run:
            cur.execute("""
                INSERT OR REPLACE INTO focus_sw_scenario_characteristics
                    (scenario_id, scenario_code, weather_dataset_name, latitude_deg, longitude_deg,
                     mean_annual_temp_c, annual_rainfall_mm, topsoil_texture, topsoil_organic_carbon_pct,
                     slope_pct, water_bodies, source_reference)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                scenario_id,
                code,
                (s.get("weather_dataset_name") or "").strip(),
                float(lat) if lat is not None else None,
                float(lon) if lon is not None else None,
                float(s["mean_annual_temp_c"]) if s.get("mean_annual_temp_c") is not None else None,
                float(s["annual_rainfall_mm"]) if s.get("annual_rainfall_mm") is not None else None,
                (s.get("topsoil_texture") or "").strip() or None,
                float(s["topsoil_organic_carbon_pct"]) if s.get("topsoil_organic_carbon_pct") is not None else None,
                (s.get("slope_pct") or "").strip() or None,
                (s.get("water_bodies") or "").strip() or None,
                SOURCE_REF,
            ))
    print(f"focus_sw_scenario_characteristics: {updated} rows {'would be ' if dry_run else ''}upserted")
    if not dry_run:
        conn.commit()
    conn.close()


def import_irrigation(json_path, db_path, dry_run):
    data = load_json(json_path)
    rows = data.get("irrigation") or data.get("items") or []
    if not rows:
        sys.exit(f"No 'irrigation' or 'items' array in {json_path}")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    inserted = 0
    skipped = []
    for r in rows:
        code = (r.get("scenario_code") or "").strip()
        crop = (r.get("crop") or "").strip()
        mm = r.get("irrigation_mm_annual")
        if not code or not crop or mm is None:
            continue
        cur.execute("SELECT scenario_id FROM focus_scenarios WHERE scenario_code = ? AND scenario_type_id = 1", (code,))
        sc = cur.fetchone()
        cur.execute("SELECT focus_crop_id FROM focus_crops WHERE swash_crop_name = ?", (crop,))
        fc = cur.fetchone()
        if not sc or not fc:
            skipped.append((code, crop))
            continue
        inserted += 1
        if not dry_run:
            cur.execute("""
                INSERT OR REPLACE INTO focus_crop_scenario_irrigation
                    (focus_crop_id, scenario_id, irrigation_mm_annual, source_reference)
                VALUES (?, ?, ?, ?)
            """, (fc[0], sc[0], float(mm), SOURCE_REF))
    print(f"focus_crop_scenario_irrigation: {inserted} rows {'would be ' if dry_run else ''}upserted")
    if skipped:
        print(f"  Skipped {len(skipped)} (scenario or crop not found): e.g. {skipped[:5]}")
    if not dry_run:
        conn.commit()
    conn.close()


def main():
    p = argparse.ArgumentParser(description="Import FOCUS SW scenario characteristics and irrigation from JSON")
    p.add_argument("--db", default="crop_db.sqlite", help="Path to SQLite DB")
    p.add_argument("--char-json", default=DEFAULT_CHAR_JSON, help="Scenario characteristics JSON")
    p.add_argument("--irr-json", default=DEFAULT_IRR_JSON, help="Crop-scenario irrigation JSON")
    p.add_argument("--apply", action="store_true", help="Write to DB (default: dry run)")
    args = p.parse_args()

    if not os.path.exists(args.db):
        sys.exit(f"Database not found: {args.db}")

    dry_run = not args.apply
    if dry_run:
        print("(Dry run — pass --apply to write to DB)\n")

    if os.path.exists(args.char_json):
        import_characteristics(args.char_json, args.db, dry_run)
    else:
        print(f"Skip characteristics: {args.char_json} not found")

    if os.path.exists(args.irr_json):
        import_irrigation(args.irr_json, args.db, dry_run)
    else:
        print(f"Skip irrigation: {args.irr_json} not found")

    if dry_run:
        print("\n(Dry run — pass --apply to write to DB)")


if __name__ == "__main__":
    main()

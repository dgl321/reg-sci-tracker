"""
Import FOCUS SW crop × scenario links from FOCUS_SW_Crop_Scenario_Links.json.

Use this when you don't have the SWASH .mdb (e.g. no Windows/Access).
The JSON should match the crop–scenario matrix from the SWASH GUI;
crop names must match focus_crops.swash_crop_name.

Usage:
    python import_swash_json.py --json FOCUS_SW_Crop_Scenario_Links.json --db crop_db.sqlite
    python import_swash_json.py --json FOCUS_SW_Crop_Scenario_Links.json --db crop_db.sqlite --apply
"""

import argparse
import json
import sqlite3
import sys


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def import_links(json_path, db_path, dry_run=True):
    data = load_json(json_path)
    items = data.get("crop_scenarios") or data.get("items")
    if not items:
        sys.exit("JSON must contain 'crop_scenarios' or 'items' array with {crop, scenarios}.")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    inserted = 0
    skipped = []
    for row in items:
        crop_name = (row.get("crop") or "").strip()
        scenarios = row.get("scenarios")
        if not crop_name or not scenarios:
            continue
        if isinstance(scenarios, str):
            scenarios = [s.strip() for s in scenarios.split(",") if s.strip()]

        cur.execute("SELECT focus_crop_id FROM focus_crops WHERE swash_crop_name = ?", (crop_name,))
        fc = cur.fetchone()
        if not fc:
            skipped.append((crop_name, None))
            continue

        focus_crop_id = fc[0]
        for scen_code in scenarios:
            cur.execute("SELECT scenario_id FROM focus_scenarios WHERE scenario_code = ?", (scen_code.strip(),))
            sc = cur.fetchone()
            if not sc:
                skipped.append((crop_name, scen_code))
                continue
            inserted += 1
            if not dry_run:
                cur.execute("""
                    INSERT OR IGNORE INTO focus_crop_scenario_links
                        (focus_crop_id, scenario_id, waterbody_type, is_default_run)
                    VALUES (?, ?, NULL, 1)
                """, (focus_crop_id, sc[0]))

    print(f"focus_crop_scenario_links: {inserted} rows inserted (dry_run={dry_run})")
    if skipped:
        print(f"Skipped {len(skipped)} crop/scenario lookups:")
        for c, s in skipped[:20]:
            print(f"  - {c!r} / {s!r}")
        if len(skipped) > 20:
            print(f"  ... and {len(skipped) - 20} more")

    if not dry_run:
        conn.commit()
        print("Changes committed.")
    else:
        print("(Dry run — pass --apply to write to DB)")
    conn.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Import FOCUS SW crop-scenario links from JSON")
    p.add_argument("--json", default="FOCUS_SW_Crop_Scenario_Links.json", help="Path to JSON file")
    p.add_argument("--db", default="crop_db.sqlite", help="Path to SQLite DB")
    p.add_argument("--apply", action="store_true", help="Write to DB (default: dry run)")
    args = p.parse_args()
    import_links(args.json, args.db, dry_run=not args.apply)

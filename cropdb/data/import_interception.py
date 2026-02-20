"""
EFSA 2020 Repair Action — crop interception seed data helper.

Source: EFSA Panel on PPR (2020). EFSA Journal 2020;18(8):6119.
        doi:10.2903/j.efsa.2020.6119  [open access]
        Table 7: Crop interception values by BBCH stage.

This script provides the data structure and import logic.
You MUST read the actual values from Table 7 of the EFSA paper before
running with --apply. The table below has been left as STUBS with the
BBCH stage breakpoints marked — fill in the pct values from the paper.

The table uses a step-function: one interception % applies across a
range of BBCH stages. Column headers in Table 7 are approximate BBCH
ranges, rows are FOCUS crop categories.

Usage:
    1. Download EFSA 2020:6119 from doi:10.2903/j.efsa.2020.6119
    2. Open Table 7 (typically around page 50-60)
    3. Fill in the INTERCEPTION_DATA dict below
    4. python import_interception.py --db crop_db.sqlite --apply

Table 7 structure (BBCH breakpoints — verify these in the paper):
    Crops typically have values at BBCH: 0, 10, 20, 30, 40, 50, 60, 70, 80, 90
    Interception % is given for each stage band.
"""

import argparse, sqlite3

# =============================================================================
# FILL THIS IN FROM EFSA 2020:6119 TABLE 7
# Format: swash_crop_name -> list of (bbch_stage, interception_pct, source_label)
# Leave pct as None to skip (stub).
# =============================================================================
INTERCEPTION_DATA = {

    # Annual arable crops — interception increases with canopy development
    # then drops post-harvest
    "Winter cereals": [
        # (bbch_stage, pct, source)
        # Read from Table 7 of EFSA 2020:6119
        # Typical pattern: low at emergence, peak ~BBCH 30-69, low again post-maturity
        (0,   None, "EFSA 2020 Repair Action Table 7 — STUB: fill from paper"),
        (10,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (20,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (30,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (40,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (50,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (60,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (70,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (80,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (90,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
    ],

    "Spring cereals": [
        (0,   None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (10,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (20,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (30,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (40,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (50,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (60,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (70,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (80,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (90,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
    ],

    "Maize": [
        (0,   None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (10,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (20,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (30,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (40,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (50,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (60,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (70,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (80,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (90,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
    ],

    "Winter oilseed rape": [
        (0,   None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (10,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (20,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (30,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (40,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (50,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (60,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (70,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (80,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (90,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
    ],

    "Potatoes": [
        (0,   None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (10,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (20,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (30,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (40,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (50,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (60,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (70,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (80,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (90,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
    ],

    "Sugar beet": [
        (0,   None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (10,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (20,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (30,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (40,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (50,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (60,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (70,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (80,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (90,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
    ],

    # Permanent crops
    "Apples and pears": [
        (0,   None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (51,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (60,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (71,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (81,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (91,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
    ],

    "Vines": [
        (0,   None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (51,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (60,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (71,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (81,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
        (91,  None, "EFSA 2020 Repair Action Table 7 — STUB"),
    ],

    # Grass (fixed canopy — interception does not vary by BBCH in same way)
    "Grass": [
        (0, None, "EFSA 2020 Repair Action Table 7 — STUB"),
    ],
}


def import_interception(db_path, dry_run=True):
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cur  = conn.cursor()

    inserted, stubbed, skipped = 0, 0, 0

    for crop_name, stages in INTERCEPTION_DATA.items():
        cur.execute("SELECT focus_crop_id FROM focus_crops WHERE swash_crop_name = ?", (crop_name,))
        fc = cur.fetchone()
        if not fc:
            print(f"  WARNING: '{crop_name}' not found in focus_crops — skipping")
            skipped += 1
            continue

        fid = fc[0]
        for (bbch, pct, source) in stages:
            if pct is None:
                stubbed += 1
                continue   # Skip stubs
            if not dry_run:
                cur.execute("""
                    INSERT OR REPLACE INTO focus_crop_interception
                        (focus_crop_id, bbch_stage, interception_pct, interception_source)
                    VALUES (?, ?, ?, ?)
                """, (fid, bbch, pct, source))
                inserted += 1

    if not dry_run:
        conn.commit()
    conn.close()

    print(f"Interception values: {inserted} inserted, {stubbed} stubs skipped, {skipped} crops not found")
    if dry_run:
        print("(Dry run — pass --apply to write)")
    if stubbed > 0:
        print(f"\n*** {stubbed} values still marked STUB ***")
        print("Open this script and fill in INTERCEPTION_DATA from EFSA 2020:6119 Table 7.")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--db",    default="crop_db.sqlite")
    p.add_argument("--apply", action="store_true")
    args = p.parse_args()
    import_interception(args.db, dry_run=not args.apply)

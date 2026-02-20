"""
SWASH .mdb importer — populates focus_crop_scenario_links and
updates focus_crops BBCH/canopy parameters from the SWASH Access database.

The SWASH installer (typically C:\\SWASH\\Database\\swash.mdb on Windows)
contains the authoritative crop-scenario valid combinations used by the wizard.

Requirements (choose one):
  Option A — Windows with Access driver:
      pip install pyodbc
      Driver: 'Microsoft Access Driver (*.mdb, *.accdb)'

  Option B — Linux/Mac:
      pip install meza           # reads .mdb via mdbtools
      OR: export SWASH tables to CSV via mdb-export (mdbtools package)
          mdb-export swash.mdb Crop > crop.csv
          mdb-export swash.mdb CropScenario > cropscenario.csv
      then pass --csv-dir to this script

Usage:
    python import_swash_mdb.py --mdb "C:/SWASH/Database/swash.mdb" --db crop_db.sqlite
    python import_swash_mdb.py --csv-dir ./swash_exports/ --db crop_db.sqlite

NOTE: SWASH table names and column names vary by version.
      Verified against SWASH v5.3. Adjust TABLE_* constants if needed.
"""

import argparse, csv, os, sqlite3, sys

# ---- Adjust these if your SWASH version uses different names ----
TABLE_CROP          = "Crop"          # SWASH crop definition table
TABLE_CROP_SCENARIO = "CropScenario"  # Valid crop x scenario combinations
TABLE_SCENARIO      = "Scenario"      # Scenario definitions

# Column name mappings (SWASH v5.3)
SWASH_CROP_COLS = {
    "name":         "CropName",        # Matches focus_crops.swash_crop_name
    "code":         "CropCode",
    "bbch_em_min":  "BBCHemergenceMin",
    "bbch_em_max":  "BBCHemergenceMax",
    "bbch_har_min": "BBCHharvestMin",
    "bbch_har_max": "BBCHharvestMax",
    "canopy":       "CanopyType",
    "root_depth":   "RootDepth",
    "lai":          "LAImax",
}

SWASH_CS_COLS = {
    "crop_name":    "CropName",
    "scenario":     "ScenarioCode",
    "waterbody":    "WaterbodyType",
    "is_default":   "IsDefault",
}


def load_csv(path):
    with open(path, newline='', encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


def import_from_csv(csv_dir, db_path, dry_run=True):
    crop_csv = os.path.join(csv_dir, "crop.csv")
    cs_csv   = os.path.join(csv_dir, "cropscenario.csv")

    if not os.path.exists(crop_csv):
        sys.exit(f"Not found: {crop_csv}\nExport with: mdb-export swash.mdb Crop > crop.csv")
    if not os.path.exists(cs_csv):
        sys.exit(f"Not found: {cs_csv}\nExport with: mdb-export swash.mdb CropScenario > cropscenario.csv")

    crops    = load_csv(crop_csv)
    cs_rows  = load_csv(cs_csv)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    cur  = conn.cursor()

    print(f"Loaded {len(crops)} SWASH crop rows, {len(cs_rows)} crop-scenario rows")

    # --- Update focus_crops parameters ---
    updated_crops = 0
    skipped_crops = []
    for row in crops:
        name = row.get(SWASH_CROP_COLS["name"], "").strip()
        if not name:
            continue

        cur.execute("SELECT focus_crop_id FROM focus_crops WHERE swash_crop_name = ?", (name,))
        fc = cur.fetchone()
        if not fc:
            skipped_crops.append(name)
            continue

        fid = fc[0]
        updates = {}

        def col(key):
            return row.get(SWASH_CROP_COLS.get(key, ""), "").strip()

        if col("bbch_em_min"):  updates["bbch_sowing_min"]  = int(col("bbch_em_min"))
        if col("bbch_em_max"):  updates["bbch_sowing_max"]  = int(col("bbch_em_max"))
        if col("bbch_har_min"): updates["bbch_harvest_min"] = int(col("bbch_har_min"))
        if col("bbch_har_max"): updates["bbch_harvest_max"] = int(col("bbch_har_max"))
        if col("canopy"):       updates["canopy_type"]      = col("canopy")
        if col("root_depth"):   updates["root_depth_m"]     = float(col("root_depth"))
        if col("lai"):          updates["lai_max"]           = float(col("lai"))

        if updates and not dry_run:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            cur.execute(
                f"UPDATE focus_crops SET {set_clause} WHERE focus_crop_id = ?",
                list(updates.values()) + [fid]
            )
            updated_crops += 1

    print(f"  focus_crops: {updated_crops} rows updated, {len(skipped_crops)} SWASH crops not matched:")
    for n in skipped_crops:
        print(f"    - '{n}'  (add to focus_crops or update SWASH_CROP_COLS mapping)")

    # --- Insert focus_crop_scenario_links ---
    inserted = 0
    skipped  = []
    for row in cs_rows:
        crop_name   = row.get(SWASH_CS_COLS["crop_name"], "").strip()
        scen_code   = row.get(SWASH_CS_COLS["scenario"], "").strip()
        waterbody   = row.get(SWASH_CS_COLS["waterbody"], "").strip()
        is_default  = int(row.get(SWASH_CS_COLS["is_default"], "1") or 1)

        cur.execute("SELECT focus_crop_id FROM focus_crops WHERE swash_crop_name = ?", (crop_name,))
        fc = cur.fetchone()
        cur.execute("SELECT scenario_id FROM focus_scenarios WHERE scenario_code = ?", (scen_code,))
        sc = cur.fetchone()

        if not fc or not sc:
            skipped.append((crop_name, scen_code))
            continue

        if not dry_run:
            cur.execute("""
                INSERT OR IGNORE INTO focus_crop_scenario_links
                    (focus_crop_id, scenario_id, waterbody_type, is_default_run)
                VALUES (?, ?, ?, ?)
            """, (fc[0], sc[0], waterbody, is_default))
            inserted += 1

    print(f"  focus_crop_scenario_links: {inserted} rows inserted, {len(skipped)} skipped")

    if not dry_run:
        conn.commit()
        print("Changes committed.")
    else:
        print("\n(Dry run — pass --apply to write to DB)")
    conn.close()


def import_from_mdb(mdb_path, db_path, dry_run=True):
    try:
        import pyodbc
    except ImportError:
        sys.exit("pyodbc not installed. Run: pip install pyodbc")

    conn_str = (
        r"Driver={Microsoft Access Driver (*.mdb, *.accdb)};"
        rf"Dbq={mdb_path};"
    )
    try:
        mdb_conn = pyodbc.connect(conn_str)
    except Exception as e:
        sys.exit(f"Could not open SWASH MDB: {e}\nCheck the Access driver is installed.")

    mdb_cur = mdb_conn.cursor()

    # Export to temp CSVs then reuse CSV import path
    import tempfile
    tmp = tempfile.mkdtemp()

    for (table, out_name) in [(TABLE_CROP, "crop.csv"), (TABLE_CROP_SCENARIO, "cropscenario.csv")]:
        mdb_cur.execute(f"SELECT * FROM [{table}]")
        cols    = [d[0] for d in mdb_cur.description]
        rows    = mdb_cur.fetchall()
        out_path = os.path.join(tmp, out_name)
        with open(out_path, 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            w.writerow(cols)
            w.writerows(rows)
        print(f"Exported {len(rows)} rows from {table} -> {out_path}")

    mdb_conn.close()
    import_from_csv(tmp, db_path, dry_run)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Import SWASH data into crop DB")
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--mdb",     help="Path to swash.mdb (Windows + pyodbc)")
    src.add_argument("--csv-dir", help="Directory containing exported CSV files")
    p.add_argument("--db",    default="crop_db.sqlite")
    p.add_argument("--apply", action="store_true", help="Write to DB (default: dry run)")
    args = p.parse_args()

    if args.mdb:
        import_from_mdb(args.mdb, args.db, dry_run=not args.apply)
    else:
        import_from_csv(args.csv_dir, args.db, dry_run=not args.apply)

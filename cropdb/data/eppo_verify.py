"""
EPPO code verifier and enricher.
Reads existing eppo_codes from the SQLite DB, queries the EPPO REST API
for each code, and reports mismatches / missing codes.

Usage:
    1. Get a free API token at https://gd.eppo.int/user/register
    2. pip install requests
    3. python eppo_verify.py --token bef60e564c9244e9bf3a5ca13730f8e0 --db crop_db.sqlite

API docs: https://gd.eppo.int/api

Endpoints used:
    GET /taxon/{eppocode}         -> taxon details (name, taxonomy)
    GET /taxon/{eppocode}/names   -> all accepted names and synonyms
"""

import argparse, json, sqlite3, time
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

EPPO_API_BASE = "https://data.eppo.int/api/rest/1.0"

def get_taxon(session, token, code):
    """Fetch taxon details for a single EPPO code."""
    url = f"{EPPO_API_BASE}/taxon/{code}"
    r = session.get(url, params={"authtoken": token}, timeout=10)
    r.raise_for_status()
    return r.json()

def get_names(session, token, code):
    """Fetch all names (preferred + synonyms) for an EPPO code."""
    url = f"{EPPO_API_BASE}/taxon/{code}/names"
    r = session.get(url, params={"authtoken": token}, timeout=10)
    r.raise_for_status()
    return r.json()

def verify_codes(db_path, token, dry_run=True):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("""
        SELECT e.eppo_code_id, e.eppo_code, e.eppo_name, e.taxon_level,
               c.common_name_en, c.scientific_name
        FROM eppo_codes e
        JOIN crops c ON e.crop_id = c.crop_id
        ORDER BY e.eppo_code
    """)
    rows = cur.fetchall()

    if not HAS_REQUESTS:
        print("requests library not installed. Run: pip install requests")
        return

    session = requests.Session()
    issues = []
    updates = []

    for row in rows:
        code = row["eppo_code"]
        print(f"Checking {code} ({row['common_name_en']})...", end=" ", flush=True)
        try:
            taxon = get_taxon(session, token, code)
            names = get_names(session, token, code)

            # Find the preferred English name from API
            api_pref_name = None
            for n in names:
                if n.get("langiso") == "en" and n.get("preferred") == 1:
                    api_pref_name = n.get("fullname")
                    break

            api_sci_name = taxon.get("fullname", "")
            db_name = row["eppo_name"]

            status = "OK"
            if api_pref_name and api_pref_name.lower() != db_name.lower():
                status = f"NAME MISMATCH: DB='{db_name}' API='{api_pref_name}'"
                issues.append((code, status))
                updates.append((api_pref_name, api_sci_name, row["eppo_code_id"]))

            print(status)
            time.sleep(0.3)   # Be polite to the API

        except Exception as e:
            print(f"ERROR: {e}")
            issues.append((code, str(e)))

    print(f"\n--- Summary: {len(issues)} issues found ---")
    for code, msg in issues:
        print(f"  {code}: {msg}")

    if updates and not dry_run:
        print("\nApplying name corrections to DB...")
        for (new_name, new_sci, eppo_id) in updates:
            cur.execute(
                "UPDATE eppo_codes SET eppo_name = ? WHERE eppo_code_id = ?",
                (new_name, eppo_id)
            )
            # Also update scientific name on crops table if better data available
            if new_sci:
                cur.execute("""
                    UPDATE crops SET scientific_name = ?
                    WHERE crop_id = (
                        SELECT crop_id FROM eppo_codes WHERE eppo_code_id = ?
                    ) AND (scientific_name IS NULL OR scientific_name = '')
                """, (new_sci, eppo_id))
        conn.commit()
        print("Done.")
    elif updates:
        print("\n(Dry run — pass --apply to write corrections to DB)")

    conn.close()

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Verify EPPO codes against gd.eppo.int API")
    p.add_argument("--token",  required=True, help="EPPO API token")
    p.add_argument("--db",     default="crop_db.sqlite", help="Path to SQLite database")
    p.add_argument("--apply",  action="store_true", help="Write corrections to DB (default: dry run)")
    args = p.parse_args()
    verify_codes(args.db, args.token, dry_run=not args.apply)

# Crop DB — Data Population Guide

## Status at initial seed

| Table | Status | Source needed |
|---|---|---|
| `annuality_types` | ✅ Complete | — |
| `crop_types` | ✅ Complete | — |
| `plant_families` | ✅ Complete | — |
| `crops` (31 rows) | ✅ Core FOCUS crops seeded | Add more from PRIMo list |
| `eppo_codes` (31 rows) | ✅ Seeded — MEDIUM confidence | Verify with EPPO API |
| `focus_crops` (22 rows) | ✅ Seeded — names/canopy HIGH | BBCH/root/LAI: MEDIUM |
| `focus_scenarios` (19 rows) | ✅ Complete | — |
| `data_sources` (11 rows) | ✅ Complete | — |
| `focus_crop_interception` | ❌ Empty stub | EFSA 2020:6119 Table 7 |
| `focus_crop_scenario_links` | ❌ Empty stub | SWASH v5.3 .mdb file |
| `focus_crop_reg396_mappings` | ❌ Empty | After reg396 is populated |
| `reg396_commodities` | ❌ Empty | PRIMo Rev 3.1 Excel |
| `primo_commodities` | ❌ Empty | PRIMo Rev 3.1 Excel |
| `codex_commodities` | ❌ Empty | FAO CAC/MISC 4 |
| `ecotox_bee_attributes` | ❌ Empty | EFSA Bee Guidance 2013 |
| `ecotox_bm_attributes` | ❌ Empty | EFSA B&M Guidance 2009 |

---

## Step-by-step population order

### Step 1 — Verify EPPO codes  *(~10 min, automated)*

Register for a free API token at https://gd.eppo.int/user/register then run:

```bash
pip install requests
python eppo_verify.py --token YOUR_TOKEN --db crop_db.sqlite
# Review output, then apply corrections:
python eppo_verify.py --token YOUR_TOKEN --db crop_db.sqlite --apply
```

Codes flagged [MEDIUM] in the seed data that you should check first:
- Triticale (`TTLXX`)
- Tomato (`LYPES` — may now be `SOLLY` after reclassification)
- Peach (`PRNPE`)
- Pear (`PYUCO`)
- Orange (`CIDSI` — may be `CITSI`)
- Sweet cherry (`PRNAV`)
- Banana (`MUBAP`)

---

### Step 2 — Import Reg 396/2005 Annex I + PRIMo  *(~20 min)*

1. Download PRIMo Rev 3.1 from:
   https://www.efsa.europa.eu/en/applications/pesticides/tools
   (look for 'Pesticide Residue Intake Model', download the .xlsx)

2. Open the file and verify the sheet and column layout against the
   constants at the top of `import_primo.py`. Adjust if needed.

3. Run a preview first:
   ```bash
   pip install openpyxl
   python import_primo.py --xlsx "PRIMo_Rev3.1.xlsx" --db crop_db.sqlite
   ```

4. If the preview looks correct, apply:
   ```bash
   python import_primo.py --xlsx "PRIMo_Rev3.1.xlsx" --db crop_db.sqlite --apply
   ```

5. This will insert ~450 rows into `reg396_commodities` and `primo_commodities`,
   all initially linked to a placeholder `crop_id`. After import, run the
   EPPO-based matching script (Step 1 must be complete) to link them to
   real crop rows.

---

### Step 3 — Import SWASH crop-scenario links  *(~15 min)*

You need the SWASH installation on Windows. The .mdb file is typically at:
`C:\SWASH\Database\swash.mdb`

**Option A — Windows (pyodbc):**
```bash
pip install pyodbc
python import_swash_mdb.py --mdb "C:/SWASH/Database/swash.mdb" --db crop_db.sqlite
python import_swash_mdb.py --mdb "C:/SWASH/Database/swash.mdb" --db crop_db.sqlite --apply
```

**Option B — Linux/Mac (mdbtools):**
```bash
# Install mdbtools (Ubuntu: apt install mdbtools, Mac: brew install mdbtools)
mdb-export swash.mdb Crop > swash_exports/crop.csv
mdb-export swash.mdb CropScenario > swash_exports/cropscenario.csv
python import_swash_mdb.py --csv-dir ./swash_exports/ --db crop_db.sqlite --apply
```

After import, check for any SWASH crop names that did not match to a
`focus_crops` row (the script reports these). They indicate either:
- A crop in SWASH not yet in your `focus_crops` table (add it)
- A naming difference between SWASH versions (update `SWASH_CROP_COLS` mapping)

---

### Step 4 — EFSA 2020 interception values  *(~30 min, manual)*

1. Download the paper (open access):
   https://doi.org/10.2903/j.efsa.2020.6119

2. Navigate to Table 7 (approximately page 50-60 of the PDF).

3. Open `import_interception.py` and fill in the `INTERCEPTION_DATA` dict.
   Each crop has a list of `(bbch_stage, interception_pct, source_label)` tuples.
   Replace `None` with the actual % values from the table.

4. Apply:
   ```bash
   python import_interception.py --db crop_db.sqlite --apply
   ```

Note: Table 7 uses broad BBCH bands (e.g. BBCH 0-9, 10-19, ...). Store the
lower bound of each band as the `bbch_stage` value; when querying, find the
highest `bbch_stage <= actual_application_bbch` to get the right interception.

---

### Step 5 — FOCUS crop × Reg 396 granularity mappings

Once both `focus_crops` and `reg396_commodities` are populated,
populate `focus_crop_reg396_mappings`. The key mappings are:

| FOCUS crop | Reg 396 commodities |
|---|---|
| Winter cereals | Wheat, barley, rye, triticale, winter oats |
| Spring cereals | Spring barley, spring wheat, oats |
| Field beans and peas | Peas (dried), beans (dried) |
| Apples and pears | Apple, pear, quince |
| Stone fruit | Peach, nectarine, cherry, plum, apricot |
| Citrus | Orange, grapefruit, mandarin, lemon, lime |
| Grass | Fodder grass (no direct food commodity) |

These can be entered manually as SQL INSERTs once Annex I codes are loaded,
or scripted against the Annex I hierarchy once `reg396_commodities` is populated.

---

### Optional — Ecotox attributes

These are relatively small tables that are best populated manually from the
guidance documents. Each crop gets one row per attribute table.

**Bee attributes** (EFSA Bee Guidance 2013, Appendix A):
- Relevant crops: OSR, sunflower, apple, pear, cherry, strawberry, oilseed crops
- Key fields: `is_flowering_crop`, `bee_attractive`, `bee_guidance_tier`

**Birds & mammals** (EFSA 2009, Tables 3.1–3.4):
- All crops get a row; field `food_item_*` flags drive the dietary fraction lookup
- Cereals: grain + invertebrate; permanent crops: fruit + invertebrate; grass: green plant

**Aquatic ERA** (derives largely from FOCUS crop-scenario links):
- `primary_entry_route`: drainage crops = 'Drainage'; orchard/vine = 'Spray drift + Runoff'
- `relevant_waterbody`: follows from scenario type (D scenarios = ditch; R scenarios = stream/pond)

---

## Quick query to check population progress

```sql
SELECT
    'crops'                    AS tbl, COUNT(*) AS rows FROM crops
UNION ALL SELECT 'eppo_codes',           COUNT(*) FROM eppo_codes
UNION ALL SELECT 'focus_crops',          COUNT(*) FROM focus_crops
UNION ALL SELECT 'focus_crop_interception', COUNT(*) FROM focus_crop_interception
UNION ALL SELECT 'focus_crop_scenario_links', COUNT(*) FROM focus_crop_scenario_links
UNION ALL SELECT 'reg396_commodities',   COUNT(*) FROM reg396_commodities
UNION ALL SELECT 'primo_commodities',    COUNT(*) FROM primo_commodities
UNION ALL SELECT 'ecotox_bee_attributes', COUNT(*) FROM ecotox_bee_attributes;
```

# Database preparation and population plan

This plan covers preparing the SQLite crop database and populating it in a dependency-safe order. It extends the existing [DATA_POPULATION_GUIDE.md](DATA_POPULATION_GUIDE.md) and ties in the JSON data you added (primo/, zonal-*, FOCUS_*).

---

## Phase 0 — Preparation

### 0.1 Environment and dependencies

- **Python 3.8+** with:
  - `requests` (EPPO verify)
  - `openpyxl` (PRIMo Excel import)
  - `pyodbc` (Windows SWASH .mdb) or **mdbtools** (Linux/Mac export to CSV)
- **EPPO API token** (free): https://gd.eppo.int/user/register
- **PRIMo Rev 3.1 .xlsx**: https://www.efsa.europa.eu/en/applications/pesticides/tools
- **SWASH** (optional for Step 3): `C:\SWASH\Database\swash.mdb` or exported CSV from mdbtools

### 0.2 Create and initialise the database

1. **Apply schema** (creates empty tables + lookup/seed data):

   ```bash
   sqlite3 crop_db.sqlite < crop_db_sqlite.sql
   ```

   This creates:
   - All tables (crops, eppo_codes, focus_crops, focus_scenarios, focus_crop_scenario_links, focus_sw_scenario_characteristics, focus_crop_scenario_irrigation, reg396_commodities, primo_commodities, etc.)
   - Lookups: `plant_families`, `crop_types`, `annuality_types`, `focus_scenario_types`, `focus_scenarios`, `data_sources`

2. **Develop and seed the crop list** (see **Design: crop list and groupings** below):
   - The schema does **not** seed `crops` or `eppo_codes`. You must populate `crops` first (from Reg 396/PRIMo, EPPO, or a curated list), then attach EPPO codes and other groupings.
   - The guide previously assumed 31 crops / 31 eppo_codes; in practice, define the spine in `crops`, then add groupings. `focus_crops` is already seeded with 25 FOCUS SW names; link them to `crops` via `focus_crop_reg396_mappings` (and optionally `focus_crops.crop_id`) once the crop list exists.

3. **Optional data fix** (recommended):
   - In `zonal-mitigation.json`: correct typo `"Maxiumum Nozzle (%)"` → `"Maximum Nozzle (%)"` so any future importer uses consistent column names.

---

## Design: crop list and groupings

**The crop list is the spine; all groupings hang off it.**

- **`crops`** = the canonical list of crop concepts (one row per “thing” you want to track: common name, scientific name, family, type). This is the only table that defines *what a crop is*; everything else is a classification or alias of those rows.
- **Groupings** = different regulatory/assessment ways of referring to the same crops. Each grouping links to `crops` via `crop_id` (or via a mapping table that eventually points at `crops`).

| Grouping | Table(s) | How it fits |
|----------|----------|-------------|
| EPPO | `eppo_codes` | One or more EPPO codes per crop (`crop_id`). Often 1:1; some crops have several codes (e.g. genus + species). |
| Reg 396 / Annex I | `reg396_commodities` | One or more commodity codes per crop (`crop_id`). Finer than FOCUS: e.g. wheat, barley, rye each have a row; FOCUS “Winter cereals” is a grouping of several. |
| PRIMo | `primo_commodities` | One or more PRIMo commodities per crop (`crop_id`). Aligned with Reg 396 + consumption data. |
| FOCUS / SWASH | `focus_crops` | Coarse categories for surface water (e.g. “Cereals, winter”, “Sugar beets”). Optional single `crop_id` per focus_crop; the real link to the crop list is often via **`focus_crop_reg396_mappings`**: one FOCUS crop → many `reg396_commodities` → each has a `crop_id`. So FOCUS “Winter cereals” maps to several rows in `crops` (wheat, barley, etc.). |
| Codex | `codex_commodities` | One or more Codex codes per crop (`crop_id`). |

**Developing the crop list**

1. **Choose a granularity** — Usually “one row per commodity that can have an MRL or be named in a study”: e.g. wheat, barley, apple, sugar beet. That aligns with Reg 396 / EPPO at species or commodity level.
2. **Build the spine** — Populate `crops` from a primary source. Options:
   - **Option A:** Start from **Reg 396 / PRIMo** (import Step 2); create one `crops` row per Annex I commodity (or per PRIMo commodity), then dedupe by name/scientific name if needed.
   - **Option B:** Start from **EPPO** (or a list of EPPO codes you care about); one `crops` row per EPPO code, with `common_name_en` and `scientific_name` from the EPPO API. Then link Reg 396/PRIMo to those rows by matching names or codes.
   - **Option C:** Start from **FOCUS crop names**; create a first cut of `crops` from the 25 FOCUS names, then split or merge as you add Reg 396 (e.g. “Cereals, winter” splits into wheat, barley, rye, triticale, oats).
3. **Attach groupings in order** — Once `crops` exists: add `eppo_codes` (Step 1), then `reg396_commodities` / `primo_commodities` (Step 2) with `crop_id` set, then `focus_crop_reg396_mappings` so each FOCUS crop points at the right Reg 396 rows (and hence crops). Optionally set `focus_crops.crop_id` to a “representative” crop for each FOCUS group.

**Practical takeaway:** Until `crops` is populated, EPPO verify and Reg 396/PRIMo imports use placeholders or skip linking. The next concrete step is to define and seed the crop list (e.g. script from PRIMo Excel or EPPO, or a hand-maintained list), then re-run the linking steps.

---

## Phase 1 — Core data (order matters)

Dependencies: **crops** → **eppo_codes** → (everything else). **focus_crops** and **focus_scenarios** must exist before scenario links and interception.

| Step | What | Source | Table(s) | Notes |
|------|------|--------|----------|--------|
| **1** | Verify/correct EPPO codes | EPPO API | `eppo_codes` (updates), `crops.scientific_name` | Uses existing rows only. Run before PRIMo matching. |
| **2** | Reg 396 + PRIMo commodities | PRIMo Rev 3.1 .xlsx | `reg396_commodities`, `primo_commodities` | ~450 rows; initial `crop_id` placeholder; link to crops after Step 1. |
| **3** | FOCUS crop × scenario links | SWASH .mdb, CSV, or **FOCUS_SW_Crop_Scenario_Links.json** | `focus_crop_scenario_links` | Use `import_swash_mdb.py` or `import_swash_json.py`. Requires `focus_crops` and `focus_scenarios`. |
| **3b** | FOCUS SW scenario weather + irrigation | **FOCUS_SW_Scenario_Characteristics.json**, **FOCUS_SW_Crop_Scenario_Irrigation.json** | `focus_sw_scenario_characteristics`, `focus_crop_scenario_irrigation` | `python import_focus_sw_characteristics.py --db crop_db.sqlite --apply`. Source: Generic FOCUS SWS v1.4. |
| **4** | Interception by BBCH | EFSA 2020:6119 Table 7 **or** FOCUS_Crop_Interception.json | `focus_crop_interception` | See Phase 2 below. |
| **5** | FOCUS ↔ Reg 396 mappings | Manual / script | `focus_crop_reg396_mappings` | After Step 2; map coarse FOCUS crops to Annex I commodities. |

### Commands (from DATA_POPULATION_GUIDE)

```bash
# Step 1 — EPPO (preview then apply)
python eppo_verify.py --token YOUR_TOKEN --db crop_db.sqlite
python eppo_verify.py --token YOUR_TOKEN --db crop_db.sqlite --apply

# Step 2 — PRIMo Excel (preview then apply)
python import_primo.py --xlsx "PRIMo_Rev3.1.xlsx" --db crop_db.sqlite
python import_primo.py --xlsx "PRIMo_Rev3.1.xlsx" --db crop_db.sqlite --apply

# Step 3 — SWASH (Windows) or JSON
python import_swash_mdb.py --mdb "C:/SWASH/Database/swash.mdb" --db crop_db.sqlite --apply
# OR: python import_swash_json.py --json FOCUS_SW_Crop_Scenario_Links.json --db crop_db.sqlite --apply

# Step 3b — FOCUS SW scenario characteristics and irrigation
python import_focus_sw_characteristics.py --db crop_db.sqlite --apply

# Step 4 — Interception (see Phase 2)
python import_interception.py --db crop_db.sqlite --apply
```

---

## Phase 2 — Interception (two options)

**Option A — Manual (current design)**  
- Use EFSA 2020:6119 Table 7.  
- Fill the `INTERCEPTION_DATA` dict in `import_interception.py` with `(bbch_stage, interception_pct, source_label)` per FOCUS crop (key = `swash_crop_name`).  
- Run `import_interception.py --db crop_db.sqlite --apply`.

**Option B — From FOCUS_Crop_Interception.json (recommended)**  
- Add an importer (e.g. `import_interception_json.py` or extend `import_interception.py`) that:
  1. Reads `FOCUS_Crop_Interception.json`.
  2. Maps JSON `crop` names to `focus_crops.swash_crop_name` (e.g. `"winter cereals"` → `"Winter cereals"`, `"sugar beets"` → `"Sugar beets"`). Maintain a small mapping dict for differences (e.g. beans/peas variants).
  3. Resolves growth stages to BBCH values:
     - Use the five bands in the JSON (`bare_emergence` 0–9, `leaf_development` 10–19, `stem_elongation` 20–39, `flowering` 40–89, `senescence_ripening` 90–99); store one row per (focus_crop_id, bbch_stage) using the band’s lower bound (0, 10, 20, 40, 90) and the numeric interception value.
     - For crops with **array** values (e.g. spring/winter cereals with sub-ranges in `stem_elongation` / `flowering`), either insert multiple rows per band (e.g. 20, 30 for tillering/elongation) or choose a single representative BBCH and value per band.
  4. Inserts into `focus_crop_interception` with a consistent `interception_source` (e.g. `"EFSA 2020 Repair Action / FOCUS_Crop_Interception.json"`).

Do one of A or B so `focus_crop_interception` is populated.

---

## Phase 3 — Optional / future

| Item | Source | Purpose |
|------|--------|--------|
| **PRIMo country list** | `primo/primo_country_mapping.json` | If the app needs a countries table for dietary risk (e.g. by country ID), add a `countries` table and an importer for this JSON. |
| **IESTI parameters** | `primo/IESTI.json` | Could populate an `iesti_parameters` table (matrix code, primo code, unit weights, case, VF) for dietary tools. Schema would need defining. |
| **PRIMo hierarchy** | `primo/primo_hierarchy.json` | Matrix code ↔ FoodEx2 hierarchy; useful for reporting or PRIMo 4 alignment. Optional table + importer. |
| **Zonal scenarios** | `zonal-scenarios.json` | Country × zone × D1–D6 / R1–R4 applicability. Add tables (e.g. `zonal_countries`, `zonal_scenario_flags`) and importer if the app must drive zonal scenario selection. |
| **Zonal mitigation** | `zonal-mitigation.json` | Buffer maxima, SWAN, etc. per country. Same as above; optional tables + importer. |
| **FOCUS GW/SW crop lists** | `FOCUS_GW_Crops.json`, `FOCUS_SW_Crops.json` | Reference only unless you want to validate `focus_crop_scenario_links` or seed `focus_crops` from them. |
| **Ecotox** | EFSA Bee / B&M / Aquatic guidance | `ecotox_bee_attributes`, `ecotox_bm_attributes`, `ecotox_aquatic_attributes`: small tables; populate manually or from guidance tables. |
| **Codex** | FAO CAC/MISC 4 | `codex_commodities`: when needed for MRL comparison. |

---

## Phase 4 — Verification

After population, run:

```sql
SELECT 'crops'                      AS tbl, COUNT(*) AS rows FROM crops
UNION ALL SELECT 'eppo_codes',      COUNT(*) FROM eppo_codes
UNION ALL SELECT 'focus_crops',     COUNT(*) FROM focus_crops
UNION ALL SELECT 'focus_crop_interception', COUNT(*) FROM focus_crop_interception
UNION ALL SELECT 'focus_crop_scenario_links', COUNT(*) FROM focus_crop_scenario_links
UNION ALL SELECT 'focus_sw_scenario_characteristics', COUNT(*) FROM focus_sw_scenario_characteristics
UNION ALL SELECT 'focus_crop_scenario_irrigation', COUNT(*) FROM focus_crop_scenario_irrigation
UNION ALL SELECT 'reg396_commodities', COUNT(*) FROM reg396_commodities
UNION ALL SELECT 'primo_commodities', COUNT(*) FROM primo_commodities;
```

- Check that counts match expectations (e.g. focus_crop_interception > 0, focus_crop_scenario_links filled if SWASH was used).
- Use `v_crop_overview` and `v_focus_crop_scenarios` to spot missing links or names.

---

## Summary checklist

| # | Task | Blocker | Done |
|---|------|--------|------|
| 0 | Apply `crop_db_sqlite.sql` | — | ☐ |
| 0 | Seed crops + eppo_codes + focus_crops (if not in schema) | — | ☐ |
| 1 | Run eppo_verify.py (preview + apply) | DB + token | ☐ |
| 2 | Run import_primo.py (preview + apply) | PRIMo .xlsx, Step 1 for matching | ☐ |
| 3 | Run import_swash_mdb.py (preview + apply) | SWASH .mdb or CSV, focus_crops | ☐ |
| 4 | Populate focus_crop_interception (manual dict or JSON importer) | focus_crops | ☐ |
| 5 | Populate focus_crop_reg396_mappings | reg396_commodities, focus_crops | ☐ |
| 3b | Run import_focus_sw_characteristics.py (scenario weather + irrigation) | focus_scenarios, focus_crops | ☐ |
| — | Optional: zonal/PRIMo country/IESTI tables + importers | — | ☐ |
| — | Verification query + views | — | ☐ |

---

*Document created as the single plan for preparing and populating the crop database. Update this file when adding new import scripts or tables; record code/schema changes in the project changelog.*

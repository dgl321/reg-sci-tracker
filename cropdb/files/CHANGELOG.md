# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]

### Added

- **FOCUS SW scenario weather/location and irrigation**
  - New tables: `focus_sw_scenario_characteristics` (weather dataset, lat/long, mean temp, rainfall, soil, slope, water bodies per D1–D6, R1–R4) and `focus_crop_scenario_irrigation` (average irrigation mm/year per crop × scenario).
  - New JSON: `FOCUS_SW_Scenario_Characteristics.json`, `FOCUS_SW_Crop_Scenario_Irrigation.json` (source: Generic FOCUS SWS v1.4 May 2015, Tables 4.1.2-1, ES-1, 4.1.4-1, 4.1.4-2).
  - New script: `import_focus_sw_characteristics.py` to populate both tables from the JSON files.
  - Schema changes in `crop_db_sqlite.sql` and `crop_db_schema.sql`.
  - `DATABASE_POPULATION_PLAN.md` updated with Step 3b and verification query for the new tables.

### Fixed

- **FOCUS SW scenario seed** — Added missing **D6 Drainage (Thiva)** to `focus_scenarios` in `crop_db_sqlite.sql` so all 10 standard scenarios (D1–D6, R1–R4) exist; R5 retained.
- **focus_crops empty** — Added seed INSERT for 25 FOCUS SW crop names (matching `FOCUS_SW_Crops.json` / SWASH) so `import_focus_sw_characteristics.py` can resolve crops and populate `focus_crop_scenario_irrigation`.

### Why

- To capture scenario weather/location and irrigation in the database for traceability, reporting and potential use in exposure tools, without reopening the FOCUS PDF.

-- =============================================================================
-- EU Plant Protection Product Risk Assessment — Crop Database Schema
-- SQLite version (converted from PostgreSQL 15 schema)
-- =============================================================================
-- Design principles:
--   1. The core `crops` table is the single source of truth for each
--      crop/commodity concept. All classification systems hang off it.
--   2. EPPO codes serve as the natural human-readable key for cross-referencing
--      between tables and external systems.
--   3. Assessment-specific attribute tables are kept separate so that each
--      regulatory domain (efate, ecotox, residues, efficacy) can be extended
--      independently without polluting the core table.
--   4. Many-to-many relationships use explicit junction tables with their own
--      metadata columns rather than array columns, to keep queries standard SQL.
--   5. All classification codes are stored as TEXT to preserve leading zeros and
--      alphanumeric formats (e.g. Reg 396/2005 commodity code "0110010").
--
-- SQLite notes:
--   - INTEGER PRIMARY KEY is an alias for rowid and auto-increments.
--   - BOOLEAN is stored as INTEGER (0 = false, 1 = true).
--   - DATE and TIMESTAMPTZ are stored as TEXT (ISO 8601 format).
--   - NUMERIC/REAL used for decimal values.
--   - Foreign key enforcement requires: PRAGMA foreign_keys = ON;
--     (must be set per connection — add to your application startup).
--   - COMMENT ON TABLE/VIEW is not supported; comments are inline SQL comments.
--
-- Regulatory basis:
--   Efate      : FOCUS SW (SANCO/4802/2001-rev.2 + EFSA 2020 Repair Action)
--                FOCUS GW (SANCO/321/2000 rev.2, Generic Guidance v2.4)
--   Residues   : Regulation (EC) No 396/2005 Annex I
--                Codex Alimentarius CAC/MISC 4 (current revision)
--                EFSA PRIMo Rev 3.1 (mandatory) and PRIMo 4 (indicative)
--   Ecotox     : EFSA Bee Guidance (2013, doi:10.2903/j.efsa.2013.3295)
--                EFSA Birds & Mammals Guidance (2009, doi:10.2903/j.efsa.2009.1438)
--                EFSA Aquatic Guidance (2013, doi:10.2903/j.efsa.2013.3290)
--   Efficacy   : EPPO PP1 standards series (https://www.eppo.int)
--   Toxicology : Reg 396/2005 Annex I commodity codes (shared with residues)
-- =============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;     -- Better concurrent read performance
PRAGMA synchronous = NORMAL;   -- Safe with WAL; faster than FULL


-- ---------------------------------------------------------------------------
-- LOOKUP / REFERENCE TABLES
-- ---------------------------------------------------------------------------

-- Plant families (used across multiple sections, e.g. NTP ERA, residue groups)
CREATE TABLE IF NOT EXISTS plant_families (
    family_id       INTEGER PRIMARY KEY,
    family_name     TEXT NOT NULL UNIQUE,        -- e.g. 'Poaceae', 'Brassicaceae'
    common_name     TEXT,                         -- e.g. 'Grasses', 'Cabbages and mustards'
    notes           TEXT
);

-- Broad crop type categories
CREATE TABLE IF NOT EXISTS crop_types (
    crop_type_id    INTEGER PRIMARY KEY,
    type_name       TEXT NOT NULL UNIQUE,         -- e.g. 'Arable', 'Vegetable', 'Fruit'
    type_subgroup   TEXT,                         -- e.g. 'Root vegetable', 'Citrus', 'Stone fruit'
    notes           TEXT
);

-- Growth habit / annuality categories
CREATE TABLE IF NOT EXISTS annuality_types (
    annuality_id    INTEGER PRIMARY KEY,
    annuality_name  TEXT NOT NULL UNIQUE          -- 'Annual', 'Biennial', 'Perennial', 'Evergreen perennial'
);


-- ---------------------------------------------------------------------------
-- CORE CROP TABLE
-- ---------------------------------------------------------------------------
-- One row per crop concept. All classification details live in child tables.
-- common_name_en uses the EPPO preferred English name as the canonical label.

CREATE TABLE IF NOT EXISTS crops (
    crop_id             INTEGER PRIMARY KEY,
    common_name_en      TEXT NOT NULL,            -- Preferred English name (EPPO preferred)
    common_name_de      TEXT,
    common_name_fr      TEXT,
    scientific_name     TEXT,                     -- Binomial, most specific level available
    plant_family_id     INTEGER REFERENCES plant_families(family_id),
    crop_type_id        INTEGER REFERENCES crop_types(crop_type_id),
    annuality_id        INTEGER REFERENCES annuality_types(annuality_id),
    is_food_crop        INTEGER NOT NULL DEFAULT 1,   -- BOOLEAN: 1=true, 0=false
    is_feed_crop        INTEGER NOT NULL DEFAULT 0,
    is_non_food         INTEGER NOT NULL DEFAULT 0,   -- e.g. ornamentals, turf
    notes               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT crops_common_name_unique UNIQUE (common_name_en, scientific_name)
);

CREATE INDEX IF NOT EXISTS idx_crops_common_name ON crops(common_name_en);
CREATE INDEX IF NOT EXISTS idx_crops_scientific  ON crops(scientific_name);


-- ---------------------------------------------------------------------------
-- EPPO CODES
-- (Source: EPPO Global Database — https://gd.eppo.int)
-- ---------------------------------------------------------------------------
-- A crop may have more than one EPPO code (genus-level + species-level entries,
-- or synonym codes for older submissions). One code is flagged preferred.

CREATE TABLE IF NOT EXISTS eppo_codes (
    eppo_code_id        INTEGER PRIMARY KEY,
    crop_id             INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    eppo_code           TEXT NOT NULL UNIQUE,     -- 5-character alphanumeric, e.g. 'TRZAW'
    eppo_name           TEXT NOT NULL,            -- EPPO preferred name for this code
    taxon_level         TEXT,                     -- 'Species', 'Genus', 'Family', 'Crop group'
    is_preferred        INTEGER NOT NULL DEFAULT 1,  -- BOOLEAN
    notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_eppo_codes_crop ON eppo_codes(crop_id);
CREATE INDEX IF NOT EXISTS idx_eppo_codes_code ON eppo_codes(eppo_code);


-- ---------------------------------------------------------------------------
-- REGULATION (EC) No 396/2005 ANNEX I COMMODITIES
-- ---------------------------------------------------------------------------
-- Hierarchical numeric code system (e.g. 0110000 = Citrus fruits,
-- 0110010 = Grapefruits). Level 1 = commodity group, 2 = subgroup, 3 = individual.

CREATE TABLE IF NOT EXISTS reg396_commodities (
    reg396_id               INTEGER PRIMARY KEY,
    crop_id                 INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    annex1_code             TEXT NOT NULL UNIQUE, -- e.g. '0110010' (preserve leading zeros)
    annex1_name             TEXT NOT NULL,        -- Official name from Annex I
    hierarchy_level         INTEGER NOT NULL,     -- 1 = group, 2 = subgroup, 3 = individual
    parent_annex1_code      TEXT,                 -- Code of the parent row in the hierarchy
    is_mrl_group            INTEGER DEFAULT 0,    -- BOOLEAN: 1 if this is a crop group entry
    regulation_version      TEXT,                 -- e.g. 'Reg (EC) No 396/2005 as amended by Reg (EU) 2023/334'
    notes                   TEXT
);

CREATE INDEX IF NOT EXISTS idx_reg396_crop      ON reg396_commodities(crop_id);
CREATE INDEX IF NOT EXISTS idx_reg396_code      ON reg396_commodities(annex1_code);
CREATE INDEX IF NOT EXISTS idx_reg396_hierarchy ON reg396_commodities(hierarchy_level, parent_annex1_code);


-- MRL Crop Groups (Annex I Part A/B grouping for extrapolation)
CREATE TABLE IF NOT EXISTS reg396_crop_groups (
    group_id        INTEGER PRIMARY KEY,
    group_code      TEXT NOT NULL UNIQUE,
    group_name      TEXT NOT NULL,
    group_level     TEXT,                         -- 'Major group', 'Sub-group'
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS reg396_crop_group_members (
    group_id          INTEGER NOT NULL REFERENCES reg396_crop_groups(group_id) ON DELETE CASCADE,
    reg396_id         INTEGER NOT NULL REFERENCES reg396_commodities(reg396_id) ON DELETE CASCADE,
    is_representative INTEGER DEFAULT 0,          -- BOOLEAN
    PRIMARY KEY (group_id, reg396_id)
);


-- ---------------------------------------------------------------------------
-- CODEX ALIMENTARIUS COMMODITY CLASSIFICATION
-- (Source: CAC/MISC 4 — https://www.fao.org/fao-who-codexalimentarius)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS codex_commodities (
    codex_id            INTEGER PRIMARY KEY,
    crop_id             INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    codex_code          TEXT NOT NULL UNIQUE,     -- e.g. 'FC 0001'
    codex_name          TEXT NOT NULL,
    codex_class         TEXT,                     -- 'Primary food commodity', 'Processed commodity'
    commodity_type      TEXT,                     -- 'FC', 'VO', 'VD', 'VR', etc.
    codex_group         TEXT,                     -- e.g. 'Fruits', 'Vegetables', 'Cereals'
    notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_codex_crop ON codex_commodities(crop_id);


-- ---------------------------------------------------------------------------
-- EFSA PRIMo COMMODITY LIST
-- (Source: PRIMo Rev 3.1 Excel tool and PRIMo 4 online platform)
-- ---------------------------------------------------------------------------
-- primo_version discriminator: 'Rev 3.1' or 'Rev 4'
-- Rev 4 adds RPC/RPCD structure; Rev 3.1 is mandatory until ~2026.

CREATE TABLE IF NOT EXISTS primo_commodities (
    primo_id            INTEGER PRIMARY KEY,
    crop_id             INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    primo_version       TEXT NOT NULL,            -- 'Rev 3.1' or 'Rev 4'
    primo_code          TEXT,
    primo_name          TEXT NOT NULL,
    rpc_name            TEXT,                     -- Rev 4: Raw Primary Commodity name
    rpcd_name           TEXT,                     -- Rev 4: Processed derivative name
    unit_weight_g       REAL,                     -- Large portion unit weight (g) for IESTI
    processing_factor_available INTEGER DEFAULT 0, -- BOOLEAN
    notes               TEXT,
    UNIQUE (primo_version, primo_name)
);

CREATE INDEX IF NOT EXISTS idx_primo_crop    ON primo_commodities(crop_id);
CREATE INDEX IF NOT EXISTS idx_primo_version ON primo_commodities(primo_version);


-- ---------------------------------------------------------------------------
-- FOCUS SCENARIO DEFINITIONS
-- (Source: FOCUS SW v1.4 / GW Generic Guidance v2.4 — esdac.jrc.ec.europa.eu)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS focus_scenario_types (
    scenario_type_id    INTEGER PRIMARY KEY,
    scenario_type       TEXT NOT NULL UNIQUE      -- 'Surface water', 'Groundwater', 'Soil'
);

CREATE TABLE IF NOT EXISTS focus_scenarios (
    scenario_id         INTEGER PRIMARY KEY,
    scenario_type_id    INTEGER NOT NULL REFERENCES focus_scenario_types(scenario_type_id),
    scenario_name       TEXT NOT NULL UNIQUE,     -- e.g. 'D4 (Drainage)', 'Châteaudun'
    scenario_code       TEXT,                     -- e.g. 'D4', 'CHAT'
    country_location    TEXT,
    climate_zone        TEXT,
    soil_type           TEXT,
    assessment_step     TEXT,
    model_tool          TEXT,                     -- 'MACRO', 'PRZM', 'PEARL', 'PELMO'
    notes               TEXT
);

-- Seed: scenario types
INSERT OR IGNORE INTO focus_scenario_types (scenario_type) VALUES
    ('Surface water'),
    ('Groundwater'),
    ('Soil');

-- Seed: surface water scenarios (FOCUS 2001, Generic FOCUS SWS v1.4 — D1–D6 drainage, R1–R4 runoff; R5 optional)
INSERT OR IGNORE INTO focus_scenarios
    (scenario_type_id, scenario_name, scenario_code, country_location, climate_zone, model_tool, assessment_step)
VALUES
    (1, 'D1 Drainage (Brimstone)',    'D1', 'UK (South England)',     'Atlantic',              'MACRO',            'Step 3'),
    (1, 'D2 Drainage (Vredepeel)',    'D2', 'Netherlands',            'Atlantic',              'MACRO',            'Step 3'),
    (1, 'D3 Drainage (Lanna)',        'D3', 'Sweden',                 'Northern Atlantic',     'MACRO',            'Step 3'),
    (1, 'D4 Drainage (Hamburg)',      'D4', 'Germany',                'Continental',           'MACRO',            'Step 3'),
    (1, 'D5 Drainage (Skousbo)',      'D5', 'Denmark',                'Atlantic',              'MACRO',            'Step 3'),
    (1, 'D6 Drainage (Thiva)',        'D6', 'Greece',                 'Mediterranean',         'MACRO',            'Step 3'),
    (1, 'R1 Runoff (Roujan)',         'R1', 'France (Languedoc)',     'Mediterranean',         'PRZM',             'Step 3'),
    (1, 'R2 Runoff (Thiva)',          'R2', 'Greece',                 'Mediterranean',         'PRZM',             'Step 3'),
    (1, 'R3 Runoff (Porto)',          'R3', 'Portugal',               'Mediterranean',         'PRZM',             'Step 3'),
    (1, 'R4 Runoff (Piacenza)',       'R4', 'Italy (Po Valley)',      'Continental',           'PRZM',             'Step 3'),
    (1, 'R5 Runoff (Kremsmünster)',   'R5', 'Austria',               'Continental',           'PRZM',             'Step 3');

-- Seed: groundwater scenarios (FOCUS 2000, Generic Guidance v2.4)
INSERT OR IGNORE INTO focus_scenarios
    (scenario_type_id, scenario_name, scenario_code, country_location, climate_zone, model_tool, assessment_step)
VALUES
    (2, 'Châteaudun',   'CHAT', 'France (north)',    'Atlantic-Continental', 'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Hamburg',      'HAMB', 'Germany',           'Continental',          'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Jokioinen',    'JOKI', 'Finland',           'Northern',             'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Kremsmünster', 'KREM', 'Austria',           'Continental',          'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Okehampton',   'OKEH', 'UK (SW England)',   'Atlantic',             'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Piacenza',     'PIAC', 'Italy',             'Continental',          'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Porto',        'PORT', 'Portugal',          'Mediterranean',        'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Sevilla',      'SEVI', 'Spain (south)',     'Mediterranean',        'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Thiva',        'THIV', 'Greece',            'Mediterranean',        'MACRO/PEARL/PELMO', 'Step 3');


-- ---------------------------------------------------------------------------
-- FOCUS CROP DEFINITIONS
-- (Source: SWASH v5.3 crop table; EFSA 2014 crop interception guidance;
--          EFSA 2020 Surface Water Repair Action, Table 7)
-- ---------------------------------------------------------------------------
-- FOCUS crops are coarser than Reg 396/2005. 'Winter cereals' maps to wheat,
-- barley, rye, triticale, oats individually. See focus_crop_reg396_mappings.

CREATE TABLE IF NOT EXISTS focus_crops (
    focus_crop_id       INTEGER PRIMARY KEY,
    crop_id             INTEGER REFERENCES crops(crop_id),  -- NULL if no 1:1 crop mapping
    swash_crop_name     TEXT NOT NULL UNIQUE,
    swash_crop_code     TEXT,
    crop_category       TEXT,                  -- 'Arable', 'Vegetable', 'Permanent', 'Grass'

    -- BBCH phenology reference windows
    bbch_sowing_min     INTEGER,
    bbch_sowing_max     INTEGER,
    bbch_harvest_min    INTEGER,
    bbch_harvest_max    INTEGER,

    -- Canopy / application method attributes
    canopy_type         TEXT,                  -- 'Annual arable', 'Tall permanent', 'Low permanent'
    ground_spray_possible INTEGER DEFAULT 0,  -- BOOLEAN (Repair Action 2020)

    -- Root parameters
    root_depth_m        REAL,                  -- Maximum rooting depth (m)
    lai_max             REAL,                  -- Maximum leaf area index

    notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_focus_crops_name ON focus_crops(swash_crop_name);

-- Seed: FOCUS SW crop names (match FOCUS_SW_Crops.json / SWASH GUI; crop_id linked later)
INSERT OR IGNORE INTO focus_crops (swash_crop_name) VALUES
    ('Cereals, spring'),
    ('Cereals, winter'),
    ('Citrus'),
    ('Cotton'),
    ('Field beans'),
    ('Grass/alfalfa'),
    ('Hops'),
    ('Legumes'),
    ('Maize'),
    ('Oil seed rape, spring'),
    ('Oil seed rape, winter'),
    ('Olives'),
    ('Pome/stone fruit, early applications'),
    ('Pome/stone fruit, late applications'),
    ('Potatoes'),
    ('Soybeans'),
    ('Sugar beets'),
    ('Sunflowers'),
    ('Tobacco'),
    ('Vegetables, bulb'),
    ('Vegetables, fruiting'),
    ('Vegetables, leafy'),
    ('Vegetables, root'),
    ('Vines, early applications'),
    ('Vines, late applications');

-- Interception values per FOCUS crop x BBCH stage (Table 7, EFSA 2020)
CREATE TABLE IF NOT EXISTS focus_crop_interception (
    interception_id     INTEGER PRIMARY KEY,
    focus_crop_id       INTEGER NOT NULL REFERENCES focus_crops(focus_crop_id) ON DELETE CASCADE,
    bbch_stage          INTEGER NOT NULL,
    interception_pct    REAL,                      -- Canopy interception (%) at this BBCH stage
    interception_source TEXT,                      -- 'EFSA 2014', 'EFSA 2020 Repair Action'
    notes               TEXT,
    UNIQUE (focus_crop_id, bbch_stage)
);

-- Valid crop x scenario combinations
CREATE TABLE IF NOT EXISTS focus_crop_scenario_links (
    link_id             INTEGER PRIMARY KEY,
    focus_crop_id       INTEGER NOT NULL REFERENCES focus_crops(focus_crop_id) ON DELETE CASCADE,
    scenario_id         INTEGER NOT NULL REFERENCES focus_scenarios(scenario_id) ON DELETE CASCADE,
    waterbody_type      TEXT,                  -- 'Drainage ditch', 'Stream', 'Pond'
    is_default_run      INTEGER DEFAULT 1,     -- BOOLEAN
    notes               TEXT,
    UNIQUE (focus_crop_id, scenario_id, waterbody_type)
);

-- FOCUS SW scenario weather/location and climate (Generic FOCUS SWS v1.4, Table 4.1.2-1, ES-1)
-- One row per surface water scenario (D1–D6, R1–R4).
CREATE TABLE IF NOT EXISTS focus_sw_scenario_characteristics (
    scenario_id                     INTEGER PRIMARY KEY REFERENCES focus_scenarios(scenario_id) ON DELETE CASCADE,
    scenario_code                   TEXT NOT NULL UNIQUE,   -- 'D1'..'D6','R1'..'R4'
    weather_dataset_name            TEXT NOT NULL,         -- e.g. 'Lanna', 'Brimstone'
    latitude_deg                    REAL,                  -- decimal degrees N
    longitude_deg                   REAL,                  -- decimal degrees E (negative = W)
    mean_annual_temp_c              REAL,                  -- °C
    annual_rainfall_mm              REAL,                  -- mm
    topsoil_texture                 TEXT,                  -- e.g. 'Silty clay', 'Loam'
    topsoil_organic_carbon_pct      REAL,                  -- %
    slope_pct                       TEXT,                  -- e.g. '0-0.5', '2-4'
    water_bodies                    TEXT,                  -- e.g. 'Ditch, stream', 'Pond, stream'
    source_reference                TEXT                   -- e.g. 'Generic FOCUS SWS v1.4 May 2015'
);

-- Average annual irrigation (mm) per FOCUS SW crop × scenario (Generic FOCUS SWS v1.4, Tables 4.1.4-1, 4.1.4-2)
-- 0 = crop present but not irrigated; row only present where crop is in scenario.
CREATE TABLE IF NOT EXISTS focus_crop_scenario_irrigation (
    focus_crop_id       INTEGER NOT NULL REFERENCES focus_crops(focus_crop_id) ON DELETE CASCADE,
    scenario_id         INTEGER NOT NULL REFERENCES focus_scenarios(scenario_id) ON DELETE CASCADE,
    irrigation_mm_annual REAL NOT NULL,       -- average irrigation mm/year (0 if not irrigated)
    source_reference    TEXT,                  -- e.g. 'Generic FOCUS SWS v1.4 Table 4.1.4-1'
    PRIMARY KEY (focus_crop_id, scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_focus_crop_scenario_irrigation_scenario ON focus_crop_scenario_irrigation(scenario_id);

-- Many-to-many: FOCUS coarse crops → individual Reg 396 commodities
-- e.g. FOCUS 'Winter cereals' → wheat (0140010), barley (0140020), rye (0140040)
CREATE TABLE IF NOT EXISTS focus_crop_reg396_mappings (
    focus_crop_id       INTEGER NOT NULL REFERENCES focus_crops(focus_crop_id) ON DELETE CASCADE,
    reg396_id           INTEGER NOT NULL REFERENCES reg396_commodities(reg396_id) ON DELETE CASCADE,
    mapping_rationale   TEXT,
    PRIMARY KEY (focus_crop_id, reg396_id)
);


-- ---------------------------------------------------------------------------
-- EFATE ADDITIONAL ATTRIBUTES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS efate_crop_attributes (
    efate_attr_id           INTEGER PRIMARY KEY,
    crop_id                 INTEGER NOT NULL UNIQUE REFERENCES crops(crop_id) ON DELETE CASCADE,

    -- Soil exposure
    soil_pec_applicable     INTEGER DEFAULT 1,        -- BOOLEAN
    soil_app_depth_cm       REAL,

    -- Crop residue / incorporation attributes
    harvest_residue_fraction REAL,

    -- Sediment exposure
    sediment_relevant       INTEGER DEFAULT 0,        -- BOOLEAN; TRUE for paddy rice, wetland crops

    -- Crop interception grouping (FOCUS GW Table 1.6 / EFSA 2014)
    gw_interception_group   TEXT,                     -- e.g. 'Cereals', 'Root crops', 'Fruit trees'

    notes                   TEXT
);


-- ---------------------------------------------------------------------------
-- ECOTOXICOLOGY — BEE EXPOSURE ATTRIBUTES
-- (Source: EFSA Bee Guidance Document, 2013, doi:10.2903/j.efsa.2013.3295)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ecotox_bee_attributes (
    bee_attr_id             INTEGER PRIMARY KEY,
    crop_id                 INTEGER NOT NULL UNIQUE REFERENCES crops(crop_id) ON DELETE CASCADE,

    is_flowering_crop       INTEGER NOT NULL DEFAULT 0,  -- BOOLEAN
    typical_flowering_months TEXT,                       -- e.g. 'April-June'
    pollen_producing        INTEGER DEFAULT 0,
    nectar_producing        INTEGER DEFAULT 0,

    bee_attractive          INTEGER DEFAULT 0,
    bee_guidance_tier       TEXT,                        -- 'Tier 1', 'Tier 2', 'Field study'

    relevant_bumblebee      INTEGER DEFAULT 0,
    relevant_solitary_bee   INTEGER DEFAULT 0,

    guttation_relevant      INTEGER DEFAULT 0,
    typical_sowing_months   TEXT,

    is_bee_guidance_rep_crop INTEGER DEFAULT 0,
    bee_guidance_crop_label  TEXT,

    notes                   TEXT
);


-- ---------------------------------------------------------------------------
-- ECOTOXICOLOGY — BIRDS AND MAMMALS DIETARY EXPOSURE ATTRIBUTES
-- (Source: EFSA Guidance on risk assessment for birds and mammals, 2009)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ecotox_bm_attributes (
    bm_attr_id              INTEGER PRIMARY KEY,
    crop_id                 INTEGER NOT NULL UNIQUE REFERENCES crops(crop_id) ON DELETE CASCADE,

    food_item_grain         INTEGER DEFAULT 0,
    food_item_green_plant   INTEGER DEFAULT 0,
    food_item_invertebrate  INTEGER DEFAULT 0,
    food_item_fruit         INTEGER DEFAULT 0,
    food_item_earthworm     INTEGER DEFAULT 0,

    dietary_fraction_source TEXT,              -- 'EFSA 2009 Table A', 'EFSA 2009 Table B', 'Measured'

    spray_exposure          INTEGER DEFAULT 1, -- BOOLEAN
    granule_exposure        INTEGER DEFAULT 0,
    seed_treatment_relevant INTEGER DEFAULT 0,

    notes                   TEXT
);


-- ---------------------------------------------------------------------------
-- ECOTOXICOLOGY — AQUATIC ERA CROP LINKAGE
-- (Source: EFSA PPR Panel Aquatic Guidance, 2013, doi:10.2903/j.efsa.2013.3290)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ecotox_aquatic_attributes (
    aquatic_attr_id         INTEGER PRIMARY KEY,
    crop_id                 INTEGER NOT NULL UNIQUE REFERENCES crops(crop_id) ON DELETE CASCADE,
    primary_entry_route     TEXT,                  -- 'Spray drift', 'Drainage', 'Runoff', 'Combined'
    relevant_waterbody      TEXT,                  -- 'Ditch', 'Stream', 'Pond'
    buffer_zone_relevant    INTEGER DEFAULT 1,     -- BOOLEAN
    notes                   TEXT
);


-- ---------------------------------------------------------------------------
-- ECOTOXICOLOGY — NON-TARGET PLANTS (NTP)
-- (Source: EPPO PP1/170; EFSA NTP guidance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ecotox_ntp_attributes (
    ntp_attr_id             INTEGER PRIMARY KEY,
    crop_id                 INTEGER NOT NULL UNIQUE REFERENCES crops(crop_id) ON DELETE CASCADE,
    is_test_species         INTEGER DEFAULT 0,     -- BOOLEAN
    is_representative       INTEGER DEFAULT 0,
    functional_group        TEXT,                  -- 'Monocot', 'Dicot', 'Grass'
    ntp_guidance_ref        TEXT,
    notes                   TEXT
);


-- ---------------------------------------------------------------------------
-- EFFICACY — EPPO PP1 STANDARDS
-- (Source: https://www.eppo.int/RESOURCES/eppo_standards/pp1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eppo_pp1_standards (
    pp1_id          INTEGER PRIMARY KEY,
    pp1_number      TEXT NOT NULL UNIQUE,  -- e.g. 'PP 1/135(4)'
    pp1_title       TEXT NOT NULL,
    pest_category   TEXT,                  -- 'Fungicide', 'Herbicide', 'Insecticide', 'Acaricide'
    target_organism TEXT,
    revision_date   TEXT,                  -- ISO 8601 date string e.g. '2021-03-15'
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS crop_pp1_links (
    crop_id             INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    pp1_id              INTEGER NOT NULL REFERENCES eppo_pp1_standards(pp1_id) ON DELETE CASCADE,
    is_primary_crop     INTEGER DEFAULT 1,  -- BOOLEAN; 0 if crop is an analogue in this standard
    analogue_rationale  TEXT,
    PRIMARY KEY (crop_id, pp1_id)
);


-- ---------------------------------------------------------------------------
-- CROSS-SECTION: CROP GROUPINGS FOR MRL EXTRAPOLATION
-- (Source: SANTE/2019/12752 MRL Extrapolation Guidelines)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sante_extrapolation_groups (
    extr_group_id           INTEGER PRIMARY KEY,
    group_name              TEXT NOT NULL UNIQUE,
    sante_table_ref         TEXT,
    representative_crop_id  INTEGER REFERENCES crops(crop_id),
    notes                   TEXT
);

CREATE TABLE IF NOT EXISTS sante_group_members (
    extr_group_id       INTEGER NOT NULL REFERENCES sante_extrapolation_groups(extr_group_id) ON DELETE CASCADE,
    crop_id             INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    is_representative   INTEGER DEFAULT 0,  -- BOOLEAN
    PRIMARY KEY (extr_group_id, crop_id)
);


-- ---------------------------------------------------------------------------
-- AUDIT / PROVENANCE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_sources (
    source_id       INTEGER PRIMARY KEY,
    source_name     TEXT NOT NULL,
    source_url      TEXT,
    version_label   TEXT,
    effective_date  TEXT,   -- ISO 8601 date string
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS crop_source_links (
    crop_id         INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    source_id       INTEGER NOT NULL REFERENCES data_sources(source_id) ON DELETE CASCADE,
    field_scope     TEXT,
    last_verified   TEXT,   -- ISO 8601 date string
    PRIMARY KEY (crop_id, source_id)
);

-- Seed: regulatory reference sources
INSERT OR IGNORE INTO data_sources (source_name, source_url, version_label, effective_date, notes)
VALUES
    ('EPPO Global Database',
     'https://gd.eppo.int',
     'Live (continuously updated)',
     NULL,
     'Primary source for EPPO 5-character codes, scientific names and taxonomy'),

    ('Regulation (EC) No 396/2005 Annex I',
     'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32005R0396',
     'As amended (check EUR-Lex for current consolidation)',
     '2005-02-23',
     'Legal basis for MRL commodity codes; Annex I is amended frequently'),

    ('Codex Alimentarius CAC/MISC 4',
     'https://www.fao.org/fao-who-codexalimentarius/codex-texts/en/',
     '2016 revision (check FAO for updates)',
     '2016-01-01',
     'International commodity classification for Codex MRL comparison'),

    ('EFSA PRIMo Rev 3.1',
     'https://www.efsa.europa.eu/en/applications/pesticides/tools',
     'Revision 3.1',
     NULL,
     'Mandatory for MRL applications until formal PRIMo 4 endorsement (~2026)'),

    ('EFSA PRIMo Rev 4',
     'https://www.efsa.europa.eu/en/applications/pesticides/tools',
     'Revision 4 (indicative)',
     NULL,
     'Online tool on EFSA R4EU platform; not yet endorsed for MRL applications'),

    ('FOCUS Surface Water Scenarios v1.4 + Repair Action 2020',
     'https://esdac.jrc.ec.europa.eu/projects/surface-water',
     'Generic Guidance v1.4 + EFSA 2020:6119',
     '2020-01-01',
     'Defines FOCUS SW crops, scenario-crop-waterbody combinations and BBCH interception'),

    ('FOCUS Groundwater Generic Guidance v2.4',
     'https://esdac.jrc.ec.europa.eu/projects/ground-water',
     'v2.4',
     '2024-01-01',
     'Applicable for submissions after 1 January 2024; defines GW crop parameterisation'),

    ('EFSA Bee Guidance Document',
     'https://doi.org/10.2903/j.efsa.2013.3295',
     '2013',
     '2013-01-01',
     'Defines representative crops and tiers for honeybee, bumblebee and solitary bee ERA'),

    ('EFSA Birds and Mammals Guidance',
     'https://doi.org/10.2903/j.efsa.2009.1438',
     '2009',
     '2009-01-01',
     'Defines crop-specific dietary fractions and food items for Tier 1 ERA'),

    ('SANTE/2019/12752 MRL Extrapolation Guidelines',
     'https://food.ec.europa.eu/plants/pesticides/maximum-residue-levels_en',
     '2019 (latest endorsed version — check SANTE for updates)',
     '2019-01-01',
     'Crop groupings and representative crop designations for MRL extrapolation'),

    ('EPPO PP1 Standards',
     'https://www.eppo.int/RESOURCES/eppo_standards/pp1',
     'Various revisions per standard',
     NULL,
     'Efficacy evaluation standards; each standard has its own revision history');


-- ---------------------------------------------------------------------------
-- HELPER VIEW: UNIFIED CROP OVERVIEW
-- ---------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_crop_overview AS
SELECT
    c.crop_id,
    c.common_name_en,
    c.scientific_name,
    pf.family_name                  AS plant_family,
    ct.type_name                    AS crop_type,
    ct.type_subgroup                AS crop_subtype,
    at2.annuality_name              AS annuality,
    c.is_food_crop,
    c.is_feed_crop,
    c.is_non_food,
    (SELECT eppo_code FROM eppo_codes ec
     WHERE ec.crop_id = c.crop_id AND ec.is_preferred = 1
     LIMIT 1)                       AS eppo_code,
    (SELECT r.annex1_code FROM reg396_commodities r
     WHERE r.crop_id = c.crop_id
     ORDER BY r.hierarchy_level DESC
     LIMIT 1)                       AS annex1_code,
    (SELECT fc.swash_crop_name FROM focus_crops fc
     WHERE fc.crop_id = c.crop_id
     LIMIT 1)                       AS focus_crop_name,
    (SELECT p.primo_name FROM primo_commodities p
     WHERE p.crop_id = c.crop_id AND p.primo_version = 'Rev 3.1'
     LIMIT 1)                       AS primo_rev31_name,
    c.notes
FROM crops c
LEFT JOIN plant_families pf   ON c.plant_family_id = pf.family_id
LEFT JOIN crop_types ct       ON c.crop_type_id = ct.crop_type_id
LEFT JOIN annuality_types at2 ON c.annuality_id = at2.annuality_id;


-- ---------------------------------------------------------------------------
-- HELPER VIEW: EFATE — FOCUS CROP x SCENARIO MATRIX
-- ---------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_focus_crop_scenarios AS
SELECT
    fc.swash_crop_name,
    fc.swash_crop_code,
    fc.crop_category,
    fs.scenario_name,
    fs.scenario_code,
    fst.scenario_type,
    fsl.waterbody_type,
    fsl.is_default_run,
    c.common_name_en        AS mapped_crop_name,
    c.scientific_name       AS mapped_scientific_name,
    e.eppo_code             AS mapped_eppo_code
FROM focus_crop_scenario_links fsl
JOIN focus_crops fc          ON fsl.focus_crop_id = fc.focus_crop_id
JOIN focus_scenarios fs      ON fsl.scenario_id = fs.scenario_id
JOIN focus_scenario_types fst ON fs.scenario_type_id = fst.scenario_type_id
LEFT JOIN crops c            ON fc.crop_id = c.crop_id
LEFT JOIN eppo_codes e       ON c.crop_id = e.crop_id AND e.is_preferred = 1;


-- ---------------------------------------------------------------------------
-- END OF SCHEMA
-- ---------------------------------------------------------------------------

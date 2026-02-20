-- =============================================================================
-- EU Plant Protection Product Risk Assessment — Crop Database Schema
-- =============================================================================
-- PostgreSQL 15+
--
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
--   5. All classification codes are stored as text to preserve leading zeros and
--      alphanumeric formats (e.g. Reg 396/2005 commodity code "0110010").
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


-- ---------------------------------------------------------------------------
-- SCHEMA
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS crop_db;
SET search_path TO crop_db;


-- ---------------------------------------------------------------------------
-- LOOKUP / REFERENCE TABLES
-- ---------------------------------------------------------------------------

-- Plant families (used across multiple sections, e.g. NTP ERA, residue groups)
CREATE TABLE plant_families (
    family_id       SERIAL PRIMARY KEY,
    family_name     TEXT NOT NULL UNIQUE,        -- e.g. 'Poaceae', 'Brassicaceae'
    common_name     TEXT,                         -- e.g. 'Grasses', 'Cabbages and mustards'
    notes           TEXT
);

-- Broad crop type categories — used to group and filter the core crop list
CREATE TABLE crop_types (
    crop_type_id    SERIAL PRIMARY KEY,
    type_name       TEXT NOT NULL UNIQUE,         -- e.g. 'Arable', 'Vegetable', 'Fruit'
    type_subgroup   TEXT,                         -- e.g. 'Root vegetable', 'Citrus', 'Stone fruit'
    notes           TEXT
);

-- Growth habit / annuality categories
CREATE TABLE annuality_types (
    annuality_id    SERIAL PRIMARY KEY,
    annuality_name  TEXT NOT NULL UNIQUE          -- 'Annual', 'Biennial', 'Perennial', 'Evergreen perennial'
);


-- ---------------------------------------------------------------------------
-- CORE CROP TABLE
-- ---------------------------------------------------------------------------
-- One row per crop concept. This table intentionally stays lean; all
-- classification details live in child tables. The common_name_en column
-- uses the EPPO preferred English name as the canonical label.

CREATE TABLE crops (
    crop_id             SERIAL PRIMARY KEY,
    common_name_en      TEXT NOT NULL,            -- Preferred English name (EPPO preferred)
    common_name_de      TEXT,
    common_name_fr      TEXT,
    scientific_name     TEXT,                     -- Binomial, most specific level available
    plant_family_id     INTEGER REFERENCES plant_families(family_id),
    crop_type_id        INTEGER REFERENCES crop_types(crop_type_id),
    annuality_id        INTEGER REFERENCES annuality_types(annuality_id),
    is_food_crop        BOOLEAN NOT NULL DEFAULT TRUE,
    is_feed_crop        BOOLEAN NOT NULL DEFAULT FALSE,
    is_non_food         BOOLEAN NOT NULL DEFAULT FALSE,  -- e.g. ornamentals, turf
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crops_common_name_unique UNIQUE (common_name_en, scientific_name)
);

COMMENT ON TABLE crops IS
    'Central crop reference table. One row per crop concept. All regulatory '
    'classification systems reference this table via crop_id. Use EPPO preferred '
    'English name as common_name_en.';


-- ---------------------------------------------------------------------------
-- EPPO CODES
-- (Source: EPPO Global Database — https://gd.eppo.int)
-- ---------------------------------------------------------------------------
-- A crop may have more than one EPPO code (e.g. genus-level + species-level
-- entries, or synonym codes for older submissions). One code is flagged preferred.

CREATE TABLE eppo_codes (
    eppo_code_id        SERIAL PRIMARY KEY,
    crop_id             INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    eppo_code           TEXT NOT NULL UNIQUE,     -- 5-character alphanumeric, e.g. 'TRZAW'
    eppo_name           TEXT NOT NULL,            -- EPPO preferred name for this code
    taxon_level         TEXT,                     -- 'Species', 'Genus', 'Family', 'Crop group'
    is_preferred        BOOLEAN NOT NULL DEFAULT TRUE,
    notes               TEXT
);

CREATE INDEX idx_eppo_codes_crop ON eppo_codes(crop_id);
CREATE INDEX idx_eppo_codes_code ON eppo_codes(eppo_code);

COMMENT ON TABLE eppo_codes IS
    'EPPO 5-character codes from the EPPO Global Database (gd.eppo.int). '
    'A single crop_id may have multiple EPPO codes (e.g. genus + species level). '
    'is_preferred = TRUE marks the primary code for display and cross-reference.';


-- ---------------------------------------------------------------------------
-- REGULATION (EC) No 396/2005 ANNEX I COMMODITIES
-- (MRL legal basis; also the reference list for dietary risk assessment)
-- ---------------------------------------------------------------------------
-- Annex I uses a numeric hierarchical code system (e.g. 0110000 = Citrus fruits,
-- 0110010 = Grapefruits, 0110020 = Mandarins). The code encodes the tree
-- structure. Level 1 = commodity group, Level 2 = subgroup, Level 3 = individual.

CREATE TABLE reg396_commodities (
    reg396_id               SERIAL PRIMARY KEY,
    crop_id                 INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    annex1_code             TEXT NOT NULL UNIQUE, -- e.g. '0110010' (preserve leading zeros)
    annex1_name             TEXT NOT NULL,        -- Official name from Annex I
    hierarchy_level         SMALLINT NOT NULL,    -- 1 = group, 2 = subgroup, 3 = individual
    parent_annex1_code      TEXT,                 -- Code of the parent row in the hierarchy
    is_mrl_group            BOOLEAN DEFAULT FALSE, -- TRUE if this is a crop group entry
    regulation_version      TEXT,                 -- e.g. 'Reg (EC) No 396/2005 as amended by Reg (EU) 2023/334'
    notes                   TEXT
);

CREATE INDEX idx_reg396_crop ON reg396_commodities(crop_id);
CREATE INDEX idx_reg396_code ON reg396_commodities(annex1_code);

COMMENT ON TABLE reg396_commodities IS
    'Annex I commodity list from Regulation (EC) No 396/2005 and its amendments. '
    'Provides the legal commodity codes used in MRL setting and consumer dietary '
    'risk assessment. The hierarchy_level and parent_annex1_code columns allow '
    'reconstruction of the Annex I tree structure for group MRL extrapolation.';


-- MRL Crop Groups (Annex I Part A/B grouping for extrapolation)
-- Separate table because a commodity can belong to multiple groups.
CREATE TABLE reg396_crop_groups (
    group_id        SERIAL PRIMARY KEY,
    group_code      TEXT NOT NULL UNIQUE,         -- e.g. 'Group 1 (Citrus fruits)'
    group_name      TEXT NOT NULL,
    group_level     TEXT,                         -- 'Major group', 'Sub-group'
    notes           TEXT
);

CREATE TABLE reg396_crop_group_members (
    group_id        INTEGER NOT NULL REFERENCES reg396_crop_groups(group_id) ON DELETE CASCADE,
    reg396_id       INTEGER NOT NULL REFERENCES reg396_commodities(reg396_id) ON DELETE CASCADE,
    is_representative BOOLEAN DEFAULT FALSE,      -- TRUE if crop is the representative for this group
    PRIMARY KEY (group_id, reg396_id)
);

COMMENT ON TABLE reg396_crop_groups IS
    'MRL crop grouping under Reg 396/2005. Groups define which commodities '
    'share an MRL and guide data extrapolation per SANTE/2019/12752 guidance.';


-- ---------------------------------------------------------------------------
-- CODEX ALIMENTARIUS COMMODITY CLASSIFICATION
-- (Source: CAC/MISC 4 — https://www.fao.org/fao-who-codexalimentarius)
-- ---------------------------------------------------------------------------
CREATE TABLE codex_commodities (
    codex_id            SERIAL PRIMARY KEY,
    crop_id             INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    codex_code          TEXT NOT NULL UNIQUE,     -- e.g. 'FC 0001' for citrus fruits (raw)
    codex_name          TEXT NOT NULL,            -- Official Codex commodity name
    codex_class         TEXT,                     -- 'Primary food commodity', 'Processed commodity'
    commodity_type      TEXT,                     -- 'FC', 'VO', 'VD', 'VR', etc. (Codex type prefix)
    codex_group         TEXT,                     -- e.g. 'Fruits', 'Vegetables', 'Cereals'
    notes               TEXT
);

CREATE INDEX idx_codex_crop ON codex_commodities(crop_id);

COMMENT ON TABLE codex_commodities IS
    'Codex Alimentarius commodity codes (CAC/MISC 4). Essential for comparing '
    'EU MRLs with international Codex MRLs and for import tolerance assessments.';


-- ---------------------------------------------------------------------------
-- EFSA PRIMo COMMODITY LIST
-- (Source: PRIMo Rev 3.1 Excel tool and PRIMo 4 online platform — efsa.europa.eu)
-- ---------------------------------------------------------------------------
-- PRIMo uses its own commodity list tied to EFSA food consumption data.
-- Rev 3.1 is the current mandatory version for MRL applications.
-- Rev 4 introduces Raw Primary Commodities (RPCs) and Raw Primary Commodity
-- Derivatives (RPCDs) and will be mandated for MRL applications from ~2026.

CREATE TABLE primo_commodities (
    primo_id            SERIAL PRIMARY KEY,
    crop_id             INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    primo_version       TEXT NOT NULL,            -- 'Rev 3.1' or 'Rev 4'
    primo_code          TEXT,                     -- Internal PRIMo commodity code
    primo_name          TEXT NOT NULL,            -- As displayed in PRIMo tool
    rpc_name            TEXT,                     -- Rev 4: Raw Primary Commodity name
    rpcd_name           TEXT,                     -- Rev 4: Processed derivative name
    unit_weight_g       NUMERIC(8,2),             -- Large portion unit weight (g) for IESTI
    processing_factor_available BOOLEAN DEFAULT FALSE,
    notes               TEXT,
    UNIQUE (primo_version, primo_name)
);

CREATE INDEX idx_primo_crop ON primo_commodities(crop_id);

COMMENT ON TABLE primo_commodities IS
    'Commodity list from the EFSA Pesticide Residue Intake Model (PRIMo). '
    'Stores entries for both Rev 3.1 (mandatory until ~2026) and Rev 4 (indicative). '
    'Linked to national food consumption data from the EFSA Comprehensive Food '
    'Consumption Database for dietary exposure calculations.';


-- ---------------------------------------------------------------------------
-- FOCUS SCENARIO DEFINITIONS
-- (Source: FOCUS SW v1.4 / GW Generic Guidance v2.4 — esdac.jrc.ec.europa.eu)
-- ---------------------------------------------------------------------------

CREATE TABLE focus_scenario_types (
    scenario_type_id    SERIAL PRIMARY KEY,
    scenario_type       TEXT NOT NULL UNIQUE      -- 'Surface water', 'Groundwater', 'Soil'
);

CREATE TABLE focus_scenarios (
    scenario_id         SERIAL PRIMARY KEY,
    scenario_type_id    INTEGER NOT NULL REFERENCES focus_scenario_types(scenario_type_id),
    scenario_name       TEXT NOT NULL UNIQUE,     -- e.g. 'D4 (Drainage)', 'R1 (Runoff)', 'Châteaudun'
    scenario_code       TEXT,                     -- Short code used in SWASH/PELMO e.g. 'D4', 'CHAT'
    country_location    TEXT,                     -- Approximate geographic location
    climate_zone        TEXT,                     -- e.g. 'Atlantic', 'Continental', 'Mediterranean'
    soil_type           TEXT,                     -- Brief soil characterisation
    assessment_step     TEXT,                     -- 'Step 3', 'Step 1', etc.
    model_tool          TEXT,                     -- 'MACRO', 'PRZM', 'PEARL', 'PELMO'
    notes               TEXT
);

COMMENT ON TABLE focus_scenarios IS
    'FOCUS surface water (10 scenarios) and groundwater (9 scenarios) standard '
    'scenario definitions. These are fixed regulatory inputs — the crop list '
    'valid for each scenario is defined in focus_crop_scenario_links.';

INSERT INTO focus_scenario_types (scenario_type) VALUES
    ('Surface water'),
    ('Groundwater'),
    ('Soil');

-- Surface water scenarios (FOCUS 2001, Repair Action 2020)
INSERT INTO focus_scenarios
    (scenario_type_id, scenario_name, scenario_code, country_location, climate_zone, model_tool, assessment_step)
VALUES
    (1, 'D1 Drainage (Brimstone)', 'D1', 'UK (South England)', 'Atlantic', 'MACRO', 'Step 3'),
    (1, 'D2 Drainage (Vredepeel)', 'D2', 'Netherlands', 'Atlantic', 'MACRO', 'Step 3'),
    (1, 'D3 Drainage (Lanna)', 'D3', 'Sweden', 'Northern Atlantic', 'MACRO', 'Step 3'),
    (1, 'D4 Drainage (Hamburg)', 'D4', 'Germany', 'Continental', 'MACRO', 'Step 3'),
    (1, 'D5 Drainage (Skousbo)', 'D5', 'Denmark', 'Atlantic', 'MACRO', 'Step 3'),
    (1, 'R1 Runoff (Roujan)', 'R1', 'France (Languedoc)', 'Mediterranean', 'PRZM', 'Step 3'),
    (1, 'R2 Runoff (Thiva)', 'R2', 'Greece', 'Mediterranean', 'PRZM', 'Step 3'),
    (1, 'R3 Runoff (Porto)', 'R3', 'Portugal', 'Mediterranean', 'PRZM', 'Step 3'),
    (1, 'R4 Runoff (Piacenza)', 'R4', 'Italy (Po Valley)', 'Continental', 'PRZM', 'Step 3'),
    (1, 'R5 Runoff (Kremsmünster)', 'R5', 'Austria', 'Continental', 'PRZM', 'Step 3');

-- Groundwater scenarios (FOCUS 2000, Generic Guidance v2.4)
INSERT INTO focus_scenarios
    (scenario_type_id, scenario_name, scenario_code, country_location, climate_zone, model_tool, assessment_step)
VALUES
    (2, 'Châteaudun', 'CHAT', 'France (north)', 'Atlantic-Continental', 'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Hamburg', 'HAMB', 'Germany', 'Continental', 'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Jokioinen', 'JOKI', 'Finland', 'Northern', 'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Kremsmünster', 'KREM', 'Austria', 'Continental', 'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Okehampton', 'OKEH', 'UK (SW England)', 'Atlantic', 'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Piacenza', 'PIAC', 'Italy', 'Continental', 'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Porto', 'PORT', 'Portugal', 'Mediterranean', 'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Sevilla', 'SEVI', 'Spain (south)', 'Mediterranean', 'MACRO/PEARL/PELMO', 'Step 3'),
    (2, 'Thiva', 'THIV', 'Greece', 'Mediterranean', 'MACRO/PEARL/PELMO', 'Step 3');


-- ---------------------------------------------------------------------------
-- FOCUS CROP DEFINITIONS
-- (Source: SWASH v5.3 crop table; EFSA 2014 crop interception guidance;
--          EFSA 2020 Surface Water Repair Action, Table 7)
-- ---------------------------------------------------------------------------
-- FOCUS crops are coarser than Reg 396/2005 commodities. 'Winter cereals' in
-- FOCUS maps to wheat, barley, rye, triticale, oats individually in Annex I.
-- The focus_crop_mappings junction table handles this many-to-many relationship.

CREATE TABLE focus_crops (
    focus_crop_id       SERIAL PRIMARY KEY,
    crop_id             INTEGER REFERENCES crops(crop_id),  -- NULL if no 1:1 crop mapping
    swash_crop_name     TEXT NOT NULL UNIQUE,  -- Name exactly as used in SWASH database
    swash_crop_code     TEXT,                  -- Short internal SWASH identifier
    crop_category       TEXT,                  -- 'Arable', 'Vegetable', 'Permanent', 'Grass'

    -- BBCH phenology reference windows (used by SWASH PAT for application timing)
    bbch_sowing_min     SMALLINT,              -- Earliest BBCH stage at sowing/emergence
    bbch_sowing_max     SMALLINT,
    bbch_harvest_min    SMALLINT,              -- Earliest BBCH stage at harvest
    bbch_harvest_max    SMALLINT,

    -- Canopy / application method attributes
    canopy_type         TEXT,                  -- 'Annual arable', 'Tall permanent', 'Low permanent'
    ground_spray_possible BOOLEAN DEFAULT FALSE, -- Relevant for tall permanent crops (Repair Action 2020)

    -- Root parameters (used in groundwater and soil PEC calculations)
    root_depth_m        NUMERIC(4,2),          -- Maximum rooting depth (m)
    lai_max             NUMERIC(4,2),          -- Maximum leaf area index

    notes               TEXT
);

COMMENT ON TABLE focus_crops IS
    'FOCUS crop definitions as parameterised in the SWASH shell and FOCUS model '
    'input files. BBCH windows define application timing bounds per crop. '
    'Canopy type governs spray drift calculator settings (SWAN/SWASH).';

-- Interception values per FOCUS crop × BBCH stage (Table 7, EFSA 2020)
CREATE TABLE focus_crop_interception (
    interception_id     SERIAL PRIMARY KEY,
    focus_crop_id       INTEGER NOT NULL REFERENCES focus_crops(focus_crop_id) ON DELETE CASCADE,
    bbch_stage          SMALLINT NOT NULL,         -- BBCH growth stage code
    interception_pct    NUMERIC(5,2),              -- Canopy interception (%) at this BBCH stage
    interception_source TEXT,                      -- 'EFSA 2014', 'EFSA 2020 Repair Action'
    notes               TEXT,
    UNIQUE (focus_crop_id, bbch_stage)
);

COMMENT ON TABLE focus_crop_interception IS
    'BBCH-stage-dependent canopy interception values for each FOCUS crop, '
    'sourced from EFSA (2014) as updated by the EFSA Surface Water Repair Action '
    '(EFSA Journal 2020;18(8):6119). Used by SWASH to calculate spray drift entry '
    'and drainage/runoff loadings at the intended application date.';

-- Valid crop × scenario combinations (which crops run in which scenarios)
CREATE TABLE focus_crop_scenario_links (
    link_id             SERIAL PRIMARY KEY,
    focus_crop_id       INTEGER NOT NULL REFERENCES focus_crops(focus_crop_id) ON DELETE CASCADE,
    scenario_id         INTEGER NOT NULL REFERENCES focus_scenarios(scenario_id) ON DELETE CASCADE,
    waterbody_type      TEXT,                  -- 'Drainage ditch', 'Stream', 'Pond'
    is_default_run      BOOLEAN DEFAULT TRUE,  -- FALSE if combination is non-standard
    notes               TEXT,
    UNIQUE (focus_crop_id, scenario_id, waterbody_type)
);

COMMENT ON TABLE focus_crop_scenario_links IS
    'Maps which FOCUS crop is valid for which scenario and waterbody type. '
    'In SWASH, the FOCUS wizard only presents valid combinations. '
    'This table replicates the SWASH valid-combinations logic for application-level querying.';

-- FOCUS SW scenario weather/location and climate (Generic FOCUS SWS v1.4, Table 4.1.2-1, ES-1)
CREATE TABLE focus_sw_scenario_characteristics (
    scenario_id                     INTEGER PRIMARY KEY REFERENCES focus_scenarios(scenario_id) ON DELETE CASCADE,
    scenario_code                   TEXT NOT NULL UNIQUE,
    weather_dataset_name            TEXT NOT NULL,
    latitude_deg                    NUMERIC(6,4),
    longitude_deg                   NUMERIC(7,4),
    mean_annual_temp_c              NUMERIC(4,2),
    annual_rainfall_mm              NUMERIC(6,1),
    topsoil_texture                 TEXT,
    topsoil_organic_carbon_pct      NUMERIC(4,2),
    slope_pct                       TEXT,
    water_bodies                    TEXT,
    source_reference                TEXT
);

COMMENT ON TABLE focus_sw_scenario_characteristics IS
    'Weather dataset, location and climate for each FOCUS surface water scenario (D1–D6, R1–R4). '
    'Source: Generic FOCUS SWS v1.4 (May 2015), Tables 4.1.2-1 and ES-1.';

-- Average annual irrigation (mm) per FOCUS SW crop × scenario (Tables 4.1.4-1, 4.1.4-2)
CREATE TABLE focus_crop_scenario_irrigation (
    focus_crop_id       INTEGER NOT NULL REFERENCES focus_crops(focus_crop_id) ON DELETE CASCADE,
    scenario_id         INTEGER NOT NULL REFERENCES focus_scenarios(scenario_id) ON DELETE CASCADE,
    irrigation_mm_annual NUMERIC(6,1) NOT NULL,
    source_reference    TEXT,
    PRIMARY KEY (focus_crop_id, scenario_id)
);

CREATE INDEX idx_focus_crop_scenario_irrigation_scenario ON focus_crop_scenario_irrigation(scenario_id);

COMMENT ON TABLE focus_crop_scenario_irrigation IS
    'Average annual irrigation (mm) per crop × scenario. 0 = present but not irrigated. '
    'Source: Generic FOCUS SWS v1.4 Tables 4.1.4-1 (drainage), 4.1.4-2 (runoff).';

-- Many-to-many: FOCUS coarse crops → individual Reg 396 commodities
-- e.g. FOCUS 'Winter cereals' → wheat (0140010), barley (0140020), rye (0140040), etc.
CREATE TABLE focus_crop_reg396_mappings (
    focus_crop_id       INTEGER NOT NULL REFERENCES focus_crops(focus_crop_id) ON DELETE CASCADE,
    reg396_id           INTEGER NOT NULL REFERENCES reg396_commodities(reg396_id) ON DELETE CASCADE,
    mapping_rationale   TEXT,                  -- e.g. 'Direct match', 'Analogue crop', 'Group representative'
    PRIMARY KEY (focus_crop_id, reg396_id)
);

COMMENT ON TABLE focus_crop_reg396_mappings IS
    'Resolves the granularity mismatch between FOCUS crop definitions (coarse) '
    'and Reg 396/2005 Annex I commodities (fine). For example, FOCUS ''Winter cereals'' '
    'maps to multiple individual Annex I entries. Essential for linking efate '
    'outputs to residue/dietary risk assessment inputs.';


-- ---------------------------------------------------------------------------
-- EFATE ADDITIONAL ATTRIBUTES
-- ---------------------------------------------------------------------------
CREATE TABLE efate_crop_attributes (
    efate_attr_id       SERIAL PRIMARY KEY,
    crop_id             INTEGER NOT NULL UNIQUE REFERENCES crops(crop_id) ON DELETE CASCADE,

    -- Soil exposure (EFSA 2017 soil PEC guidance; PERSAM tool)
    soil_pec_applicable     BOOLEAN DEFAULT TRUE,
    soil_app_depth_cm       NUMERIC(5,1),          -- Soil incorporation depth (cm)

    -- Crop residue / incorporation attributes (relevant for degradation in soil)
    harvest_residue_fraction NUMERIC(4,3),         -- Fraction of above-ground biomass left post-harvest

    -- Sediment exposure
    sediment_relevant       BOOLEAN DEFAULT FALSE, -- TRUE for paddy rice, wetland crops

    -- Crop interception grouping (FOCUS GW Table 1.6 / EFSA 2014)
    gw_interception_group   TEXT,                  -- e.g. 'Cereals', 'Root crops', 'Fruit trees'

    notes                   TEXT
);

COMMENT ON TABLE efate_crop_attributes IS
    'Additional environmental fate attributes not captured in focus_crops. '
    'Covers soil PEC (EFSA 2017 guidance), sediment relevance, '
    'and FOCUS groundwater interception grouping.';


-- ---------------------------------------------------------------------------
-- ECOTOXICOLOGY — BEE EXPOSURE ATTRIBUTES
-- (Source: EFSA Bee Guidance Document, 2013, doi:10.2903/j.efsa.2013.3295)
-- ---------------------------------------------------------------------------
CREATE TABLE ecotox_bee_attributes (
    bee_attr_id             SERIAL PRIMARY KEY,
    crop_id                 INTEGER NOT NULL UNIQUE REFERENCES crops(crop_id) ON DELETE CASCADE,

    -- Flowering relevance
    is_flowering_crop       BOOLEAN NOT NULL DEFAULT FALSE,
    typical_flowering_months TEXT,                 -- e.g. 'April–June'
    pollen_producing        BOOLEAN DEFAULT FALSE,
    nectar_producing        BOOLEAN DEFAULT FALSE,

    -- Honeybee foraging relevance
    bee_attractive          BOOLEAN DEFAULT FALSE, -- Overall attractiveness to bees
    bee_guidance_tier       TEXT,                  -- Tier at which bee assessment is required: 'Tier 1', 'Tier 2', 'Field study'

    -- Bumblebee and solitary bee relevance
    relevant_bumblebee      BOOLEAN DEFAULT FALSE,
    relevant_solitary_bee   BOOLEAN DEFAULT FALSE,

    -- Guttation / seed treatment relevance
    guttation_relevant      BOOLEAN DEFAULT FALSE,
    typical_sowing_months   TEXT,

    -- Bee guidance representative crop status
    is_bee_guidance_rep_crop BOOLEAN DEFAULT FALSE, -- TRUE if listed as representative in EFSA Bee Guidance Appendix
    bee_guidance_crop_label  TEXT,                  -- Label used in EFSA Bee Guidance (may differ from crops.common_name_en)

    notes                   TEXT
);

COMMENT ON TABLE ecotox_bee_attributes IS
    'Bee-relevant crop attributes per the EFSA Bee Guidance Document (2013). '
    'Controls which crops require a honeybee, bumblebee or solitary bee ERA, '
    'and at what tier. is_bee_guidance_rep_crop marks crops explicitly named '
    'in the Guidance appendix (e.g. oilseed rape, apple, sunflower, maize).';


-- ---------------------------------------------------------------------------
-- ECOTOXICOLOGY — BIRDS AND MAMMALS DIETARY EXPOSURE ATTRIBUTES
-- (Source: EFSA Guidance on risk assessment for birds and mammals, 2009)
-- ---------------------------------------------------------------------------
CREATE TABLE ecotox_bm_attributes (
    bm_attr_id              SERIAL PRIMARY KEY,
    crop_id                 INTEGER NOT NULL UNIQUE REFERENCES crops(crop_id) ON DELETE CASCADE,

    -- Relevant food items available to birds/mammals on this crop
    -- (aligns with EFSA 2009 Table 3.1 and associated dietary fraction lookup tables)
    food_item_grain         BOOLEAN DEFAULT FALSE,  -- Grain / seed
    food_item_green_plant   BOOLEAN DEFAULT FALSE,  -- Green plant material
    food_item_invertebrate  BOOLEAN DEFAULT FALSE,  -- Soil / above-ground invertebrates
    food_item_fruit         BOOLEAN DEFAULT FALSE,
    food_item_earthworm     BOOLEAN DEFAULT FALSE,

    -- Residue concentration in food items (Tier 1 uses crop field residue data)
    -- These reference the EFSA 2009 lookup tables, not absolute values
    dietary_fraction_source TEXT,              -- 'EFSA 2009 Table A', 'EFSA 2009 Table B', 'Measured'

    -- Exposure scenario relevance
    spray_exposure          BOOLEAN DEFAULT TRUE,
    granule_exposure        BOOLEAN DEFAULT FALSE,   -- Relevant for granular formulations
    seed_treatment_relevant BOOLEAN DEFAULT FALSE,

    notes                   TEXT
);

COMMENT ON TABLE ecotox_bm_attributes IS
    'Birds and mammals dietary exposure attributes per EFSA (2009) guidance. '
    'Defines which food matrix (grain, green plant, invertebrate, etc.) is relevant '
    'for each crop, driving the dietary fraction lookup in Tier 1 risk assessment.';


-- ---------------------------------------------------------------------------
-- ECOTOXICOLOGY — AQUATIC ERA CROP LINKAGE
-- (Source: EFSA PPR Panel Aquatic Guidance, 2013, doi:10.2903/j.efsa.2013.3290)
-- ---------------------------------------------------------------------------
-- Aquatic ERA crop relevance is primarily governed by FOCUS SW scenario/crop
-- combinations (covered in focus_crop_scenario_links above). This table captures
-- additional crop-level attributes used in the aquatic ERA.

CREATE TABLE ecotox_aquatic_attributes (
    aquatic_attr_id         SERIAL PRIMARY KEY,
    crop_id                 INTEGER NOT NULL UNIQUE REFERENCES crops(crop_id) ON DELETE CASCADE,
    primary_entry_route     TEXT,                  -- 'Spray drift', 'Drainage', 'Runoff', 'Combined'
    relevant_waterbody      TEXT,                  -- 'Ditch', 'Stream', 'Pond' (dominant for this crop)
    buffer_zone_relevant    BOOLEAN DEFAULT TRUE,  -- Whether mitigation buffer zones apply
    notes                   TEXT
);


-- ---------------------------------------------------------------------------
-- ECOTOXICOLOGY — NON-TARGET PLANTS (NTP)
-- (Source: EPPO PP1/170; EFSA NTP guidance)
-- ---------------------------------------------------------------------------
CREATE TABLE ecotox_ntp_attributes (
    ntp_attr_id             SERIAL PRIMARY KEY,
    crop_id                 INTEGER NOT NULL UNIQUE REFERENCES crops(crop_id) ON DELETE CASCADE,
    is_test_species         BOOLEAN DEFAULT FALSE,  -- Used in standard NTP lab tests
    is_representative       BOOLEAN DEFAULT FALSE,  -- Representative crop for NTP ERA
    functional_group        TEXT,                   -- 'Monocot', 'Dicot', 'Grass'
    ntp_guidance_ref        TEXT,                   -- Relevant EPPO/EFSA guidance document
    notes                   TEXT
);


-- ---------------------------------------------------------------------------
-- EFFICACY — EPPO PP1 STANDARDS
-- (Source: https://www.eppo.int/RESOURCES/eppo_standards/pp1)
-- ---------------------------------------------------------------------------
CREATE TABLE eppo_pp1_standards (
    pp1_id              SERIAL PRIMARY KEY,
    pp1_number          TEXT NOT NULL UNIQUE,  -- e.g. 'PP 1/135(4)'
    pp1_title           TEXT NOT NULL,         -- Full standard title
    pest_category       TEXT,                  -- 'Fungicide', 'Herbicide', 'Insecticide', 'Acaricide'
    target_organism     TEXT,                  -- Specific pest/pathogen/weed targeted
    revision_date       DATE,
    notes               TEXT
);

COMMENT ON TABLE eppo_pp1_standards IS
    'EPPO PP1 efficacy evaluation standards. Each standard defines the '
    'experimental design, trial conditions and evaluation criteria for '
    'one pest/PPP category. Linked to crops via crop_pp1_links.';

CREATE TABLE crop_pp1_links (
    crop_id             INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    pp1_id              INTEGER NOT NULL REFERENCES eppo_pp1_standards(pp1_id) ON DELETE CASCADE,
    is_primary_crop     BOOLEAN DEFAULT TRUE,  -- FALSE if crop is an analogue in this standard
    analogue_rationale  TEXT,                  -- Explanation if is_primary_crop = FALSE
    PRIMARY KEY (crop_id, pp1_id)
);

COMMENT ON TABLE crop_pp1_links IS
    'Many-to-many link between crops and EPPO PP1 efficacy standards. '
    'A crop may be covered by multiple standards (e.g. wheat appears in '
    'standards for Septoria, rusts, aphids, broadleaf weeds, grass weeds). '
    'A standard may cover multiple crops as primary or analogue species.';


-- ---------------------------------------------------------------------------
-- CROSS-SECTION: CROP GROUPINGS FOR MRL EXTRAPOLATION
-- (Source: SANTE/2019/12752 MRL Extrapolation Guidelines)
-- ---------------------------------------------------------------------------
-- These are additional groupings beyond the Reg 396/2005 Annex I structure,
-- used when supporting data are extrapolated from a representative crop to
-- analogous crops within the group.

CREATE TABLE sante_extrapolation_groups (
    extr_group_id       SERIAL PRIMARY KEY,
    group_name          TEXT NOT NULL UNIQUE,      -- e.g. 'Root and tuber vegetables (group 1)'
    sante_table_ref     TEXT,                      -- Table reference within SANTE/2019/12752
    representative_crop_id INTEGER REFERENCES crops(crop_id),
    notes               TEXT
);

CREATE TABLE sante_group_members (
    extr_group_id       INTEGER NOT NULL REFERENCES sante_extrapolation_groups(extr_group_id) ON DELETE CASCADE,
    crop_id             INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    is_representative   BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (extr_group_id, crop_id)
);

COMMENT ON TABLE sante_extrapolation_groups IS
    'Crop groups defined in SANTE/2019/12752 for MRL extrapolation purposes. '
    'Distinct from Reg 396/2005 Annex I groups — these are used by applicants '
    'when setting MRLs for a group based on residue data from the representative crop.';


-- ---------------------------------------------------------------------------
-- AUDIT / PROVENANCE
-- ---------------------------------------------------------------------------
-- Records the source and version for each classification entry, allowing the
-- database to track when a code list was last updated against its source document.

CREATE TABLE data_sources (
    source_id       SERIAL PRIMARY KEY,
    source_name     TEXT NOT NULL,             -- e.g. 'EPPO Global Database'
    source_url      TEXT,
    version_label   TEXT,                      -- e.g. 'Rev 3.1', '2024 amendment'
    effective_date  DATE,                      -- Date from which this version applies
    notes           TEXT
);

CREATE TABLE crop_source_links (
    crop_id         INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE CASCADE,
    source_id       INTEGER NOT NULL REFERENCES data_sources(source_id) ON DELETE CASCADE,
    field_scope     TEXT,                      -- Which fields/tables this source covers
    last_verified   DATE,
    PRIMARY KEY (crop_id, source_id)
);

INSERT INTO data_sources (source_name, source_url, version_label, effective_date, notes)
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
-- Provides a single queryable view joining core crop data with its primary
-- EPPO code, Reg 396 commodity code and FOCUS crop name for quick lookups.

CREATE VIEW v_crop_overview AS
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
    -- Primary EPPO code
    (SELECT eppo_code FROM eppo_codes ec
     WHERE ec.crop_id = c.crop_id AND ec.is_preferred = TRUE
     LIMIT 1)                       AS eppo_code,
    -- Primary Reg 396 Annex I code
    (SELECT r.annex1_code FROM reg396_commodities r
     WHERE r.crop_id = c.crop_id
     ORDER BY r.hierarchy_level DESC
     LIMIT 1)                       AS annex1_code,
    -- FOCUS crop name (if applicable)
    (SELECT fc.swash_crop_name FROM focus_crops fc
     WHERE fc.crop_id = c.crop_id
     LIMIT 1)                       AS focus_crop_name,
    -- PRIMo Rev 3.1 name
    (SELECT p.primo_name FROM primo_commodities p
     WHERE p.crop_id = c.crop_id AND p.primo_version = 'Rev 3.1'
     LIMIT 1)                       AS primo_rev31_name,
    c.notes
FROM crops c
LEFT JOIN plant_families pf  ON c.plant_family_id = pf.family_id
LEFT JOIN crop_types ct      ON c.crop_type_id = ct.crop_type_id
LEFT JOIN annuality_types at2 ON c.annuality_id = at2.annuality_id;

COMMENT ON VIEW v_crop_overview IS
    'Convenience view joining the most commonly queried cross-section of crop '
    'data. Use this for general lookups; query the underlying tables directly '
    'for section-specific attributes.';


-- ---------------------------------------------------------------------------
-- HELPER VIEW: EFATE — FOCUS CROP × SCENARIO MATRIX
-- ---------------------------------------------------------------------------
CREATE VIEW v_focus_crop_scenarios AS
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
LEFT JOIN eppo_codes e       ON c.crop_id = e.crop_id AND e.is_preferred = TRUE;

COMMENT ON VIEW v_focus_crop_scenarios IS
    'Replicates the SWASH valid crop–scenario–waterbody combination matrix. '
    'Useful for validating user-submitted GAPs against appropriate FOCUS scenarios.';


-- ---------------------------------------------------------------------------
-- INDEXES (beyond those already created inline)
-- ---------------------------------------------------------------------------
CREATE INDEX idx_crops_common_name ON crops(common_name_en);
CREATE INDEX idx_crops_scientific  ON crops(scientific_name);
CREATE INDEX idx_focus_crops_name  ON focus_crops(swash_crop_name);
CREATE INDEX idx_reg396_hierarchy  ON reg396_commodities(hierarchy_level, parent_annex1_code);
CREATE INDEX idx_primo_version     ON primo_commodities(primo_version);

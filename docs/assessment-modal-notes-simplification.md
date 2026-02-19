# Assessment Modal: Simplified to Assessment Notes

## Summary

The section-specific fields in the Assessment Modal were replaced with a single **Assessment Notes** textarea. This is a temporary simplification to allow the field requirements for each section to be properly thought through before implementation.

## What Changed

**File:** `src/components/AssessmentModal.tsx`

### Before

Each regulatory section had its own set of tailored input fields defined in a `SECTION_FIELDS` map. For example:

- **Aquatics** — TER Fish/Daphnia/Algae values, FOCUS Step, Buffer Zone, Mitigation Measures
- **Groundwater** — Parent/Metabolite PEC values, FOCUS Scenarios, Lysimeter Study status
- **Bees** — HQ Oral/Contact, Assessment Tier, Higher Tier Studies
- **Birds & Mammals** — TER values for birds and mammals, Focal Species, Mitigation
- **Operator/Worker/Resident-Bystander** — % AOEL values, PPE, Re-entry Interval, Buffer
- **Residue Studies** — Trial counts, MRL Proposal, Crops Covered
- **Consumer (Chronic/Acute)** — % ADI / % ARfD, Dietary Model, Critical Commodity

These were rendered as a mix of `text`, `number`, `select`, and `textarea` inputs in a two-column grid under the **Assessment Details** heading.

### After

All section-specific fields removed. Replaced with a single **Assessment Notes** textarea under a matching label — consistent for every section.

Data is stored under `details.notes` in the `SectionAssessment` object, which is the same key used by the previous default fallback, so any existing notes will load correctly.

## Data Compatibility

| Field | Before | After |
|---|---|---|
| Storage key | `details.<field_key>` (varies per section) | `details.notes` |
| Existing notes | Preserved if already stored as `notes` | Loads correctly |
| Section-specific values | Stored but no longer captured | Not persisted (fields removed) |

> **Note:** Any section-specific numeric/select values previously saved will remain in the stored data object but will no longer be displayed or editable via the modal.

## Intent

This is a placeholder state. The goal is to revisit each section and design fields that are genuinely useful and well-considered for the regulatory science workflow, rather than having placeholder fields that don't reflect real assessment needs.

## Revisiting

When ready to restore section-specific fields:

1. Re-introduce the `FieldDef` interface and `SECTION_FIELDS` map in `AssessmentModal.tsx`
2. Restore the `details` state (replacing the current `notes` state)
3. Re-render the grid of fields under **Assessment Details**
4. Consider whether field values should be surfaced anywhere else in the UI (e.g. the product page summary tabs)

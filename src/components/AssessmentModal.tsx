"use client";

import { useState } from "react";
import {
  RiskLevel,
  RISK_LEVEL_CONFIG,
  SectionAssessment,
} from "@/lib/types";

const RISK_OPTIONS: RiskLevel[] = [
  "not-started",
  "pass",
  "pass-with-mitigation",
  "refinement-needed",
  "fail",
  "critical",
];

const RISK_OPTION_DOT: Record<RiskLevel, string> = {
  "not-started": "bg-gray-300",
  pass: "bg-green-500",
  "pass-with-mitigation": "bg-lime-500",
  "refinement-needed": "bg-amber-500",
  fail: "bg-red-500",
  critical: "bg-red-800",
};

// Section-specific field definitions
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  options?: string[];
  placeholder?: string;
  unit?: string;
}

const SECTION_FIELDS: Record<string, FieldDef[]> = {
  aquatics: [
    { key: "ter_fish_t1", label: "TER Fish (Tier 1)", type: "number", placeholder: "e.g. 12.5" },
    { key: "ter_daphnia_t1", label: "TER Daphnia (Tier 1)", type: "number", placeholder: "e.g. 105" },
    { key: "ter_algae_t1", label: "TER Algae (Tier 1)", type: "number", placeholder: "e.g. 250" },
    { key: "focus_step", label: "FOCUS Step Required", type: "select", options: ["None", "Step 1", "Step 2", "Step 3", "Step 4"] },
    { key: "buffer_zone", label: "Buffer Zone", type: "text", placeholder: "e.g. 20m" },
    { key: "mitigation", label: "Mitigation Measures", type: "textarea", placeholder: "SPe statements, drift reduction, etc." },
  ],
  groundwater: [
    { key: "parent_pec", label: "Parent PEC GW (ug/L)", type: "number", placeholder: "e.g. 0.05" },
    { key: "metabolite_name", label: "Key Metabolite", type: "text", placeholder: "e.g. M700F007" },
    { key: "metabolite_pec", label: "Metabolite PEC GW (ug/L)", type: "number", placeholder: "e.g. 0.12" },
    { key: "scenarios_pass", label: "FOCUS Scenarios Passing", type: "text", placeholder: "e.g. 6/9" },
    { key: "lysimeter", label: "Lysimeter Study", type: "select", options: ["Not Required", "Available", "Ongoing", "Planned"] },
  ],
  bees: [
    { key: "hq_oral", label: "HQ Oral", type: "number", placeholder: "e.g. 0.02" },
    { key: "hq_contact", label: "HQ Contact", type: "number", placeholder: "e.g. 0.01" },
    { key: "tier", label: "Assessment Tier", type: "select", options: ["Tier 1", "Tier 2", "Tier 3"] },
    { key: "higher_tier", label: "Higher Tier Studies", type: "textarea", placeholder: "Tunnel studies, field studies, etc." },
  ],
  "birds-mammals": [
    { key: "ter_bird_acute", label: "TER Birds (Acute)", type: "number", placeholder: "e.g. 15.2" },
    { key: "ter_bird_chronic", label: "TER Birds (Chronic)", type: "number", placeholder: "e.g. 8.5" },
    { key: "ter_mammal_acute", label: "TER Mammals (Acute)", type: "number", placeholder: "e.g. 45" },
    { key: "ter_mammal_chronic", label: "TER Mammals (Chronic)", type: "number", placeholder: "e.g. 12" },
    { key: "focal_species", label: "Focal Species", type: "text", placeholder: "e.g. Skylark, Wood mouse" },
    { key: "mitigation", label: "Mitigation", type: "textarea", placeholder: "SPe5, application restrictions, etc." },
  ],
  operator: [
    { key: "aoel_pct", label: "% AOEL (Operator)", type: "number", placeholder: "e.g. 45", unit: "%" },
    { key: "exposure_model", label: "Exposure Model", type: "select", options: ["EFSA Calculator", "German BfR Model", "UK POEM", "Other"] },
    { key: "ppe", label: "PPE Required", type: "text", placeholder: "e.g. Gloves during mixing/loading" },
    { key: "application_method", label: "Application Method", type: "select", options: ["Tractor-mounted sprayer", "Knapsack", "Seed treatment", "Granule applicator"] },
  ],
  worker: [
    { key: "aoel_pct", label: "% AOEL (Worker)", type: "number", placeholder: "e.g. 28", unit: "%" },
    { key: "rei", label: "Re-entry Interval", type: "text", placeholder: "e.g. 48h" },
    { key: "activity", label: "Worker Activity", type: "text", placeholder: "e.g. Inspection, harvesting" },
  ],
  "resident-bystander": [
    { key: "aoel_pct_resident", label: "% AOEL (Resident)", type: "number", placeholder: "e.g. 15", unit: "%" },
    { key: "aoel_pct_bystander", label: "% AOEL (Bystander)", type: "number", placeholder: "e.g. 8", unit: "%" },
    { key: "buffer_required", label: "Buffer Required", type: "select", options: ["None", "5m", "10m", "20m", "50m"] },
  ],
  "residue-studies": [
    { key: "trials_north", label: "Northern EU Trials", type: "number", placeholder: "e.g. 8" },
    { key: "trials_south", label: "Southern EU Trials", type: "number", placeholder: "e.g. 8" },
    { key: "mrl_proposal", label: "MRL Proposal (mg/kg)", type: "number", placeholder: "e.g. 0.3" },
    { key: "crops", label: "Crops Covered", type: "text", placeholder: "e.g. Cereals, oilseed rape" },
  ],
  "consumer-chronic": [
    { key: "adi_pct", label: "% ADI", type: "number", placeholder: "e.g. 12", unit: "%" },
    { key: "model", label: "Dietary Model", type: "select", options: ["EFSA PRIMo rev.3", "EFSA PRIMo rev.4", "National model"] },
    { key: "critical_commodity", label: "Critical Commodity", type: "text", placeholder: "e.g. Wheat grain" },
  ],
  "consumer-acute": [
    { key: "arfd_pct", label: "% ARfD", type: "number", placeholder: "e.g. 35", unit: "%" },
    { key: "critical_commodity", label: "Critical Commodity", type: "text", placeholder: "e.g. Cereals" },
  ],
};

// Default fields for sections without specific fields defined
const DEFAULT_FIELDS: FieldDef[] = [
  { key: "notes", label: "Assessment Notes", type: "textarea", placeholder: "Enter assessment details..." },
];

export default function AssessmentModal({
  sectionId,
  sectionName,
  assessment,
  onClose,
  onSave,
}: {
  sectionId: string;
  sectionName: string;
  assessment?: SectionAssessment;
  onClose: () => void;
  onSave: (data: SectionAssessment) => void;
}) {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(
    assessment?.riskLevel || "not-started"
  );
  const [summary, setSummary] = useState(assessment?.summary || "");
  const [assessor, setAssessor] = useState(assessment?.assessor || "");
  const [details, setDetails] = useState<Record<string, string | number>>(
    (assessment?.details as Record<string, string | number>) || {}
  );

  const fields = SECTION_FIELDS[sectionId] || DEFAULT_FIELDS;

  function handleSave() {
    onSave({
      sectionId,
      riskLevel,
      summary,
      assessor,
      lastUpdated: new Date().toISOString().split("T")[0],
      details: Object.keys(details).length > 0 ? details : undefined,
    });
    onClose();
  }

  function updateDetail(key: string, value: string | number) {
    setDetails((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {sectionName}
              </h3>
              <p className="text-sm text-muted">Edit risk assessment</p>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-foreground text-xl leading-none"
            >
              x
            </button>
          </div>

          {/* Risk Level Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Risk Level
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RISK_OPTIONS.map((level) => {
                const cfg = RISK_LEVEL_CONFIG[level];
                const selected = riskLevel === level;
                return (
                  <button
                    key={level}
                    onClick={() => setRiskLevel(level)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      selected
                        ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color}`
                        : "bg-gray-50 border-gray-200 text-muted hover:bg-gray-100"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${RISK_OPTION_DOT[level]}`}
                    />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assessor */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">
              Assessor
            </label>
            <input
              type="text"
              value={assessor}
              onChange={(e) => setAssessor(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Section-specific fields */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-foreground mb-3">
              Assessment Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={field.type === "textarea" ? "sm:col-span-2" : ""}
                >
                  <label className="block text-xs font-medium text-muted mb-1">
                    {field.label}
                    {field.unit && (
                      <span className="text-muted"> ({field.unit})</span>
                    )}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={(details[field.key] as string) || ""}
                      onChange={(e) => updateDetail(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={(details[field.key] as string) || ""}
                      onChange={(e) => updateDetail(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={(details[field.key] as string) || ""}
                      onChange={(e) =>
                        updateDetail(
                          field.key,
                          field.type === "number"
                            ? e.target.value
                            : e.target.value
                        )
                      }
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-1">
              Summary / Recommendation
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Summarise the risk assessment outcome and any recommendations..."
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Save Assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

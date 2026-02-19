"use client";

import { useState } from "react";
import {
  CountryUse,
  GAPUse,
  RiskLevel,
  RISK_LEVEL_CONFIG,
  SectionAssessment,
} from "@/lib/types";
import { getSectionName } from "@/lib/helpers";
import RiskBadge from "./RiskBadge";

const COUNTRY_NAMES: Record<string, string> = {
  IE: "Ireland",
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  PL: "Poland",
  NL: "Netherlands",
  BE: "Belgium",
  ES: "Spain",
  IT: "Italy",
  GR: "Greece",
  PT: "Portugal",
  CZ: "Czech Republic",
  HU: "Hungary",
  RO: "Romania",
  AT: "Austria",
  SE: "Sweden",
  DK: "Denmark",
  FI: "Finland",
  SK: "Slovakia",
  SI: "Slovenia",
};

const RISK_SEVERITY: Record<RiskLevel, number> = {
  critical: 5,
  fail: 4,
  "refinement-needed": 3,
  "pass-with-mitigation": 2,
  pass: 1,
  "not-started": 0,
};

function deriveUseOutcome(
  useId: string,
  assessments: SectionAssessment[]
): RiskLevel {
  const outcomes = assessments
    .map((a) => a.useOutcomes?.[useId])
    .filter((o): o is RiskLevel => o !== undefined);
  if (outcomes.length === 0) return "not-started";
  return outcomes.reduce((worst, o) =>
    RISK_SEVERITY[o] > RISK_SEVERITY[worst] ? o : worst
  );
}

function getSectionOutcomesForUse(
  useId: string,
  assessments: SectionAssessment[]
): { sectionId: string; outcome: RiskLevel }[] {
  return assessments
    .filter((a) => a.useOutcomes?.[useId] !== undefined)
    .map((a) => ({ sectionId: a.sectionId, outcome: a.useOutcomes![useId] }))
    .sort((a, b) => RISK_SEVERITY[b.outcome] - RISK_SEVERITY[a.outcome]);
}

interface UsesTabProps {
  countries: CountryUse[];
  assessments: SectionAssessment[];
  onUpdate: (countries: CountryUse[]) => void;
}

function generateId() {
  return `use-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function UseRow({
  use,
  assessments,
  onRemove,
}: {
  use: GAPUse;
  assessments: SectionAssessment[];
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const outcome = deriveUseOutcome(use.id, assessments);
  const sectionOutcomes = getSectionOutcomesForUse(use.id, assessments);

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-start gap-3 px-5 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-medium">{use.description}</p>
          {use.notes && (
            <p className="text-xs text-muted mt-0.5">{use.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RiskBadge level={outcome} size="xs" />
          {sectionOutcomes.length > 0 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              title={expanded ? "Hide section breakdown" : "Show section breakdown"}
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              {sectionOutcomes.length}
            </button>
          )}
          <button
            onClick={onRemove}
            title="Remove use"
            className="text-muted hover:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {expanded && sectionOutcomes.length > 0 && (
        <div className="px-5 pb-3 pt-0">
          <div className="bg-background/60 rounded-lg border border-border divide-y divide-border">
            {sectionOutcomes.map(({ sectionId, outcome: sOutcome }) => (
              <div
                key={sectionId}
                className="flex items-center justify-between px-3 py-2"
              >
                <span className="text-xs text-muted">
                  {getSectionName(sectionId)}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_LEVEL_CONFIG[sOutcome].bgColor} ${RISK_LEVEL_CONFIG[sOutcome].color}`}
                >
                  {RISK_LEVEL_CONFIG[sOutcome].label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            Set outcomes per section via the Risk Matrix tab.
          </p>
        </div>
      )}
    </div>
  );
}

export default function UsesTab({
  countries,
  assessments,
  onUpdate,
}: UsesTabProps) {
  const [addingUseFor, setAddingUseFor] = useState<string | null>(null);
  const [newDesc, setNewDesc] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [addingCountry, setAddingCountry] = useState(false);
  const [newCountryCode, setNewCountryCode] = useState("");

  function handleAddUse(countryCode: string) {
    if (!newDesc.trim()) return;
    const newUse: GAPUse = {
      id: generateId(),
      description: newDesc.trim(),
      notes: newNotes.trim() || undefined,
    };
    onUpdate(
      countries.map((c) =>
        c.countryCode === countryCode ? { ...c, uses: [...c.uses, newUse] } : c
      )
    );
    setAddingUseFor(null);
    setNewDesc("");
    setNewNotes("");
  }

  function handleRemoveUse(countryCode: string, useId: string) {
    onUpdate(
      countries.map((c) =>
        c.countryCode === countryCode
          ? { ...c, uses: c.uses.filter((u) => u.id !== useId) }
          : c
      )
    );
  }

  function handleAddCountry() {
    const code = newCountryCode.trim().toUpperCase();
    if (!code || countries.some((c) => c.countryCode === code)) return;
    onUpdate([...countries, { countryCode: code, uses: [] }]);
    setAddingCountry(false);
    setNewCountryCode("");
  }

  function handleRemoveCountry(countryCode: string) {
    const country = countries.find((c) => c.countryCode === countryCode);
    if (
      country &&
      country.uses.length > 0 &&
      !window.confirm(
        `Remove ${countryCode} and all its ${country.uses.length} use(s)?`
      )
    ) {
      return;
    }
    onUpdate(countries.filter((c) => c.countryCode !== countryCode));
  }

  const totalUses = countries.reduce((sum, c) => sum + c.uses.length, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {countries.length} {countries.length === 1 ? "country" : "countries"},{" "}
        {totalUses} {totalUses === 1 ? "use" : "uses"} defined. Outcomes are set
        per section via the Risk Matrix tab.
      </p>

      {countries.length === 0 && (
        <div className="text-center py-12 text-muted text-sm border border-dashed border-border rounded-xl">
          No countries added yet.
        </div>
      )}

      {countries.map((country) => (
        <div
          key={country.countryCode}
          className="bg-card border border-border rounded-xl overflow-hidden"
        >
          {/* Country header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/40">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm">
                {country.countryCode}
              </span>
              {COUNTRY_NAMES[country.countryCode] && (
                <span className="text-muted text-sm">
                  — {COUNTRY_NAMES[country.countryCode]}
                </span>
              )}
              <span className="text-xs text-muted/60 ml-1">
                ({country.uses.length}{" "}
                {country.uses.length === 1 ? "use" : "uses"})
              </span>
            </div>
            <button
              onClick={() => handleRemoveCountry(country.countryCode)}
              className="text-xs text-muted hover:text-red-500 transition-colors"
            >
              Remove
            </button>
          </div>

          {/* Uses */}
          <div>
            {country.uses.length === 0 &&
              addingUseFor !== country.countryCode && (
                <p className="px-5 py-4 text-sm text-muted italic">
                  No uses defined for this country yet.
                </p>
              )}

            {country.uses.map((use) => (
              <UseRow
                key={use.id}
                use={use}
                assessments={assessments}
                onRemove={() => handleRemoveUse(country.countryCode, use.id)}
              />
            ))}

            {/* Add use form */}
            {addingUseFor === country.countryCode ? (
              <div className="px-5 py-4 bg-background/40 border-t border-border space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted mb-1 block">
                    Use description
                  </label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="e.g. Winter Wheat, 2 x 200 g a.s./ha at BBCH 30-32"
                    autoFocus
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddUse(country.countryCode);
                      if (e.key === "Escape") {
                        setAddingUseFor(null);
                        setNewDesc("");
                        setNewNotes("");
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted mb-1 block">
                    Notes <span className="font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Any conditions, mitigations, or context..."
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddUse(country.countryCode)}
                    disabled={!newDesc.trim()}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Add use
                  </button>
                  <button
                    onClick={() => {
                      setAddingUseFor(null);
                      setNewDesc("");
                      setNewNotes("");
                    }}
                    className="px-4 py-1.5 border border-border rounded-lg text-sm font-medium text-muted hover:bg-background transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-3 border-t border-border">
                <button
                  onClick={() => setAddingUseFor(country.countryCode)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add use
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add country */}
      <div className="mt-2">
        {addingCountry ? (
          <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-3">
            <input
              type="text"
              value={newCountryCode}
              onChange={(e) =>
                setNewCountryCode(e.target.value.toUpperCase().slice(0, 3))
              }
              placeholder="Country code, e.g. IE"
              autoFocus
              className="px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCountry();
                if (e.key === "Escape") {
                  setAddingCountry(false);
                  setNewCountryCode("");
                }
              }}
            />
            <button
              onClick={handleAddCountry}
              disabled={
                !newCountryCode.trim() ||
                countries.some(
                  (c) => c.countryCode === newCountryCode.trim().toUpperCase()
                )
              }
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Add
            </button>
            <button
              onClick={() => {
                setAddingCountry(false);
                setNewCountryCode("");
              }}
              className="px-4 py-1.5 border border-border rounded-lg text-sm font-medium text-muted hover:bg-background transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingCountry(true)}
            className="flex items-center gap-2 text-sm text-muted hover:text-blue-500 border border-dashed border-border hover:border-blue-400 rounded-xl px-5 py-3 w-full transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add country
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  RiskLevel,
  RISK_LEVEL_CONFIG,
  SectionAssessment,
  CountryUse,
} from "@/lib/types";

const RISK_OPTIONS: RiskLevel[] = [
  "not-started",
  "pass",
  "pass-with-mitigation",
  "data-required",
  "refinement-needed",
  "critical",
  "fail",
];

const RISK_OPTION_DOT: Record<RiskLevel, string> = {
  "not-started": "bg-gray-300",
  pass: "bg-green-400",
  "pass-with-mitigation": "bg-lime-400",
  "data-required": "bg-yellow-400",
  "refinement-needed": "bg-orange-400",
  critical: "bg-red-400",
  fail: "bg-gray-900",
};

const NOTES_PLACEHOLDER = "Enter assessment notes...";

export default function AssessmentModal({
  sectionId,
  sectionName,
  assessment,
  countries = [],
  onClose,
  onSave,
}: {
  sectionId: string;
  sectionName: string;
  assessment?: SectionAssessment;
  countries?: CountryUse[];
  onClose: () => void;
  onSave: (data: SectionAssessment) => void;
}) {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(
    assessment?.riskLevel || "not-started"
  );
  const [summary, setSummary] = useState(assessment?.summary || "");
  const [assessor, setAssessor] = useState(assessment?.assessor || "");
  const [notes, setNotes] = useState<string>(
    (assessment?.details as Record<string, string>)?.notes || ""
  );
  const [useOutcomes, setUseOutcomes] = useState<Record<string, RiskLevel>>(
    assessment?.useOutcomes ?? {}
  );
  const [isDirty, setIsDirty] = useState(false);

  const totalUses = countries.reduce((sum, c) => sum + c.uses.length, 0);

  function markDirty() {
    if (!isDirty) setIsDirty(true);
  }

  function handleRiskChange(level: RiskLevel) {
    setRiskLevel(level);
    markDirty();
  }

  function handleSummaryChange(val: string) {
    setSummary(val);
    markDirty();
  }

  function handleAssessorChange(val: string) {
    setAssessor(val);
    markDirty();
  }

  function handleClose() {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Discard them?")) return;
    }
    onClose();
  }

  function handleUseOutcomeChange(useId: string, level: RiskLevel) {
    setUseOutcomes((prev) => ({ ...prev, [useId]: level }));
    markDirty();
  }

  function handleSave() {
    onSave({
      sectionId,
      riskLevel,
      summary,
      assessor,
      lastUpdated: new Date().toISOString().split("T")[0],
      details: notes ? { notes } : undefined,
      useOutcomes: Object.keys(useOutcomes).length > 0 ? useOutcomes : undefined,
    });
    onClose();
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
              onClick={handleClose}
              aria-label="Close"
              className="text-muted hover:text-foreground p-1 rounded-md hover:bg-border/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
                    onClick={() => handleRiskChange(level)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                      selected
                        ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color}`
                        : "bg-background border-border text-muted hover:bg-border/30"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${RISK_OPTION_DOT[level]}`}
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
              onChange={(e) => handleAssessorChange(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Assessment Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">
              Assessment Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); markDirty(); }}
              placeholder={NOTES_PLACEHOLDER}
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Summary */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-1">
              Summary / Recommendation
            </label>
            <textarea
              value={summary}
              onChange={(e) => handleSummaryChange(e.target.value)}
              placeholder="Summarise the risk assessment outcome and any recommendations..."
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Per-Use Outcomes */}
          {totalUses > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-foreground mb-1">
                Per-Use Outcomes
              </h4>
              <p className="text-xs text-muted mb-3">
                Set the outcome of this section&apos;s assessment for each defined use.
              </p>
              <div className="space-y-4">
                {countries.map((country) => {
                  if (country.uses.length === 0) return null;
                  return (
                    <div key={country.countryCode}>
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                        {country.countryCode}
                      </p>
                      <div className="space-y-3">
                        {country.uses.map((use) => {
                          const current = useOutcomes[use.id] ?? "not-started";
                          return (
                            <div key={use.id} className="pl-3 border-l-2 border-border">
                              <p className="text-xs text-foreground mb-1.5 font-medium">
                                {use.description}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {RISK_OPTIONS.map((level) => {
                                  const cfg = RISK_LEVEL_CONFIG[level];
                                  const selected = current === level;
                                  return (
                                    <button
                                      key={level}
                                      onClick={() => handleUseOutcomeChange(use.id, level)}
                                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                        selected
                                          ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color}`
                                          : "bg-background border-border text-muted hover:bg-border/30"
                                      }`}
                                    >
                                      <div
                                        className={`w-2 h-2 rounded-full shrink-0 ${RISK_OPTION_DOT[level]}`}
                                      />
                                      {cfg.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            {isDirty ? (
              <span className="flex items-center gap-1.5 text-xs text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                Unsaved changes
              </span>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted hover:bg-border/30 transition"
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
    </div>
  );
}

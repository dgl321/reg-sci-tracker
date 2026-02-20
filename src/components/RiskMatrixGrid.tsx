"use client";

import { useState } from "react";
import {
  Product,
  SectionAssessment,
  SPECIALIST_GROUPS,
  RISK_LEVEL_CONFIG,
  RiskLevel,
} from "@/lib/types";
import { formatDate } from "@/lib/helpers";

const TILE_BG: Record<RiskLevel, string> = {
  "not-started": "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
  pass: "bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700",
  "pass-with-mitigation": "bg-lime-50 dark:bg-lime-900/30 border-lime-300 dark:border-lime-700",
  "data-required": "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  "refinement-needed": "bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700",
  critical: "bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700",
  fail: "bg-gray-100/60 dark:bg-gray-900/60 backdrop-blur-sm border-gray-900 dark:border-gray-600",
};

const TILE_DOT: Record<RiskLevel, string> = {
  "not-started": "bg-gray-300",
  pass: "bg-green-400",
  "pass-with-mitigation": "bg-lime-400",
  "data-required": "bg-yellow-400",
  "refinement-needed": "bg-orange-400",
  fail: "bg-gray-900",
  critical: "bg-red-400",
};

function SectionTile({
  name,
  shortName,
  assessment,
  shared,
  onEdit,
}: {
  name: string;
  shortName?: string;
  assessment?: SectionAssessment;
  shared?: boolean;
  onEdit: () => void;
}) {
  const level = assessment?.riskLevel || "not-started";
  const config = RISK_LEVEL_CONFIG[level];

  return (
    <button
      onClick={onEdit}
      title={name}
      className={`relative text-left p-3 rounded-lg border-2 ${TILE_BG[level]} hover:shadow-md transition-all w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2.5 h-2.5 rounded-full ${TILE_DOT[level]}`} />
        <span className="text-xs font-semibold text-foreground">
          {shortName || name}
        </span>
        {shared && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium">
            Shared
          </span>
        )}
      </div>
      <p className={`text-[11px] ${config.color} font-medium`}>
        {config.label}
      </p>
      {assessment?.summary && (
        <p className="text-[11px] text-muted mt-1 line-clamp-2">
          {assessment.summary}
        </p>
      )}
      {assessment?.assessor && (
        <p className="text-[10px] text-muted mt-1.5">
          {assessment.assessor}
          {assessment.lastUpdated && ` - ${formatDate(assessment.lastUpdated)}`}
        </p>
      )}
    </button>
  );
}

function SectionDetail({
  name,
  assessment,
  onClose,
  onEdit,
}: {
  name: string;
  assessment?: SectionAssessment;
  onClose: () => void;
  onEdit: () => void;
}) {
  const level = assessment?.riskLevel || "not-started";
  const config = RISK_LEVEL_CONFIG[level];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-3 h-3 rounded-full ${TILE_DOT[level]}`} />
                <span className={`text-sm font-medium ${config.color}`}>
                  {config.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-muted hover:text-foreground p-1 rounded-md hover:bg-border/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {assessment?.summary ? (
            <>
              <div className="mb-4">
                <h4 className="text-sm font-medium text-foreground mb-1">
                  Summary
                </h4>
                <p className="text-sm text-muted">{assessment.summary}</p>
              </div>

              {assessment.details && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Details
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(assessment.details).map(([key, value]) => (
                      <div
                        key={key}
                        className="bg-background rounded-lg px-3 py-2"
                      >
                        <p className="text-[11px] text-muted">{key}</p>
                        <p className="text-sm font-medium text-foreground">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted border-t border-border pt-3">
                <span>Assessed by: {assessment.assessor || "Unassigned"}</span>
                <span>
                  Updated:{" "}
                  {formatDate(assessment.lastUpdated) || "N/A"}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted italic">
              No assessment has been entered yet.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={onEdit}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Edit Assessment
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted hover:bg-background transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RiskMatrixGrid({
  product,
  onEditSection,
}: {
  product: Product;
  onEditSection: (sectionId: string, groupId: string) => void;
}) {
  const [expandedSection, setExpandedSection] = useState<{
    name: string;
    assessment?: SectionAssessment;
    sectionId: string;
    groupId: string;
  } | null>(null);

  function getAssessment(sectionId: string): SectionAssessment | undefined {
    return product.assessments.find((a) => a.sectionId === sectionId);
  }

  return (
    <>
      <div className="space-y-6">
        {SPECIALIST_GROUPS.map((group) => (
          <div
            key={group.id}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="px-5 py-3 bg-background border-b border-border">
              <h3 className="font-semibold text-foreground">{group.name}</h3>
            </div>
            <div className="p-5">
              {group.subgroups ? (
                <div className="space-y-4">
                  {group.subgroups.map((sg) => (
                    <div key={sg.id}>
                      <h4 className="text-sm font-medium text-muted mb-2">
                        {sg.name}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {sg.sections.map((section) => (
                          <SectionTile
                            key={`${sg.id}-${section.id}`}
                            name={section.name}
                            shortName={section.shortName}
                            assessment={getAssessment(section.id)}
                            shared={
                              section.id === "aquatics" ? true : false
                            }
                            onEdit={() =>
                              setExpandedSection({
                                name: `${sg.name} - ${section.name}`,
                                assessment: getAssessment(section.id),
                                sectionId: section.id,
                                groupId: sg.id,
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {group.sections!.map((section) => (
                    <SectionTile
                      key={section.id}
                      name={section.name}
                      shortName={section.shortName}
                      assessment={getAssessment(section.id)}
                      onEdit={() =>
                        setExpandedSection({
                          name: `${group.name} - ${section.name}`,
                          assessment: getAssessment(section.id),
                          sectionId: section.id,
                          groupId: group.id,
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {expandedSection && (
        <SectionDetail
          name={expandedSection.name}
          assessment={expandedSection.assessment}
          onClose={() => setExpandedSection(null)}
          onEdit={() => {
            onEditSection(
              expandedSection.sectionId,
              expandedSection.groupId
            );
            setExpandedSection(null);
          }}
        />
      )}
    </>
  );
}

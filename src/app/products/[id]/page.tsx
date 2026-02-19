"use client";

import { useState, use, useRef, useEffect } from "react";
import Link from "next/link";
import { getProduct } from "@/lib/mock-data";
import {
  getRiskDistribution,
  getOverallRisk,
  getCompletionPercentage,
  getSectionName,
  formatDate,
} from "@/lib/helpers";
import { Product, SectionAssessment, SPECIALIST_GROUPS } from "@/lib/types";
import RiskBadge from "@/components/RiskBadge";
import RiskSummaryBar from "@/components/RiskSummaryBar";
import RiskMatrixGrid from "@/components/RiskMatrixGrid";
import AssessmentModal from "@/components/AssessmentModal";
import UsesTab from "@/components/UsesTab";
import { CountryUse } from "@/lib/types";

type Tab = "matrix" | "summary" | "uses";

function CircularProgress({ value }: { value: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-border"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-blue-500 transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold text-foreground leading-none">{value}%</span>
      </div>
    </div>
  );
}

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const productData = getProduct(id);

  const [product, setProduct] = useState<Product | undefined>(productData);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [editingSection, setEditingSection] = useState<{
    sectionId: string;
    groupId: string;
    name: string;
  } | null>(null);
  const [editingConclusion, setEditingConclusion] = useState(false);
  const [conclusionDraft, setConclusionDraft] = useState(productData?.conclusion ?? "");
  const conclusionRef = useRef<HTMLTextAreaElement>(null);

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Product not found
        </h2>
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          Back to products
        </Link>
      </div>
    );
  }

  const dist = getRiskDistribution(product);
  const overall = getOverallRisk(product);
  const completion = getCompletionPercentage(product);

  function findSectionName(sectionId: string, groupId: string): string {
    for (const group of SPECIALIST_GROUPS) {
      if (group.subgroups) {
        const sg = group.subgroups.find((s) => s.id === groupId);
        if (sg) {
          const section = sg.sections.find((s) => s.id === sectionId);
          if (section) return `${sg.name} - ${section.name}`;
        }
      }
      if (group.sections && group.id === groupId) {
        const section = group.sections.find((s) => s.id === sectionId);
        if (section) return `${group.name} - ${section.name}`;
      }
    }
    return sectionId;
  }

  function handleEditSection(sectionId: string, groupId: string) {
    setEditingSection({
      sectionId,
      groupId,
      name: findSectionName(sectionId, groupId),
    });
  }

  function handleSaveAssessment(data: SectionAssessment) {
    setProduct((prev) => {
      if (!prev) return prev;
      const existing = prev.assessments.findIndex(
        (a) => a.sectionId === data.sectionId
      );
      const assessments = [...prev.assessments];
      if (existing >= 0) {
        assessments[existing] = data;
      } else {
        assessments.push(data);
      }
      return { ...prev, assessments };
    });
  }

  function handleStartEditConclusion() {
    setConclusionDraft(product?.conclusion ?? "");
    setEditingConclusion(true);
    setTimeout(() => conclusionRef.current?.focus(), 0);
  }

  function handleSaveConclusion() {
    setProduct((prev) => prev ? { ...prev, conclusion: conclusionDraft.trim() } : prev);
    setEditingConclusion(false);
  }

  function handleCancelConclusion() {
    setConclusionDraft(product?.conclusion ?? "");
    setEditingConclusion(false);
  }

  function handleUpdateCountries(countries: CountryUse[]) {
    setProduct((prev) => (prev ? { ...prev, countries } : prev));
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "summary", label: "Summary" },
    { key: "matrix", label: "Risk Matrix" },
    { key: "uses", label: "GAP Uses" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Products
        </Link>
        <span className="text-sm text-muted mx-2">/</span>
        <span className="text-sm text-foreground">{product.productName}</span>
      </div>

      {/* Product Header */}
      <div className="bg-card border border-border rounded-xl p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-foreground">
                {product.productName}
              </h2>
              <RiskBadge level={overall} size="md" />
            </div>
            <p className="text-muted text-sm mb-3">
              {product.activeSubstance} - {product.type}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted">Programme Owner:</span>{" "}
                <span className="font-medium text-foreground">{product.projectOwner}</span>
              </div>
              <div>
                <span className="text-muted">Submission:</span>{" "}
                <span className="font-medium text-foreground">{product.submissionType}</span>
              </div>
              <div>
                <span className="text-muted">Countries:</span>{" "}
                <span className="font-medium text-foreground">
                  {product.countries.map((c) => c.countryCode).join(", ")}
                </span>
              </div>
              <div>
                <span className="text-muted">Status:</span>{" "}
                <span className="font-medium text-foreground">{product.status}</span>
              </div>
              {product.targetSubmissionDate && (
                <div>
                  <span className="text-muted">Target Date:</span>{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(product.targetSubmissionDate)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted">EU Approval:</span>{" "}
                <span
                  className={`font-medium ${product.euApprovalStatus === "Approved"
                      ? "text-green-700 dark:text-green-400"
                      : product.euApprovalStatus === "Pending"
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-red-700 dark:text-red-400"
                    }`}
                >
                  {product.euApprovalStatus}
                </span>
                {product.euExpiryDate && (
                  <span className="text-muted">
                    {" "}
                    (expires {formatDate(product.euExpiryDate)})
                  </span>
                )}
              </div>
            </div>
          </div>
          <CircularProgress value={completion} />
        </div>

        {/* Risk Summary Bar */}
        <div className="mt-5 pt-5 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Risk Distribution
          </h4>
          <RiskSummaryBar
            distribution={dist}
            total={product.assessments.length}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted hover:text-foreground hover:border-border"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: GAP Uses */}
      {activeTab === "uses" && (
        <UsesTab
          countries={product.countries}
          assessments={product.assessments}
          onUpdate={handleUpdateCountries}
        />
      )}

      {/* Tab: Risk Matrix */}
      {activeTab === "matrix" && (
        <RiskMatrixGrid
          product={product}
          onEditSection={handleEditSection}
        />
      )}

      {/* Tab: Summary */}
      {activeTab === "summary" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-muted">Overall Assessment:</span>
            <RiskBadge level={overall} size="md" />
          </div>

          {/* Conclusions / Findings */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-foreground">
                Conclusions
              </h4>
              {!editingConclusion && (
                <button
                  onClick={handleStartEditConclusion}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 0 1 2.828 2.828L11.828 15.828a2 2 0 0 1-1.414.586H9v-2.414a2 2 0 0 1 .586-1.414z" />
                  </svg>
                  {product.conclusion ? "Edit" : "Add findings"}
                </button>
              )}
            </div>

            {editingConclusion ? (
              <div className="space-y-2">
                <textarea
                  ref={conclusionRef}
                  value={conclusionDraft}
                  onChange={(e) => setConclusionDraft(e.target.value)}
                  placeholder="Enter overall conclusions, findings, or regulatory narrative for this product..."
                  rows={5}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveConclusion}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelConclusion}
                    className="px-4 py-1.5 border border-border rounded-lg text-sm font-medium text-muted hover:bg-background transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : product.conclusion ? (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {product.conclusion}
              </p>
            ) : (
              <button
                onClick={handleStartEditConclusion}
                className="w-full text-left px-4 py-3 rounded-lg border border-dashed border-border text-sm text-muted hover:border-blue-400 hover:text-blue-500 transition-colors"
              >
                + Click to add conclusions or findings for this product...
              </button>
            )}
          </div>

          {/* Key Concerns & Pending */}
          <div className="border-t border-border pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">
                Key Concerns
              </h4>
              <ul className="space-y-1">
                {product.assessments
                  .filter(
                    (a) =>
                      a.riskLevel === "critical" ||
                      a.riskLevel === "fail" ||
                      a.riskLevel === "refinement-needed"
                  )
                  .map((a) => (
                    <li key={a.sectionId} className="flex items-start gap-2 text-sm">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.riskLevel === "critical"
                            ? "bg-red-800"
                            : a.riskLevel === "fail"
                              ? "bg-red-500"
                              : "bg-amber-500"
                          }`}
                      />
                      <div>
                        <span className="font-medium text-foreground">
                          {getSectionName(a.sectionId)}
                        </span>
                        <span className="text-muted"> — {a.summary || "No details"}</span>
                      </div>
                    </li>
                  ))}
                {product.assessments.filter(
                  (a) =>
                    a.riskLevel === "critical" ||
                    a.riskLevel === "fail" ||
                    a.riskLevel === "refinement-needed"
                ).length === 0 && (
                    <li className="text-sm text-muted italic">
                      No critical concerns identified.
                    </li>
                  )}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">
                Pending Assessments
              </h4>
              <ul className="space-y-1">
                {product.assessments
                  .filter((a) => a.riskLevel === "not-started")
                  .map((a) => (
                    <li
                      key={a.sectionId}
                      className="flex items-center gap-2 text-sm text-muted"
                    >
                      <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                      {getSectionName(a.sectionId)}
                    </li>
                  ))}
                {product.assessments.filter((a) => a.riskLevel === "not-started")
                  .length === 0 && (
                    <li className="text-sm text-muted italic">All sections assessed.</li>
                  )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingSection && (
        <AssessmentModal
          sectionId={editingSection.sectionId}
          sectionName={editingSection.name}
          assessment={product.assessments.find(
            (a) => a.sectionId === editingSection.sectionId
          )}
          countries={product.countries}
          onClose={() => setEditingSection(null)}
          onSave={handleSaveAssessment}
        />
      )}
    </div>
  );
}

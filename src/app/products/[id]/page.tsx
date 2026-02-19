"use client";

import { useState, use } from "react";
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

type Tab = "matrix" | "summary";

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

  const tabs: { key: Tab; label: string }[] = [
    { key: "summary", label: "Summary" },
    { key: "matrix", label: "Risk Matrix" },
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
                  {product.countries.join(", ")}
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
                  className={`font-medium ${
                    product.euApprovalStatus === "Approved"
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
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted hover:text-foreground hover:border-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          a.riskLevel === "critical"
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
          onClose={() => setEditingSection(null)}
          onSave={handleSaveAssessment}
        />
      )}
    </div>
  );
}

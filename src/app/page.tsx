"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { products } from "@/lib/mock-data";
import {
  getRiskDistribution,
  getOverallRisk,
  getCompletionPercentage,
} from "@/lib/helpers";
import { RISK_LEVEL_CONFIG, RiskLevel } from "@/lib/types";
import RiskBadge from "@/components/RiskBadge";
import RiskSummaryBar from "@/components/RiskSummaryBar";

type ViewMode = "cards" | "table";
type SortKey = "name" | "risk" | "progress" | "date";

const RISK_SEVERITY: Record<RiskLevel, number> = {
  critical: 5,
  fail: 4,
  "refinement-needed": 3,
  "pass-with-mitigation": 2,
  "not-started": 1,
  pass: 0,
};

export default function Home() {
  const [view, setView] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const types = [...new Set(products.map((p) => p.type))];

  const filtered = useMemo(() => {
    const base = products.filter((p) => {
      const matchesSearch =
        search === "" ||
        p.productName.toLowerCase().includes(search.toLowerCase()) ||
        p.activeSubstance.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || p.type === typeFilter;
      const matchesRisk =
        riskFilter === "all" || getOverallRisk(p) === riskFilter;
      return matchesSearch && matchesType && matchesRisk;
    });

    return [...base].sort((a, b) => {
      if (sortKey === "name") return a.productName.localeCompare(b.productName);
      if (sortKey === "risk") {
        return RISK_SEVERITY[getOverallRisk(b)] - RISK_SEVERITY[getOverallRisk(a)];
      }
      if (sortKey === "progress") {
        return getCompletionPercentage(a) - getCompletionPercentage(b);
      }
      if (sortKey === "date") {
        const da = a.targetSubmissionDate ?? "";
        const db = b.targetSubmissionDate ?? "";
        return da.localeCompare(db);
      }
      return 0;
    });
  }, [search, typeFilter, riskFilter, sortKey]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Products</h2>
        <p className="text-muted text-sm mt-1">
          {products.length} products tracked across {types.length} categories
        </p>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <input
          type="text"
          placeholder="Search products or active substances..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Risk Levels</option>
          {(["critical", "fail", "refinement-needed", "pass-with-mitigation", "pass", "not-started"] as RiskLevel[]).map((level) => (
            <option key={level} value={level}>
              {RISK_LEVEL_CONFIG[level].label}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">Sort: Name (A–Z)</option>
          <option value="risk">Sort: Risk (worst first)</option>
          <option value="progress">Sort: Progress (low first)</option>
          <option value="date">Sort: Submission Date</option>
        </select>
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setView("cards")}
            className={`px-3 py-2 text-sm ${
              view === "cards"
                ? "bg-blue-600 text-white"
                : "bg-card text-muted hover:bg-border/40"
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-2 text-sm ${
              view === "table"
                ? "bg-blue-600 text-white"
                : "bg-card text-muted hover:bg-border/40"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Result count */}
      <p className="text-xs text-muted mb-4">
        Showing {filtered.length} of {products.length} products
      </p>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg
            className="w-12 h-12 text-muted mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <p className="text-foreground font-medium mb-1">No products match your filters</p>
          <p className="text-muted text-sm">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Cards View */}
      {view === "cards" && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product) => {
            const dist = getRiskDistribution(product);
            const overall = getOverallRisk(product);
            const completion = getCompletionPercentage(product);
            const displayCountries =
              product.countries.length > 3
                ? product.countries.slice(0, 3)
                : product.countries;
            const extraCount = product.countries.length - 3;

            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="block bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-blue-300 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {product.productName}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      {product.activeSubstance}
                    </p>
                  </div>
                  <RiskBadge level={overall} />
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {product.type}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    {product.submissionType}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      product.euApprovalStatus === "Approved"
                        ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : product.euApprovalStatus === "Pending"
                        ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {product.euApprovalStatus}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted">Assessment Progress</span>
                    <span className="text-xs font-medium text-foreground">
                      {completion}%
                    </span>
                  </div>
                  <RiskSummaryBar
                    distribution={dist}
                    total={product.assessments.length}
                    showLegend={false}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{product.projectOwner}</span>
                  <span>
                    {displayCountries.join(", ")}
                    {extraCount > 0 && (
                      <span className="ml-1 text-muted/60">+{extraCount} more</span>
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === "table" && filtered.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left px-4 py-3 font-medium text-muted">
                    Product
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted">
                    Active
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted">
                    Submission
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted">
                    Risk
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted">
                    Progress
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted">
                    Owner
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const overall = getOverallRisk(product);
                  const completion = getCompletionPercentage(product);

                  return (
                    <tr
                      key={product.id}
                      className="border-b border-border last:border-0 hover:bg-background/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/products/${product.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {product.productName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {product.activeSubstance}
                      </td>
                      <td className="px-4 py-3 text-foreground">{product.type}</td>
                      <td className="px-4 py-3 text-foreground">{product.submissionType}</td>
                      <td className="px-4 py-3 text-muted">{product.status}</td>
                      <td className="px-4 py-3">
                        <RiskBadge level={overall} size="xs" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-border overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                RISK_LEVEL_CONFIG[overall].bgColor
                              }`}
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted">
                            {completion}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {product.projectOwner}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

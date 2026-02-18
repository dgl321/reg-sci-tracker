"use client";

import { useState } from "react";
import Link from "next/link";
import { products } from "@/lib/mock-data";
import {
  getRiskDistribution,
  getOverallRisk,
  getCompletionPercentage,
} from "@/lib/helpers";
import { RISK_LEVEL_CONFIG } from "@/lib/types";
import RiskBadge from "@/components/RiskBadge";
import RiskSummaryBar from "@/components/RiskSummaryBar";

type ViewMode = "cards" | "table";

export default function Home() {
  const [view, setView] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const types = [...new Set(products.map((p) => p.type))];

  const filtered = products.filter((p) => {
    const matchesSearch =
      search === "" ||
      p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.activeSubstance.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Products</h2>
        <p className="text-muted text-sm mt-1">
          {products.length} products tracked across {types.length} categories
        </p>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search products or active substances..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setView("cards")}
            className={`px-3 py-2 text-sm ${
              view === "cards"
                ? "bg-blue-600 text-white"
                : "bg-card text-muted hover:bg-gray-50"
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-2 text-sm ${
              view === "table"
                ? "bg-blue-600 text-white"
                : "bg-card text-muted hover:bg-gray-50"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Cards View */}
      {view === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product) => {
            const dist = getRiskDistribution(product);
            const overall = getOverallRisk(product);
            const completion = getCompletionPercentage(product);

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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {product.type}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                    {product.submissionType}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      product.euApprovalStatus === "Approved"
                        ? "bg-green-50 text-green-700"
                        : product.euApprovalStatus === "Pending"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700"
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
                  <span>{product.countries.join(", ")}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50">
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
                      className="border-b border-border last:border-0 hover:bg-gray-50"
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
                      <td className="px-4 py-3">{product.type}</td>
                      <td className="px-4 py-3">{product.submissionType}</td>
                      <td className="px-4 py-3 text-muted">{product.status}</td>
                      <td className="px-4 py-3">
                        <RiskBadge level={overall} size="xs" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-gray-100 overflow-hidden">
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

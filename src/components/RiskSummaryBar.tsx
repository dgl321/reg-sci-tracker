"use client";

import { RiskLevel, RISK_LEVEL_CONFIG } from "@/lib/types";

const BAR_COLORS: Record<RiskLevel, string> = {
  "not-started": "bg-gray-300",
  pass: "bg-green-400",
  "pass-with-mitigation": "bg-lime-400",
  "data-required": "bg-yellow-400",
  "refinement-needed": "bg-orange-400",
  fail: "bg-gray-900",
  critical: "bg-red-400",
};

export default function RiskSummaryBar({
  distribution,
  total,
  showLegend = true,
}: {
  distribution: Record<RiskLevel, number>;
  total: number;
  showLegend?: boolean;
}) {
  const order: RiskLevel[] = [
    "fail",
    "critical",
    "refinement-needed",
    "data-required",
    "pass-with-mitigation",
    "pass",
    "not-started",
  ];

  return (
    <div>
      <div className="flex h-4 w-full rounded-full overflow-hidden bg-border/50">
        {order.map((level) => {
          const count = distribution[level];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={level}
              className={`${BAR_COLORS[level]} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${RISK_LEVEL_CONFIG[level].label}: ${count}`}
            />
          );
        })}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-3 mt-2">
          {order.map((level) => {
            const count = distribution[level];
            if (count === 0) return null;
            return (
              <div key={level} className="flex items-center gap-1.5 text-xs text-muted">
                <div className={`w-2.5 h-2.5 rounded-full ${BAR_COLORS[level]}`} />
                <span>
                  {RISK_LEVEL_CONFIG[level].label} ({count})
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { RiskLevel, RISK_LEVEL_CONFIG } from "@/lib/types";

export default function RiskBadge({
  level,
  size = "sm",
}: {
  level: RiskLevel;
  size?: "xs" | "sm" | "md";
}) {
  const config = RISK_LEVEL_CONFIG[level];
  const sizeClasses = {
    xs: "text-xs px-1.5 py-0.5",
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
}

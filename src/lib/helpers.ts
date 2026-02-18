import { Product, RiskLevel, SPECIALIST_GROUPS } from "./types";

export function getRiskDistribution(
  product: Product
): Record<RiskLevel, number> {
  const dist: Record<RiskLevel, number> = {
    "not-started": 0,
    pass: 0,
    "pass-with-mitigation": 0,
    "refinement-needed": 0,
    fail: 0,
    critical: 0,
  };
  for (const a of product.assessments) {
    dist[a.riskLevel]++;
  }
  return dist;
}

export function getOverallRisk(product: Product): RiskLevel {
  const levels: RiskLevel[] = product.assessments.map((a) => a.riskLevel);
  if (levels.includes("critical")) return "critical";
  if (levels.includes("fail")) return "fail";
  if (levels.includes("refinement-needed")) return "refinement-needed";
  if (levels.includes("pass-with-mitigation")) return "pass-with-mitigation";
  if (levels.every((l) => l === "not-started")) return "not-started";
  return "pass";
}

export function getCompletionPercentage(product: Product): number {
  const completed = product.assessments.filter(
    (a) => a.riskLevel !== "not-started"
  ).length;
  return Math.round((completed / product.assessments.length) * 100);
}

export function getAllSectionIds(): string[] {
  const ids: string[] = [];
  for (const group of SPECIALIST_GROUPS) {
    if (group.sections) {
      for (const s of group.sections) {
        if (!ids.includes(s.id)) ids.push(s.id);
      }
    }
    if (group.subgroups) {
      for (const sg of group.subgroups) {
        for (const s of sg.sections) {
          if (!ids.includes(s.id)) ids.push(s.id);
        }
      }
    }
  }
  return ids;
}

export function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    IE: "IE",
    UK: "UK",
    DE: "DE",
    FR: "FR",
    PL: "PL",
    NL: "NL",
    BE: "BE",
    ES: "ES",
    IT: "IT",
    GR: "GR",
    PT: "PT",
    CZ: "CZ",
    HU: "HU",
    RO: "RO",
  };
  return flags[code] || code;
}

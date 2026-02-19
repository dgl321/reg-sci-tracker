// Risk levels used across all specialist areas
export type RiskLevel =
  | "not-started"
  | "pass"
  | "pass-with-mitigation"
  | "refinement-needed"
  | "fail"
  | "critical";

export const RISK_LEVEL_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  "not-started": {
    label: "Not Started",
    color: "text-gray-500 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-700",
    borderColor: "border-gray-300 dark:border-gray-600",
  },
  pass: {
    label: "Pass",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/50",
    borderColor: "border-green-400 dark:border-green-600",
  },
  "pass-with-mitigation": {
    label: "Pass w/ Mitigation",
    color: "text-lime-700 dark:text-lime-400",
    bgColor: "bg-lime-100 dark:bg-lime-900/50",
    borderColor: "border-lime-400 dark:border-lime-600",
  },
  "refinement-needed": {
    label: "Refinement Needed",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/50",
    borderColor: "border-amber-400 dark:border-amber-600",
  },
  fail: {
    label: "Fail",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/50",
    borderColor: "border-red-400 dark:border-red-600",
  },
  critical: {
    label: "Critical",
    color: "text-red-900 dark:text-red-300",
    bgColor: "bg-red-200 dark:bg-red-900/70",
    borderColor: "border-red-600 dark:border-red-500",
  },
};

// Specialist group hierarchy
export interface SpecialistSection {
  id: string;
  name: string;
  shortName?: string;
}

export interface SpecialistGroup {
  id: string;
  name: string;
  subgroups?: {
    id: string;
    name: string;
    sections: SpecialistSection[];
  }[];
  sections?: SpecialistSection[];
}

export const SPECIALIST_GROUPS: SpecialistGroup[] = [
  {
    id: "environmental",
    name: "Environmental",
    subgroups: [
      {
        id: "env-fate",
        name: "Environmental Fate",
        sections: [
          { id: "aquatics", name: "Aquatics", shortName: "Aquatics" },
          { id: "groundwater", name: "Groundwater", shortName: "Groundwater" },
          { id: "soil", name: "Soil", shortName: "Soil" },
        ],
      },
      {
        id: "ecotox",
        name: "Ecotoxicology",
        sections: [
          { id: "aquatics", name: "Aquatics", shortName: "Aquatics" },
          { id: "bees", name: "Bees", shortName: "Bees" },
          { id: "birds-mammals", name: "Birds & Mammals", shortName: "Birds & Mammals" },
          { id: "nta", name: "Non-Target Arthropods", shortName: "Non-Target Arthropods" },
          { id: "ntp", name: "Non-Target Plants", shortName: "Non-Target Plants" },
        ],
      },
    ],
  },
  {
    id: "toxicology",
    name: "Toxicology",
    sections: [
      { id: "operator", name: "Operator", shortName: "Operator" },
      { id: "worker", name: "Worker", shortName: "Worker" },
      { id: "resident-bystander", name: "Resident/Bystander", shortName: "Resident/Bystander" },
      { id: "classification", name: "Classification", shortName: "Classification" },
      { id: "gw-metabolites", name: "Relevant GW Metabolites", shortName: "Relevant GW Metabolites" },
    ],
  },
  {
    id: "analytical",
    name: "Analytical Methods",
    sections: [
      { id: "validation", name: "Validation", shortName: "Validation" },
    ],
  },
  {
    id: "residues",
    name: "Residues",
    sections: [
      { id: "residue-studies", name: "Residue Studies", shortName: "Residue Studies" },
      { id: "consumer-chronic", name: "Consumer Risk Chronic", shortName: "Consumer Risk Chronic" },
      { id: "consumer-acute", name: "Consumer Risk Acute", shortName: "Consumer Risk Acute" },
      { id: "combined-risk", name: "Combined Risk", shortName: "Combined Risk" },
    ],
  },
  {
    id: "efficacy",
    name: "Efficacy",
    sections: [
      { id: "field-trials", name: "Efficacy Trials", shortName: "Efficacy Trials" },
      { id: "bad", name: "Biological Assessment Dossier", shortName: "BAD" },
      { id: "effectiveness", name: "Effectiveness", shortName: "Effectiveness" },
      { id: "resistance", name: "Resistance", shortName: "Resistance" },
    ],
  },
];

// Risk assessment for a single specialist section
export interface SectionAssessment {
  sectionId: string;
  riskLevel: RiskLevel;
  summary: string;
  assessor?: string;
  lastUpdated?: string;
  details?: Record<string, string | number>;
}

// Product / Project
export type SubstanceType = "Herbicide" | "Fungicide" | "Insecticide" | "PGR" | "Biological";
export type SubmissionType = "Art 33" | "Renewal" | "Label Extension";
export type ApprovalStatus = "Approved" | "Pending" | "Not Approved";

export interface Product {
  id: string;
  activeSubstance: string;
  productName: string;
  type: SubstanceType;
  projectOwner: string;
  countries: string[];
  submissionType: SubmissionType;
  status: string;
  targetSubmissionDate?: string;
  dataResponsibility: string;
  euApprovalStatus: ApprovalStatus;
  euExpiryDate?: string;
  assessments: SectionAssessment[];
  conclusion?: string;
}

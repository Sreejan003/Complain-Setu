export interface BureauConfig {
  id: string;
  name: string;
  code: string;
  description: string;
}

export const BUREAUS: BureauConfig[] = [
  {
    id: "RB",
    name: "Regulation Bureau",
    code: "RB",
    description: "Enforces AICTE regulations, norms, faculty compliance, and legal statutory guidelines."
  },
  {
    id: "PGRC",
    name: "Public Grievance Redressal Cell",
    code: "PGRC",
    description: "Handles grievances submitted by students, parents, faculty, and public stakeholders."
  },
  {
    id: "RO",
    name: "Regional Offices",
    code: "RO",
    description: "Regional scrutiny, physical campus inspections, and territorial administrative oversight."
  },
  {
    id: "AB",
    name: "Approval Bureau",
    code: "AB",
    description: "Processes institution approvals, course intake extensions, and affiliation standards."
  },
  {
    id: "PB",
    name: "Policy and Academic Planning Bureau",
    code: "PB",
    description: "Curricular guidelines, autonomous institution norms, and policy compliance."
  }
];

export const USER_ROLES = [
  "SYSTEM_ADMIN", "COMPETENT_AUTHORITY", "BUREAU_HEAD", "CASE_OFFICER",
  "Administrator",
  "Regulation Bureau Officer",
  "PGRC Officer",
  "Bureau Officer",
  "Regional Officer",
  "Senior Management",
  "Competent Authority",
  "Institutional User"
] as const;

export type UserRole = typeof USER_ROLES[number];

export const COMPLAINT_CATEGORIES = [
  "Faculty Shortage / Irregularities",
  "Capitation Fee / Overcharging",
  "Infrastructure & Lab Deficiencies",
  "Withholding of Certificates & Documents",
  "Non-payment of Faculty Salaries",
  "Admission Guideline Violations",
  "Harassment & Grievance Redressal Failure",
  "Unauthorized Course Operation",
  "Approval Norms Violation"
] as const;

export type ComplaintCategory = typeof COMPLAINT_CATEGORIES[number];

export const COMPLAINT_STATUSES = [
  "Pending",
  "Under Process",
  "Disposed",
  "Transferred",
  "Escalated"
] as const;

export type ComplaintStatus = typeof COMPLAINT_STATUSES[number];

export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export type Priority = typeof PRIORITIES[number];

export const OVERLAP_STATUSES = [
  "Pending Review",
  "Confirmed Related",
  "Confirmed Duplicate",
  "Marked Unrelated",
  "Dismissed",
  "Resolved"
] as const;

export type OverlapStatus = typeof OVERLAP_STATUSES[number];

export const REGIONS = [
  "Northern Region (Kanpur)",
  "North-Western Region (Chandigarh)",
  "Southern Region (Chennai)",
  "South-Western Region (Bangalore)",
  "Western Region (Mumbai)",
  "Central Region (Bhopal)",
  "Eastern Region (Kolkata)",
  "South-Central Region (Hyderabad)"
] as const;

// SLA deadlines in days based on priority
export const SLA_DAYS: Record<Priority, number> = {
  Critical: 7,
  High: 15,
  Medium: 30,
  Low: 45
};

export const DEFAULT_DETECTION_CONFIG = {
  exactInstitutionWeight: 35,
  categoryMatchWeight: 25,
  keywordOverlapWeight: 20,
  crossBureauWeight: 10,
  dateWindowDays: 180, // Flag cases within 6 months
  ruleThreshold: 50,    // Minimum rule score to flag potential overlap
  semanticSimilarityThreshold: 65.0, // Minimum semantic similarity % to flag
  highConfidenceThreshold: 80.0
};

export interface EscalationConfig {
  approachingDeadlineDays: number;
  autoEscalateOverdueDays: number;
  reminderIntervalHours: number;
  seniorManagementNotifyDays: number;
}

export const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
  approachingDeadlineDays: 3,
  autoEscalateOverdueDays: 5,
  reminderIntervalHours: 24,
  seniorManagementNotifyDays: 7
};

// Existing workflow transitions, shared by validation and the case action form.
export const STATUS_TRANSITIONS: Record<string,string[]> = {
  Pending:["Under Process","Escalated","Transferred"],
  "Under Process":["Disposed","Escalated","Transferred","Pending"],
  Escalated:["Under Process","Disposed","Transferred"],
  Transferred:["Under Process","Pending","Escalated"],
  Disposed:["Under Process"]
};

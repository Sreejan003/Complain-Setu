import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const CANONICAL_PATH = path.join(rootDir, "data", "institutions_canonical.json");
const DB_FILE = path.join(rootDir, "backend", "data", "db.json");
const BACKUP_FILE = path.join(rootDir, "backend", "data", "db.backup.original.json");

console.log("==================================================================");
console.log("AICTE COMPLAIN SETU — CANONICAL INSTITUTIONS DATABASE IMPORT");
console.log("==================================================================");

if (!fs.existsSync(CANONICAL_PATH)) {
  console.error(`[ERROR] Canonical institutions file not found at: ${CANONICAL_PATH}`);
  process.exit(1);
}

// Ensure backup exists
if (!fs.existsSync(BACKUP_FILE)) {
  if (fs.existsSync(DB_FILE)) {
    console.log(`[Backup] Creating backup at ${BACKUP_FILE}...`);
    fs.copyFileSync(DB_FILE, BACKUP_FILE);
  }
}

const canonicalData = JSON.parse(fs.readFileSync(CANONICAL_PATH, "utf-8"));
console.log(`[Import] Read ${canonicalData.length} canonical records from ${CANONICAL_PATH}.`);

// Read current db or start fresh
let currentDb = {};
if (fs.existsSync(DB_FILE)) {
  try {
    currentDb = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (err) {
    console.warn("[Warning] Existing db.json could not be parsed; creating clean schema.");
  }
}

// Convert canonical records to operational schema
const nowIso = new Date().toISOString();
const operationalInstitutions = canonicalData.map((item) => {
  return {
    id: item.id,
    aictePermanentId: item.permanentId,
    permanentId: item.permanentId,
    name: item.name,
    institutionType: item.institutionType || "Engineering",
    address: `${item.city}, ${item.district}, ${item.state}`,
    city: item.city,
    district: item.district,
    state: item.state,
    region: item.region,
    pincode: "Not Available",
    contactEmail: "Not Available",
    contactPhone: "Not Available",
    accreditationStatus: "Not Verified",
    yearEstablished: 0,
    totalComplaintsCount: 0,
    activeComplaintsCount: 0,
    overlapCount: 0,
    sourceType: "PDF_IMPORT",
    sourceFile: "Institute_List.pdf",
    sourcePage: item.sourcePage,
    sourceDocumentDate: "2013-09-18",
    verificationStatus: "UNVERIFIED",
    hasSourceConflict: !!item.hasSourceConflict,
    conflictDetails: item.conflictDetails || null,
    sourcePages: item.sourcePages || [item.sourcePage],
    createdAt: "2013-09-18T00:00:00Z",
    updatedAt: nowIso
  };
});

// Preserve administrative accounts from currentDb or seedData
const preservedProfiles = (currentDb.profiles || []).map((p) => {
  if (p.role === "Institutional User") {
    // Re-bind to first canonical institution
    const firstInst = operationalInstitutions[0];
    return {
      ...p,
      institutionId: firstInst.id,
      institutionName: firstInst.name
    };
  }
  return p;
});

// Construct clean operational database
const cleanDb = {
  profiles: preservedProfiles.length > 0 ? preservedProfiles : currentDb.profiles || [],
  bureaus: currentDb.bureaus || [
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
  ],
  institutions: operationalInstitutions,
  complaints: [],
  overlapAlerts: [],
  caseHistory: [],
  caseTransfers: [],
  relatedCases: [],
  notifications: [],
  auditLogs: [
    {
      id: `audit-import-${Date.now()}`,
      userId: "usr-admin-01",
      userName: "System Administrator",
      action: "IMPORT_INSTITUTIONS_FROM_PDF",
      entityType: "InstitutionDirectory",
      entityId: "Institute_List.pdf",
      details: {
        totalImported: operationalInstitutions.length,
        sourceFile: "Institute_List.pdf",
        sourceDate: "2013-09-18",
        totalPages: 794
      },
      createdAt: nowIso
    }
  ],
  documents: [],
  slaConfig: currentDb.slaConfig || {
    approachingDeadlineDays: 3,
    autoEscalateOverdueDays: 5,
    reminderIntervalHours: 24,
    seniorManagementNotifyDays: 7
  },
  meta: {
    lastReset: nowIso,
    version: "2.0.0",
    dataSource: "Institute_List.pdf (AICTE Historical Directory Snapshot)",
    totalInstitutions: operationalInstitutions.length,
    conflictsRecorded: 1
  }
};

// Atomic write to DB_FILE
const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
fs.writeFileSync(tempFile, JSON.stringify(cleanDb, null, 2), "utf-8");
fs.renameSync(tempFile, DB_FILE);

console.log(`[Success] Successfully imported ${operationalInstitutions.length} institutions into ${DB_FILE}`);
console.log(`[Stats]:`);
console.log(`  - Total Institutions: ${operationalInstitutions.length}`);
console.log(`  - Total Operational Complaints: 0 (clean slate, mock data eliminated)`);
console.log(`  - Total Overlap Alerts: 0`);
console.log(`  - Profiles preserved: ${cleanDb.profiles.length}`);
console.log(`  - Database size: ${(fs.statSync(DB_FILE).size / (1024 * 1024)).toFixed(2)} MB`);
console.log("==================================================================");

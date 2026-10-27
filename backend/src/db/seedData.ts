import bcrypt from "bcryptjs";
import { Institution, Complaint, OverlapAlert, Profile, CaseHistory, CaseTransfer, Notification } from "../models/types.js";

// Hashed demo password generator
const DEMO_PW_HASH = bcrypt.hashSync("Aicte@2026", 10);

export const SEED_PROFILES: Profile[] = [
  {
    id: "usr-admin-01",
    email: "admin@aicte.gov.in",
    passwordHash: DEMO_PW_HASH,
    fullName: "Dr. Rajeshwar Sharma",
    role: "Administrator",
    designation: "Chief Administrative Officer & System Architect",
    isActive: true,
    createdAt: "2026-01-01T09:00:00Z",
    updatedAt: "2026-01-01T09:00:00Z"
  },
  {
    id: "usr-rb-01",
    email: "rb.officer@aicte.gov.in",
    passwordHash: DEMO_PW_HASH,
    fullName: "Smt. Sunita Venkataraman",
    role: "Regulation Bureau Officer",
    bureauId: "RB",
    designation: "Senior Director (Regulation & Norms)",
    isActive: true,
    createdAt: "2026-01-01T09:00:00Z",
    updatedAt: "2026-01-01T09:00:00Z"
  },
  {
    id: "usr-pgrc-01",
    email: "pgrc.officer@aicte.gov.in",
    passwordHash: DEMO_PW_HASH,
    fullName: "Shri Arvind K. Mukhopadhyay",
    role: "PGRC Officer",
    bureauId: "PGRC",
    designation: "Joint Secretary (Public Grievance Redressal)",
    isActive: true,
    createdAt: "2026-01-01T09:00:00Z",
    updatedAt: "2026-01-01T09:00:00Z"
  },
  {
    id: "usr-ro-01",
    email: "ro.officer@aicte.gov.in",
    passwordHash: DEMO_PW_HASH,
    fullName: "Dr. Meenakshi Sundaram",
    role: "Regional Officer",
    bureauId: "RO",
    region: "Southern Region (Chennai)",
    designation: "Regional Officer (Southern Region)",
    isActive: true,
    createdAt: "2026-01-01T09:00:00Z",
    updatedAt: "2026-01-01T09:00:00Z"
  },
  {
    id: "usr-sm-01",
    email: "senior.mgmt@aicte.gov.in",
    passwordHash: DEMO_PW_HASH,
    fullName: "Prof. K. N. Radhakrishnan",
    role: "Senior Management",
    designation: "Member Secretary (AICTE HQ)",
    isActive: true,
    createdAt: "2026-01-01T09:00:00Z",
    updatedAt: "2026-01-01T09:00:00Z"
  },
  {
    id: "usr-inst-01",
    email: "inst.officer@nist.edu.in",
    passwordHash: DEMO_PW_HASH,
    fullName: "Prof. Anirudh Patnaik",
    role: "Institutional User",
    institutionId: "inst-1",
    institutionName: "National Institute of Science & Technology",
    designation: "Registrar & Grievance Redressal Liaison Officer",
    isActive: true,
    createdAt: "2026-01-01T09:00:00Z",
    updatedAt: "2026-01-01T09:00:00Z"
  }
];

export const RAW_INSTITUTIONS_SEED = [
  { permId: "1-3324510001", name: "National Institute of Science & Technology", type: "Engineering", city: "Bhubaneswar", state: "Odisha", region: "Eastern Region (Kolkata)", year: 1996 },
  { permId: "1-4458921102", name: "Apex Global Institute of Engineering", type: "Engineering", city: "Pune", state: "Maharashtra", region: "Western Region (Mumbai)", year: 2004 },
  { permId: "1-1029384756", name: "Sri Venkateswara Institute of Technology", type: "Engineering", city: "Bengaluru", state: "Karnataka", region: "South-Western Region (Bangalore)", year: 2001 },
  { permId: "1-5566778899", name: "Aryavart College of Engineering & Research", type: "Engineering", city: "Lucknow", state: "Uttar Pradesh", region: "Northern Region (Kanpur)", year: 2008 },
  { permId: "1-2233445566", name: "Kalinga Institute of Pharmaceutical Sciences", type: "Pharmacy", city: "Cuttack", state: "Odisha", region: "Eastern Region (Kolkata)", year: 2011 },
  { permId: "1-7788990011", name: "Metro Institute of Management & Studies", type: "Management", city: "Gurugram", state: "Haryana", region: "North-Western Region (Chandigarh)", year: 2006 },
  { permId: "1-8899001122", name: "Saraswati Polytechnic College", type: "Polytechnic", city: "Jaipur", state: "Rajasthan", region: "North-Western Region (Chandigarh)", year: 2012 },
  { permId: "1-9900112233", name: "Drona Institute of Advanced Engineering", type: "Engineering", city: "Hyderabad", state: "Telangana", region: "South-Central Region (Hyderabad)", year: 2003 },
  { permId: "1-1234987654", name: "St. Xavier Institute of Business Management", type: "Management", city: "Chennai", state: "Tamil Nadu", region: "Southern Region (Chennai)", year: 1999 },
  { permId: "1-4567891230", name: "Vidya Jyothi Institute of Technology & Research", type: "Engineering", city: "Bhopal", state: "Madhya Pradesh", region: "Central Region (Bhopal)", year: 2007 },
  { permId: "1-6789012345", name: "Himalayan College of Engineering", type: "Engineering", city: "Dehradun", state: "Uttarakhand", region: "Northern Region (Kanpur)", year: 2010 },
  { permId: "1-8901234567", name: "Bharatiya Institute of Management and Science", type: "Management", city: "Ahmedabad", state: "Gujarat", region: "Central Region (Bhopal)", year: 2005 },
  { permId: "1-2345678901", name: "Cauvery College of Engineering & Technology", type: "Engineering", city: "Coimbatore", state: "Tamil Nadu", region: "Southern Region (Chennai)", year: 2002 },
  { permId: "1-3456789012", name: "Takshashila Institute of Professional Studies", type: "Engineering", city: "Patna", state: "Bihar", region: "Eastern Region (Kolkata)", year: 2014 },
  { permId: "1-4567890123", name: "Konkan Polytechnic and Technical Campus", type: "Polytechnic", city: "Ratnagiri", state: "Maharashtra", region: "Western Region (Mumbai)", year: 2013 },
  { permId: "1-5678901234", name: "Nalanda Institute of Pharmaceutical Sciences", type: "Pharmacy", city: "Vijayawada", state: "Andhra Pradesh", region: "South-Central Region (Hyderabad)", year: 2009 },
  { permId: "1-6789012346", name: "Malabar Institute of Technology", type: "Engineering", city: "Kozhikode", state: "Kerala", region: "South-Western Region (Bangalore)", year: 2008 },
  { permId: "1-7890123457", name: "Punjab Institute of Technology & Architecture", type: "Engineering", city: "Ludhiana", state: "Punjab", region: "North-Western Region (Chandigarh)", year: 2006 },
  { permId: "1-8901234568", name: "Brahmaputra Engineering Academy", type: "Engineering", city: "Guwahati", state: "Assam", region: "Eastern Region (Kolkata)", year: 2015 },
  { permId: "1-9012345679", name: "Vindhya Valley Institute of Technology", type: "Engineering", city: "Indore", state: "Madhya Pradesh", region: "Central Region (Bhopal)", year: 2011 },
  { permId: "1-0123456780", name: "Deccan College of Engineering & Research", type: "Engineering", city: "Nagpur", state: "Maharashtra", region: "Western Region (Mumbai)", year: 2005 },
  { permId: "1-1122334455", name: "Heritage Institute of Management", type: "Management", city: "Varanasi", state: "Uttar Pradesh", region: "Northern Region (Kanpur)", year: 2010 },
  { permId: "1-2233445577", name: "Ganga Institute of Pharmaceutical Research", type: "Pharmacy", city: "Haridwar", state: "Uttarakhand", region: "Northern Region (Kanpur)", year: 2016 },
  { permId: "1-3344556688", name: "Maratha Polytechnic Institute", type: "Polytechnic", city: "Kolhapur", state: "Maharashtra", region: "Western Region (Mumbai)", year: 2014 },
  { permId: "1-4455667799", name: "Chola Institute of Technical Studies", type: "Engineering", city: "Madurai", state: "Tamil Nadu", region: "Southern Region (Chennai)", year: 2007 },
  { permId: "1-5566778800", name: "Kashmir Technical Academy", type: "Engineering", city: "Srinagar", state: "Jammu & Kashmir", region: "North-Western Region (Chandigarh)", year: 2017 },
  { permId: "1-6677889911", name: "Rani Chennamma Engineering College", type: "Engineering", city: "Belagavi", state: "Karnataka", region: "South-Western Region (Bangalore)", year: 2004 },
  { permId: "1-7788990022", name: "Utkal Institute of Technology", type: "Engineering", city: "Rourkela", state: "Odisha", region: "Eastern Region (Kolkata)", year: 2012 },
  { permId: "1-8899001133", name: "Surya Global Business School", type: "Management", city: "Visakhapatnam", state: "Andhra Pradesh", region: "South-Central Region (Hyderabad)", year: 2013 },
  { permId: "1-9900112244", name: "Aravalli Institute of Technology", type: "Engineering", city: "Udaipur", state: "Rajasthan", region: "North-Western Region (Chandigarh)", year: 2009 }
];

export function generateSeedData() {
  const institutions: Institution[] = RAW_INSTITUTIONS_SEED.map((inst, index) => ({
    id: `inst-${index + 1}`,
    aictePermanentId: inst.permId,
    name: inst.name,
    institutionType: inst.type as any,
    address: `${100 + index * 5}, Institutional Area, Sector ${10 + (index % 15)}`,
    city: inst.city,
    state: inst.state,
    region: inst.region,
    pincode: `${110000 + (index * 137) % 800000}`.padStart(6, "1"),
    contactEmail: `registrar@${inst.name.toLowerCase().replace(/[^a-z]/g, "")}.edu.in`,
    contactPhone: `+91 ${9810000000 + index * 34211}`,
    accreditationStatus: index % 4 === 0 ? "NBA Accredited" : "AICTE Approved",
    yearEstablished: inst.year,
    totalComplaintsCount: 0,
    activeComplaintsCount: 0,
    overlapCount: 0,
    createdAt: "2026-01-05T10:00:00Z",
    updatedAt: "2026-01-05T10:00:00Z"
  }));

  const complaints: Complaint[] = [];
  const overlapAlerts: OverlapAlert[] = [];
  const caseHistory: CaseHistory[] = [];
  const caseTransfers: CaseTransfer[] = [];
  const notifications: Notification[] = [];

  // ====================================================================
  // 10 INTENTIONALLY CONSTRUCTED OVERLAP SCENARIOS ACROSS BUREAUS
  // ====================================================================
  const overlapScenarios = [
    {
      instIdx: 1, // Apex Global Institute (Pune)
      bureauA: "RB",
      bureauB: "PGRC",
      catA: "Faculty Shortage / Irregularities",
      catB: "Non-payment of Faculty Salaries",
      titleA: "Severe faculty deficit in Computer Engineering and non-compliance with AICTE 1:20 cadre ratio",
      titleB: "Faculty salaries withheld for four consecutive months and unauthorized salary deductions",
      descA: "Inspection representation indicates Apex Global Institute is operating with only 6 regular faculty against mandated requirement of 24 in CSE. Ghost faculty names submitted during approval extension.",
      descB: "14 Assistant Professors submitted collective grievance regarding non-payment of UGC/AICTE pay scale salaries since October 2025 and threats of termination upon asking for payment.",
      overlapReasons: [
        "Exact Institution Match: 1-4458921102 (Apex Global Institute of Engineering)",
        "Cross-Bureau Overlap: Regulation Bureau (RB) and PGRC processing simultaneous complaints",
        "Interdependent Violations: Severe faculty shortage linked directly to non-payment of faculty salaries",
        "High Keyword Concordance: Matched terms: [faculty, salaries, cse, ratio, regular]"
      ],
      ruleScore: 88,
      semanticScore: 78.5,
      alertStatus: "Pending Review",
      recommended: "Immediate joint hearing by Regulation Bureau and PGRC. Issue show-cause notice regarding faculty cadre non-compliance."
    },
    {
      instIdx: 0, // NIST Bhubaneswar
      bureauA: "PGRC",
      bureauB: "RO",
      catA: "Capitation Fee / Overcharging",
      catB: "Capitation Fee / Overcharging",
      titleA: "Illegal collection of development fee of Rs. 85,000 above state fee committee ceiling",
      titleB: "Complaint from Parents Association alleging mandatory donation for B.Tech admission",
      descA: "Students admitted under merit quota forced to pay Rs. 85,000 as development and laboratory caution fee without official fee receipt. Refusal to register for semester exams upon non-payment.",
      descB: "Parents Association submitted memorandum to Regional Office Kolkata stating management is extorting excess capitation fees and refusing to issue standardized receipts.",
      overlapReasons: [
        "Exact Institution Match: 1-3324510001 (National Institute of Science & Technology)",
        "Cross-Bureau Overlap: PGRC grievance and Regional Office Kolkata petition running in parallel",
        "Identical Category: Capitation Fee / Overcharging",
        "High Keyword Concordance: Matched terms: [fee, capitation, receipt, students, quota]"
      ],
      ruleScore: 92,
      semanticScore: 84.2,
      alertStatus: "Confirmed Related",
      recommended: "Consolidate into single investigation file under Eastern Regional Office with PGRC monitoring."
    },
    {
      instIdx: 2, // Sri Venkateswara Inst (Bengaluru)
      bureauA: "RB",
      bureauB: "PGRC",
      catA: "Withholding of Certificates & Documents",
      catB: "Withholding of Certificates & Documents",
      titleA: "Refusal to return original 10th & 12th certificates to discontinued student",
      titleB: "Retention of B.Tech degree certificates and migration certificates demanding full four-year fee",
      descA: "Student seeking migration to state university denied return of original mark sheets and transfer certificate unless entire course fee of Rs 3.5 Lakhs is cleared in violation of AICTE public notice.",
      descB: "Grievance received from graduate stating institution withheld original degree certificate and migration certificate claiming fictitious hostel dues.",
      overlapReasons: [
        "Exact Institution Match: 1-1029384756 (Sri Venkateswara Institute of Technology)",
        "Cross-Bureau Overlap: Regulation Bureau statutory violation vs PGRC student portal complaint",
        "Identical Violation Category: Withholding of Certificates & Documents",
        "High Keyword Concordance: Matched terms: [certificate, migration, original, fee, student]"
      ],
      ruleScore: 95,
      semanticScore: 89.0,
      alertStatus: "Pending Review",
      recommended: "Direct institution principal to immediately release all original certificates within 48 hours under AICTE penalty clause."
    },
    {
      instIdx: 3, // Aryavart College (Lucknow)
      bureauA: "RO",
      bureauB: "RB",
      catA: "Infrastructure & Lab Deficiencies",
      catB: "Approval Norms Violation",
      titleA: "Regional inspection note on defunct computer labs and absence of AICTE fire safety clearance",
      titleB: "Whistleblower alert alleging fictitious infrastructure shown for 2025-26 approval extension",
      descA: "Surprise scrutiny by Northern Regional Office noted 3 out of 4 computer labs locked with non-functional terminals. Fire safety NOC expired in 2024.",
      descB: "Petition received by Regulation Bureau stating institution rented computers and temporary faculty on day of AICTE committee visit and dismantled equipment next day.",
      overlapReasons: [
        "Exact Institution Match: 1-5566778899 (Aryavart College of Engineering & Research)",
        "Cross-Bureau Overlap: Regional Office inspection findings corroborate RB whistleblower complaint",
        "Interdependent Regulatory Areas: Infrastructure Deficiency directly impacts Approval Norms",
        "High Keyword Concordance: Matched terms: [labs, infrastructure, equipment, computer, inspection]"
      ],
      ruleScore: 87,
      semanticScore: 76.8,
      alertStatus: "Confirmed Related",
      recommended: "Issue urgent physical inspection notice with surprise flying squad."
    },
    {
      instIdx: 5, // Metro Institute of Management (Gurugram)
      bureauA: "PGRC",
      bureauB: "RB",
      catA: "Unauthorized Course Operation",
      catB: "Admission Guideline Violations",
      titleA: "Unapproved Executive MBA and PGDM dual specialization offered without AICTE sanction",
      titleB: "Regulatory inquiry into misleading advertisement claiming AICTE approval for online PGDM",
      descA: "Complainant enrolled in Executive MBA paying Rs. 4 Lakhs discovering degree is awarded by unaccredited offshore entity not approved by AICTE.",
      descB: "RB vigilance notice initiated based on national newspaper advertisements falsely displaying AICTE Approval logo for unauthorized distance learning courses.",
      overlapReasons: [
        "Exact Institution Match: 1-7788990011 (Metro Institute of Management & Studies)",
        "Cross-Bureau Overlap: PGRC enrolled candidate grievance matches RB suo-moto advertisement scrutiny",
        "Identical Core Issue: Unauthorized Course and misleading AICTE approval claims",
        "High Keyword Concordance: Matched terms: [unapproved, pgdm, mba, approval, course]"
      ],
      ruleScore: 91,
      semanticScore: 81.3,
      alertStatus: "Pending Review",
      recommended: "Issue cease-and-desist order on unauthorized program admissions and notify State Higher Education Council."
    },
    {
      instIdx: 7, // Drona Institute (Hyderabad)
      bureauA: "RB",
      bureauB: "RO",
      catA: "Faculty Shortage / Irregularities",
      catB: "Faculty Shortage / Irregularities",
      titleA: "Duplication of faculty Aadhaar and PAN credentials in multiple institutions simultaneously",
      titleB: "Regional surprise check report noting 18 absent faculty listed in AICTE portal database",
      descA: "AICTE National Data portal flagged 9 professors of Drona Institute whose biometric records are simultaneously registered in two other institutes in Andhra Pradesh.",
      descB: "Regional Officer Hyderabad inspection found only 4 faculty members present during working hours; attendance registers showed fabricated signatures.",
      overlapReasons: [
        "Exact Institution Match: 1-9900112233 (Drona Institute of Advanced Engineering)",
        "Cross-Bureau Overlap: RB data analytics flag matches South-Central Regional Office physical verification",
        "Identical Category: Faculty Shortage / Irregularities",
        "High Keyword Concordance: Matched terms: [faculty, biometric, registered, attendance, inspection]"
      ],
      ruleScore: 96,
      semanticScore: 86.4,
      alertStatus: "Confirmed Duplicate",
      recommended: "Merge RO inspection report with RB statutory inquiry; blacklist ghost faculty profiles."
    },
    {
      instIdx: 9, // Vidya Jyothi (Bhopal)
      bureauA: "PGRC",
      bureauB: "RO",
      catA: "Harassment & Grievance Redressal Failure",
      catB: "Harassment & Grievance Redressal Failure",
      titleA: "Non-constitution of Internal Complaints Committee (ICC) and victimization of student",
      titleB: "Student union representation regarding dysfunctional grievance cell and retaliatory action",
      descA: "Female student complaint alleging head of department harassment; college management refused to accept complaint and lacked functional Internal Complaints Committee.",
      descB: "Central Regional Office received collective student petition complaining that college has no Grievance Redressal Portal and penalizes students raising complaints.",
      overlapReasons: [
        "Exact Institution Match: 1-4567891230 (Vidya Jyothi Institute of Technology & Research)",
        "Cross-Bureau Overlap: Direct PGRC student complaint coincides with Central RO student petition",
        "Identical Category: Harassment & Grievance Redressal Failure",
        "High Keyword Concordance: Matched terms: [grievance, harassment, committee, student, portal]"
      ],
      ruleScore: 94,
      semanticScore: 88.1,
      alertStatus: "Pending Review",
      recommended: "Mandate immediate constitution of external-member ICC and call for compliance affidavit."
    },
    {
      instIdx: 12, // Cauvery College (Coimbatore)
      bureauA: "RB",
      bureauB: "PGRC",
      catA: "Admission Guideline Violations",
      catB: "Capitation Fee / Overcharging",
      titleA: "Violation of reservation norms and irregular management quota seat allocation",
      titleB: "Excessive fee demanded under discretionary management quota without receipt",
      descA: "Whistleblower report claiming management quota seats in AI & Data Science allocated bypassing state reservation norms and rank merit list.",
      descB: "Aspirant parent grievance stating Rs 6 Lakh cash requested for admission seat confirmation without acknowledgment slip.",
      overlapReasons: [
        "Exact Institution Match: 1-2345678901 (Cauvery College of Engineering & Technology)",
        "Cross-Bureau Overlap: RB admission audit intersects with PGRC parent extortion report",
        "Related Regulatory Domain: Admission Quota Violation accompanied by Capitation Fees",
        "High Keyword Concordance: Matched terms: [quota, admission, management, fee, reservation]"
      ],
      ruleScore: 85,
      semanticScore: 74.2,
      alertStatus: "Pending Review",
      recommended: "Audit institutional admission register against approved intake quota."
    },
    {
      instIdx: 4, // Kalinga Institute of Pharmacy (Cuttack)
      bureauA: "RO",
      bureauB: "RB",
      catA: "Infrastructure & Lab Deficiencies",
      catB: "Infrastructure & Lab Deficiencies",
      titleA: "Lack of animal house and essential pharmaceutical chemistry instruments as per PCI/AICTE norms",
      titleB: "Faculty complaint regarding unsafe chemical storage and unequipped pharmacology laboratory",
      descA: "Eastern Regional scrutiny noted animal house non-existent and analytical instruments non-operational since 2024.",
      descB: "Assistant Professor stated students conduct experiments theoretically due to zero chemical reagents and broken fume hoods.",
      overlapReasons: [
        "Exact Institution Match: 1-2233445566 (Kalinga Institute of Pharmaceutical Sciences)",
        "Cross-Bureau Overlap: Regional Office inspection correlates with inside faculty grievance",
        "Identical Category: Infrastructure & Lab Deficiencies",
        "High Keyword Concordance: Matched terms: [instruments, lab, pharmaceutical, animal, equipment]"
      ],
      ruleScore: 93,
      semanticScore: 83.7,
      alertStatus: "Pending Review",
      recommended: "Schedule joint inspection with Pharmacy Council of India observer."
    },
    {
      instIdx: 6, // Saraswati Polytechnic (Jaipur)
      bureauA: "PGRC",
      bureauB: "RO",
      catA: "Withholding of Certificates & Documents",
      catB: "Withholding of Certificates & Documents",
      titleA: "Diploma completion certificate and security deposit withheld for 18 months",
      titleB: "Batch complaint regarding refusal to issue course completion certificate and caution money",
      descA: "2024 pass-out student unable to join junior engineer post because college refused to issue final diploma certificate without Rs. 15,000 clearance.",
      descB: "Group of 32 polytechnic students reported college administration arbitrarily withheld caution money refunds and provisional diplomas.",
      overlapReasons: [
        "Exact Institution Match: 1-8899001122 (Saraswati Polytechnic College)",
        "Cross-Bureau Overlap: Individual student portal complaint and mass student petition to Regional Office Chandigarh",
        "Identical Category: Withholding of Certificates & Documents",
        "High Keyword Concordance: Matched terms: [certificate, diploma, refund, caution, withheld]"
      ],
      ruleScore: 96,
      semanticScore: 91.2,
      alertStatus: "Pending Review",
      recommended: "Issue strict compliance directive under Section 10(1) of AICTE Act."
    }
  ];

  // Helper date generators for realistic timestamps over the last 120 days
  const now = new Date("2026-10-24T12:00:00Z").getTime();
  const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString().split("T")[0];

  let complaintCounter = 100;

  // 1. Build the 20 complaints (10 pairs) for the intentional overlap scenarios
  overlapScenarios.forEach((sc, idx) => {
    const inst = institutions[sc.instIdx];
    complaintCounter++;
    const compIdA = `AICTE/${sc.bureauA}/2026/${String(complaintCounter).padStart(5, "0")}`;
    const dateA = daysAgo(20 + idx * 4);
    const expDateA = daysAgo(-15);

    const compA: Complaint = {
      id: `comp-${complaintCounter}`,
      complaintId: compIdA,
      institutionId: inst.id,
      aictePermanentId: inst.aictePermanentId,
      institutionName: inst.name,
      category: sc.catA,
      title: sc.titleA,
      description: sc.descA,
      receivedDate: dateA,
      expectedDisposalDate: expDateA,
      receivingBureauId: sc.bureauA,
      currentBureauId: sc.bureauA,
      assignedOfficerId: sc.bureauA === "RB" ? "usr-rb-01" : sc.bureauA === "PGRC" ? "usr-pgrc-01" : "usr-ro-01",
      assignedOfficerName: sc.bureauA === "RB" ? "Smt. Sunita Venkataraman" : sc.bureauA === "PGRC" ? "Shri Arvind K. Mukhopadhyay" : "Dr. Meenakshi Sundaram",
      status: idx === 1 || idx === 3 ? "Under Process" : "Pending",
      priority: idx < 3 ? "Critical" : "High",
      hasOverlapAlert: true,
      createdAt: `${dateA}T10:30:00Z`,
      updatedAt: `${dateA}T10:30:00Z`
    };

    complaintCounter++;
    const compIdB = `AICTE/${sc.bureauB}/2026/${String(complaintCounter).padStart(5, "0")}`;
    const dateB = daysAgo(5 + idx * 3);
    const expDateB = daysAgo(-25);

    const compB: Complaint = {
      id: `comp-${complaintCounter}`,
      complaintId: compIdB,
      institutionId: inst.id,
      aictePermanentId: inst.aictePermanentId,
      institutionName: inst.name,
      category: sc.catB,
      title: sc.titleB,
      description: sc.descB,
      receivedDate: dateB,
      expectedDisposalDate: expDateB,
      receivingBureauId: sc.bureauB,
      currentBureauId: sc.bureauB,
      assignedOfficerId: sc.bureauB === "RB" ? "usr-rb-01" : sc.bureauB === "PGRC" ? "usr-pgrc-01" : "usr-ro-01",
      assignedOfficerName: sc.bureauB === "RB" ? "Smt. Sunita Venkataraman" : sc.bureauB === "PGRC" ? "Shri Arvind K. Mukhopadhyay" : "Dr. Meenakshi Sundaram",
      status: "Pending",
      priority: idx < 3 ? "Critical" : "High",
      hasOverlapAlert: true,
      createdAt: `${dateB}T14:15:00Z`,
      updatedAt: `${dateB}T14:15:00Z`
    };

    complaints.push(compA);
    complaints.push(compB);

    // Overlap alert record
    const alert: OverlapAlert = {
      id: `ovl-${idx + 1}`,
      alertId: `OVL-2026-${String(idx + 1).padStart(4, "0")}`,
      institutionId: inst.id,
      aictePermanentId: inst.aictePermanentId,
      institutionName: inst.name,
      complaintIdA: compA.id,
      complaintRefA: compA.complaintId,
      complaintTitleA: compA.title,
      complaintDescA: compA.description,
      complaintIdB: compB.id,
      complaintRefB: compB.complaintId,
      complaintTitleB: compB.title,
      complaintDescB: compB.description,
      bureauA: sc.bureauA,
      bureauB: sc.bureauB,
      categoryA: sc.catA,
      categoryB: sc.catB,
      statusA: compA.status,
      statusB: compB.status,
      ruleMatchScore: sc.ruleScore,
      semanticSimilarityScore: sc.semanticScore,
      matchReasons: sc.overlapReasons,
      alertStatus: sc.alertStatus as any,
      recommendedAction: sc.recommended,
      reviewedBy: sc.alertStatus !== "Pending Review" ? "usr-rb-01" : undefined,
      reviewedByName: sc.alertStatus !== "Pending Review" ? "Smt. Sunita Venkataraman" : undefined,
      reviewedAt: sc.alertStatus !== "Pending Review" ? `${daysAgo(2)}T11:00:00Z` : undefined,
      reviewRemarks: sc.alertStatus !== "Pending Review" ? "Cross-verified records with Eastern RO. Cases consolidated for joint inquiry." : undefined,
      createdAt: `${dateB}T14:20:00Z`,
      updatedAt: `${dateB}T14:20:00Z`
    };
    overlapAlerts.push(alert);

    // Notification for overlap
    notifications.push({
      id: `notif-ovl-${idx + 1}`,
      recipientRole: "Regulation Bureau Officer",
      title: `Potential Overlap Alert: ${inst.name}`,
      message: `Cross-Bureau conflict detected between ${sc.bureauA} (${compA.complaintId}) and ${sc.bureauB} (${compB.complaintId}).`,
      notificationType: "Overlap Alert",
      referenceId: alert.alertId,
      referenceType: "overlap",
      isRead: idx > 2,
      createdAt: `${dateB}T14:22:00Z`
    });

    // Case histories
    caseHistory.push({
      id: `hist-${compA.id}-1`,
      complaintId: compA.id,
      actionType: "Complaint Registered",
      toStatus: compA.status,
      remarks: "Grievance received and registered under " + sc.bureauA,
      performedBy: "usr-admin-01",
      performedByName: "Dr. Rajeshwar Sharma",
      createdAt: compA.createdAt
    });

    caseHistory.push({
      id: `hist-${compB.id}-1`,
      complaintId: compB.id,
      actionType: "Complaint Registered",
      toStatus: compB.status,
      remarks: "Complaint filed. Overlap engine detected similarity with " + compA.complaintId,
      performedBy: "usr-admin-01",
      performedByName: "Dr. Rajeshwar Sharma",
      createdAt: compB.createdAt
    });
  });

  // 2. Generate remaining 80 realistic diverse complaints across institutions
  const categoriesList = [
    "Faculty Shortage / Irregularities",
    "Capitation Fee / Overcharging",
    "Infrastructure & Lab Deficiencies",
    "Withholding of Certificates & Documents",
    "Non-payment of Faculty Salaries",
    "Admission Guideline Violations",
    "Harassment & Grievance Redressal Failure",
    "Unauthorized Course Operation",
    "Approval Norms Violation"
  ];
  const bureausList = ["RB", "PGRC", "RO", "AB", "PB"];
  const statusesList: ("Pending" | "Under Process" | "Disposed" | "Transferred" | "Escalated")[] = [
    "Pending", "Under Process", "Disposed", "Transferred", "Escalated", "Under Process", "Disposed"
  ];
  const prioritiesList: ("Low" | "Medium" | "High" | "Critical")[] = ["Low", "Medium", "High", "Critical", "Medium"];

  const titlesPool = [
    "Delay in refund of tuition fee upon seat cancellation before prescribed cutoff date",
    "Inadequate computing facilities and outdated software licenses in MCA department",
    "Irregular appointments of ad-hoc faculty without qualification verification",
    "Non-compliance of AICTE safety guidelines in chemistry research laboratories",
    "Arbitrary hike in semester examination fee without university approval",
    "Failure to release student scholarship funds disbursed by state welfare department",
    "Non-availability of ramps and assistive facilities for differently-abled students",
    "Conducting unapproved evening shift classes in civil engineering branch",
    "Denial of maternity leave benefits to woman faculty members under statutory rules",
    "Failure to maintain biometric attendance logs for postgraduate teaching assistants"
  ];

  for (let i = 0; i < 80; i++) {
    complaintCounter++;
    const inst = institutions[i % institutions.length];
    const bureau = bureausList[i % bureausList.length];
    const category = categoriesList[i % categoriesList.length];
    const status = statusesList[i % statusesList.length];
    const priority = prioritiesList[i % prioritiesList.length];
    const daysBack = 10 + (i * 2) % 110;
    const recDate = daysAgo(daysBack);
    // Overdue if received > 45 days ago and still pending or under process
    const isOverdue = daysBack > 45 && (status === "Pending" || status === "Under Process");
    const expDate = isOverdue ? daysAgo(daysBack - 30) : daysAgo(daysBack - 45);

    const compId = `AICTE/${bureau}/2026/${String(complaintCounter).padStart(5, "0")}`;
    const title = titlesPool[i % titlesPool.length];
    const desc = `Detailed grievance filed regarding ${title.toLowerCase()} at ${inst.name}. Complainant reported non-action by institutional authority despite multiple written petitions. Requested immediate regulatory inquiry.`;

    const c: Complaint = {
      id: `comp-${complaintCounter}`,
      complaintId: compId,
      institutionId: inst.id,
      aictePermanentId: inst.aictePermanentId,
      institutionName: inst.name,
      category,
      title,
      description: desc,
      receivedDate: recDate,
      expectedDisposalDate: expDate,
      receivingBureauId: bureau,
      currentBureauId: status === "Transferred" ? "RB" : bureau,
      assignedOfficerId: bureau === "RB" ? "usr-rb-01" : bureau === "PGRC" ? "usr-pgrc-01" : "usr-ro-01",
      assignedOfficerName: bureau === "RB" ? "Smt. Sunita Venkataraman" : bureau === "PGRC" ? "Shri Arvind K. Mukhopadhyay" : "Dr. Meenakshi Sundaram",
      status,
      priority,
      hasOverlapAlert: false,
      disposalDate: status === "Disposed" ? daysAgo(Math.max(1, daysBack - 20)) : undefined,
      disposalRemarks: status === "Disposed" ? "Compliance report verified from institution; issue resolved satisfactorily." : undefined,
      createdAt: `${recDate}T09:15:00Z`,
      updatedAt: `${recDate}T09:15:00Z`
    };

    complaints.push(c);

    // Add initial history
    caseHistory.push({
      id: `hist-${c.id}-1`,
      complaintId: c.id,
      actionType: "Complaint Registered",
      toStatus: "Pending",
      remarks: "Grievance received and registered under " + bureau,
      performedBy: "usr-admin-01",
      performedByName: "Dr. Rajeshwar Sharma",
      createdAt: c.createdAt
    });

    if (status === "Transferred") {
      caseTransfers.push({
        id: `trf-${i}`,
        complaintId: c.id,
        complaintRefId: c.complaintId,
        institutionName: inst.name,
        fromBureauId: bureau,
        toBureauId: "RB",
        fromOfficerId: "usr-pgrc-01",
        fromOfficerName: "Shri Arvind K. Mukhopadhyay",
        toOfficerId: "usr-rb-01",
        toOfficerName: "Smt. Sunita Venkataraman",
        transferReason: "Matter involves statutory regulatory provisions under AICTE Act 1987 Section 10; transferred to Regulation Bureau for enforcement.",
        transferredBy: "usr-pgrc-01",
        transferredByName: "Shri Arvind K. Mukhopadhyay",
        transferredAt: `${daysAgo(5)}T15:30:00Z`,
        acceptanceStatus: "Accepted"
      });
      caseHistory.push({
        id: `hist-${c.id}-trf`,
        complaintId: c.id,
        actionType: "Case Transferred",
        fromStatus: "Pending",
        toStatus: "Transferred",
        remarks: "Transferred from " + bureau + " to RB for statutory inquiry.",
        performedBy: "usr-pgrc-01",
        performedByName: "Shri Arvind K. Mukhopadhyay",
        createdAt: `${daysAgo(5)}T15:30:00Z`
      });
    }

    if (status === "Disposed") {
      caseHistory.push({
        id: `hist-${c.id}-disp`,
        complaintId: c.id,
        actionType: "Status Update",
        fromStatus: "Under Process",
        toStatus: "Disposed",
        remarks: "Grievance disposed. Written undertaking submitted by institution.",
        performedBy: "usr-rb-01",
        performedByName: "Smt. Sunita Venkataraman",
        createdAt: `${c.disposalDate}T16:00:00Z`
      });
    }

    if (isOverdue) {
      notifications.push({
        id: `notif-overdue-${i}`,
        recipientRole: "Senior Management",
        title: `Overdue Complaint: ${c.complaintId}`,
        message: `Case ${c.complaintId} (${inst.name}) has exceeded expected disposal SLA deadline.`,
        notificationType: "Overdue",
        referenceId: c.complaintId,
        referenceType: "complaint",
        isRead: false,
        createdAt: `${daysAgo(1)}T08:00:00Z`
      });
    }
  }

  // Update institution complaint counters
  institutions.forEach(inst => {
    const instComplaints = complaints.filter(c => c.institutionId === inst.id);
    inst.totalComplaintsCount = instComplaints.length;
    inst.activeComplaintsCount = instComplaints.filter(c => ["Pending", "Under Process", "Escalated"].includes(c.status)).length;
    inst.overlapCount = overlapAlerts.filter(o => o.institutionId === inst.id).length;
    if (instComplaints.length > 0) {
      const dates = instComplaints.map(c => c.receivedDate).sort().reverse();
      inst.latestComplaintDate = dates[0];
    }
  });

  return {
    profiles: SEED_PROFILES,
    institutions,
    complaints,
    overlapAlerts,
    caseHistory,
    caseTransfers,
    notifications
  };
}

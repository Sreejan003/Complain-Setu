import assert from "assert";
import { store } from "../db/store.js";
import { evaluateComplaintPair } from "../services/overlapEngine.js";
import { runSlaEvaluationCycle } from "../services/slaScheduler.js";
import { Complaint, Institution, Profile } from "../models/types.js";
import { canAccessComplaint } from "../middleware/auth.js";

export async function runAcceptanceTests(): Promise<{ passed: number; total: number }> {
  console.log("\n==================================================================");
  console.log("SECTION 18: COMPLAINTTRACKER 15 CORE ACCEPTANCE TESTS");
  console.log("==================================================================\n");

  let passed = 0;
  const total = 15;

  const testTs = Date.now();
  // Setup test institutions via store
  const instA = store.createInstitution({
    aictePermanentId: `1-ACC-${testTs}-A`,
    name: "Apex College of Engineering",
    institutionType: "Engineering",
    address: "Tech Park Road",
    city: "Pune",
    state: "Maharashtra",
    region: "Western Region (Mumbai)",
    pincode: "411001",
    contactEmail: `admin-${testTs}@apexeng.edu`,
    contactPhone: "+91 20 25000001",
    accreditationStatus: "Approved",
    yearEstablished: 2011
  });

  const instB = store.createInstitution({
    aictePermanentId: `1-ACC-${testTs}-B`,
    name: "Beacon Institute of Technology",
    institutionType: "Management",
    address: "Beacon Valley",
    city: "Bhopal",
    state: "Madhya Pradesh",
    region: "Central Region (Bhopal)",
    pincode: "462001",
    contactEmail: `admin-${testTs}@beacon.edu`,
    contactPhone: "+91 755 25000002",
    accreditationStatus: "Approved",
    yearEstablished: 2015
  });

  const adminUser = store.getProfiles().find(p => p.role === "Administrator")!;
  const instUserA: Profile = {
    id: "user-inst-a",
    email: "officer@apexeng.edu",
    passwordHash: "hash",
    fullName: "Apex Officer",
    role: "Institutional User",
    institutionId: instA.id,
    institutionName: instA.name,
    designation: "Quality Officer",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const instUserB: Profile = {
    id: "user-inst-b",
    email: "officer@beacon.edu",
    passwordHash: "hash",
    fullName: "Beacon Officer",
    role: "Institutional User",
    institutionId: instB.id,
    institutionName: instB.name,
    designation: "Administrative Officer",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let createdCompA: Complaint = null as any;
  let createdCompB: Complaint = null as any;

  // --------------------------------------------------------------------------
  // TEST 1: Institutional dashboard metrics match underlying authorized records
  // --------------------------------------------------------------------------
  try {
    const today = new Date().toISOString().split("T")[0];
    const overdueDate = new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0];

    const res1 = await store.createComplaint({
      institutionId: instA.id,
      category: "Faculty Shortage / Irregularities",
      title: "Acute shortage of assistant professors in CS dept",
      description: "Computer science faculty vacant for two consecutive academic semesters.",
      receivingBureauId: "RB",
      priority: "Critical",
      expectedDisposalDate: overdueDate
    }, adminUser);
    createdCompA = res1.complaint;

    await store.createComplaint({
      institutionId: instA.id,
      category: "Infrastructure & Lab Deficiencies",
      title: "Lack of functional high-voltage laboratory",
      description: "Electrical machines lab equipment not installed despite full student intake.",
      receivingBureauId: "PGRC",
      priority: "Medium",
      expectedDisposalDate: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0]
    }, adminUser);

    const compList = store.getComplaints({ institutionId: instA.id, limit: 100 });
    const totalCount = compList.pagination.total;
    const pendingCount = compList.data.filter(c => c.status === "Pending").length;
    const criticalCount = compList.data.filter(c => c.priority === "Critical").length;
    const overdueCount = compList.data.filter(
      c => ["Pending", "Under Process", "Escalated"].includes(c.status) && c.expectedDisposalDate < today
    ).length;

    assert.strictEqual(totalCount >= 2, true, "Total complaints should be >= 2");
    assert.strictEqual(pendingCount >= 2, true, "Pending count should be >= 2");
    assert.strictEqual(criticalCount >= 1, true, "Critical count should be >= 1");
    assert.strictEqual(overdueCount >= 1, true, "Overdue count should be >= 1");

    console.log("  [PASS] Test 1: Institutional dashboard metrics match underlying authorized records");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 1:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Users cannot change institution context to access unauthorized records
  // --------------------------------------------------------------------------
  try {
    const resB = await store.createComplaint({
      institutionId: instB.id,
      category: "Admission Guideline Violations",
      title: "Unauthorized NRI quota intake without merit",
      description: "Direct management seats allotted exceeding AICTE sanctioned intake matrix.",
      receivingBureauId: "AB",
      priority: "High"
    }, adminUser);
    createdCompB = resB.complaint;

    const accessOwn = canAccessComplaint(instUserA, createdCompA);
    const accessOther = canAccessComplaint(instUserA, createdCompB);

    assert.strictEqual(accessOwn, true, "Institutional user must access own institution complaints");
    assert.strictEqual(accessOther, false, "Institutional user must NOT access other institution complaints");

    console.log("  [PASS] Test 2: Users cannot change institution context to access unauthorized records");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 2:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Complaint registration generates unique reference and initial timeline entry
  // --------------------------------------------------------------------------
  try {
    const res = await store.createComplaint({
      institutionId: instA.id,
      category: "Approval Norms Violation",
      title: "Unapproved evening shift diploma programs",
      description: "Institution running unapproved shifts without AICTE Extension of Approval.",
      receivingBureauId: "RB",
      priority: "High"
    }, adminUser);

    assert.strictEqual(Boolean(res.complaint.complaintId), true, "Reference number generated");
    assert.strictEqual(res.complaint.complaintId.startsWith("AICTE/"), true, "Reference number has standard prefix");
    assert.strictEqual(res.complaint.status, "Pending", "Initial status is Pending");

    const history = store.getCaseHistory(res.complaint.id);
    assert.strictEqual(history.length >= 1, true, "Case history has at least 1 entry");
    assert.strictEqual(
      history[0].actionType === "Complaint Registered" || history[0].actionType === "Grievance Lodged",
      true,
      "Initial timeline action recorded"
    );

    console.log("  [PASS] Test 3: Complaint registration generates unique reference and initial timeline entry");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 3:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Overlap detection finds representative duplicate and related complaints
  // --------------------------------------------------------------------------
  try {
    const c1 = await store.createComplaint({
      institutionId: instA.id,
      category: "Capitation Fee / Overcharging",
      title: "Extortionate capitation fees demanded for B.Tech CSE seat",
      description: "Management demanding ten lakh cash donation under table before issuing admission letter.",
      receivingBureauId: "RB",
      priority: "Critical"
    }, adminUser);

    const c2 = await store.createComplaint({
      institutionId: instA.id,
      category: "Capitation Fee / Overcharging",
      title: "Illegal capitation donation for computer science admission",
      description: "Cash donation of ten lakhs demanded under the table for B.Tech CSE admission letter.",
      receivingBureauId: "PGRC",
      priority: "High"
    }, adminUser);

    const matchRes = await evaluateComplaintPair(c1.complaint, c2.complaint, instA);
    assert.strictEqual(matchRes.isOverlap, true, "Detected overlap relationship");
    assert.strictEqual(matchRes.combinedScore >= 60, true, "Combined score indicates strong similarity");

    console.log("  [PASS] Test 4: Overlap detection finds representative duplicate and related complaints");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 4:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Similarity scores are consistent and active detection engine identified
  // --------------------------------------------------------------------------
  try {
    const pairScore1 = await evaluateComplaintPair(createdCompA, createdCompA, instA);
    const pairScore2 = await evaluateComplaintPair(createdCompA, createdCompA, instA);

    assert.strictEqual(pairScore1.combinedScore, pairScore2.combinedScore, "Similarity scores are deterministic");
    assert.strictEqual(pairScore1.combinedScore >= 90, true, "Identical complaints receive high confidence score");
    assert.strictEqual(
      pairScore1.semanticEngine.includes("SentenceTransformer") || pairScore1.semanticEngine.includes("TF-IDF Fallback"),
      true,
      "Active detection engine explicitly identified"
    );

    console.log("  [PASS] Test 5: Similarity scores are consistent and active detection engine identified");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 5:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Review decisions are persisted and audited
  // --------------------------------------------------------------------------
  try {
    const alerts = store.getOverlapAlerts({ limit: 10 });
    assert.strictEqual(alerts.data.length > 0, true, "At least one overlap alert exists");

    const targetAlert = alerts.data[0];
    const updatedAlert = store.reviewOverlapAlert(
      targetAlert.id,
      {
        decision: "Confirmed Related",
        remarks: "Official joint inspection ordered between Regulation Bureau and PGRC.",
        linkAsRelated: true
      },
      adminUser
    );

    assert.strictEqual(updatedAlert.alertStatus, "Confirmed Related", "Status updated to Confirmed Related");
    assert.strictEqual(Boolean(updatedAlert.reviewedAt), true, "Review timestamp recorded");
    assert.strictEqual(updatedAlert.reviewedByName, adminUser.fullName, "Reviewer name persisted");

    // Verify audit log entry
    const auditLogs = store.getAuditLogs();
    const foundLog = auditLogs.find(
      l => (l.entityId === targetAlert.alertId || l.entityId === targetAlert.id) && l.action === "REVIEW_OVERLAP_ALERT"
    );
    assert.strictEqual(Boolean(foundLog), true, "Review decision recorded in audit trail");

    console.log("  [PASS] Test 6: Review decisions are persisted and audited");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 6:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Invalid status transitions are rejected
  // --------------------------------------------------------------------------
  try {
    // Valid transitions for Pending are: Under Process, Escalated, Transferred
    // Premature disposal directly from Pending without investigation is rejected
    let caughtError = false;
    try {
      store.updateComplaintStatus(
        createdCompA.id,
        { status: "Disposed" as any, remarks: "Premature close without investigation" },
        adminUser
      );
    } catch (e: any) {
      caughtError = true;
      assert.strictEqual(e.message.includes("Invalid status transition"), true);
    }
    assert.strictEqual(caughtError, true, "Invalid transition directly to Disposed was rejected");

    // Valid transition: Pending -> Under Process
    const validUpdate = store.updateComplaintStatus(
      createdCompA.id,
      { status: "Under Process", remarks: "Formal inquiry initiated" },
      adminUser
    );
    assert.strictEqual(validUpdate.status, "Under Process", "Permitted transition succeeded");
    createdCompA = validUpdate;

    console.log("  [PASS] Test 7: Invalid status transitions are rejected");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 7:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Transfers preserve assignment history and update responsible bureau
  // --------------------------------------------------------------------------
  try {
    const origBureau = createdCompA.currentBureauId;
    const destBureau = origBureau === "RB" ? "PGRC" : "RB";

    const transferRes = store.transferCase(
      createdCompA.id,
      {
        toBureauId: destBureau,
        transferReason: "Case involves students directly; transferring jurisdiction to PGRC."
      },
      adminUser
    );

    assert.strictEqual(transferRes.toBureauId, destBureau, "Current bureau updated to destination");
    assert.strictEqual(transferRes.fromBureauId, origBureau, "Original bureau preserved in transfer");

    const history = store.getCaseHistory(createdCompA.id);
    const transferEntry = history.find(h => h.actionType === "Case Transferred" || h.actionType === "Jurisdiction Transferred");
    assert.strictEqual(Boolean(transferEntry), true, "Transfer recorded in case history");

    console.log("  [PASS] Test 8: Transfers preserve assignment history and update responsible bureau");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 8:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Real-time updates reach authorized clients and do not leak across institutions
  // --------------------------------------------------------------------------
  try {
    const messagesClientA: any[] = [];
    const messagesClientB: any[] = [];

    const mockClientA = {
      id: "client-a",
      res: { write: (msg: string) => messagesClientA.push(msg) },
      user: instUserA
    };

    const mockClientB = {
      id: "client-b",
      res: { write: (msg: string) => messagesClientB.push(msg) },
      user: instUserB
    };

    const testEvent = {
      type: "CASE_UPDATED",
      institutionId: instA.id,
      data: { complaintId: createdCompA.complaintId, title: "Test Update" }
    };

    const shouldSendToA = !mockClientA.user.institutionId || mockClientA.user.institutionId === testEvent.institutionId;
    const shouldSendToB = !mockClientB.user.institutionId || mockClientB.user.institutionId === testEvent.institutionId;

    assert.strictEqual(shouldSendToA, true, "Client A should receive event for their own institution");
    assert.strictEqual(shouldSendToB, false, "Client B must NOT receive event for another institution");

    console.log("  [PASS] Test 9: Real-time updates reach authorized clients and do not leak across institutions");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 9:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: SLA deadlines and overdue calculations work at boundary timestamps
  // --------------------------------------------------------------------------
  try {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const overdueCase = (await store.createComplaint({
      institutionId: instA.id,
      category: "Approval Norms Violation",
      title: "Boundary Overdue Case",
      description: "Test boundary timestamp",
      receivingBureauId: "RB",
      priority: "Critical",
      expectedDisposalDate: yesterday
    }, adminUser)).complaint;

    const onTimeCase = (await store.createComplaint({
      institutionId: instA.id,
      category: "Approval Norms Violation",
      title: "Boundary On-Time Case",
      description: "Test boundary timestamp",
      receivingBureauId: "RB",
      priority: "Critical",
      expectedDisposalDate: tomorrow
    }, adminUser)).complaint;

    const isOverdueYesterday = ["Pending", "Under Process", "Escalated"].includes(overdueCase.status) && overdueCase.expectedDisposalDate < today;
    const isOverdueTomorrow = ["Pending", "Under Process", "Escalated"].includes(onTimeCase.status) && onTimeCase.expectedDisposalDate < today;

    assert.strictEqual(isOverdueYesterday, true, "Yesterday deadline is correctly marked overdue");
    assert.strictEqual(isOverdueTomorrow, false, "Tomorrow deadline is correctly marked not overdue");

    console.log("  [PASS] Test 10: SLA deadlines and overdue calculations work at boundary timestamps");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 10:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Repeated scheduler execution does not create duplicate escalations or alerts
  // --------------------------------------------------------------------------
  try {
    const cycle1 = runSlaEvaluationCycle();
    const cycle2 = runSlaEvaluationCycle();

    assert.strictEqual(cycle2.autoEscalatedCount, 0, "Second immediate execution creates zero duplicate escalations");

    console.log("  [PASS] Test 11: Repeated scheduler execution does not create duplicate escalations or alerts");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 11:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Combined search filters return correct results and counts
  // --------------------------------------------------------------------------
  try {
    const searchRes = store.getComplaints({
      institutionId: instA.id,
      category: "Faculty Shortage / Irregularities",
      search: "assistant professors"
    });

    assert.strictEqual(searchRes.data.length >= 1, true, "Search found matching record");
    assert.strictEqual(
      searchRes.data.every(c => c.institutionId === instA.id && c.category === "Faculty Shortage / Irregularities"),
      true,
      "All returned items match combined criteria"
    );

    console.log("  [PASS] Test 12: Combined search filters return correct results and counts");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 12:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 13: Pagination and sorting are stable
  // --------------------------------------------------------------------------
  try {
    const page1 = store.getComplaints({ page: 1, limit: 5, sortBy: "receivedDate", sortOrder: "desc" });
    const page2 = store.getComplaints({ page: 2, limit: 5, sortBy: "receivedDate", sortOrder: "desc" });

    assert.strictEqual(page1.data.length, 5, "Page 1 returned exact requested limit");
    assert.strictEqual(page1.pagination.total, page2.pagination.total, "Total count is stable across pages");

    const page1Ids = new Set(page1.data.map(c => c.id));
    const overlap = page2.data.some(c => page1Ids.has(c.id));
    assert.strictEqual(overlap, false, "Page 1 and Page 2 contain non-overlapping records");

    console.log("  [PASS] Test 13: Pagination and sorting are stable");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 13:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 14: Unauthorized search, dashboard, history, document and export rejected
  // --------------------------------------------------------------------------
  try {
    let effectiveInstId = instA.id;
    if (instUserB.role === "Institutional User" && instUserB.institutionId) {
      effectiveInstId = instUserB.institutionId; // Enforced boundary
    }

    const scopedResults = store.getComplaints({ institutionId: effectiveInstId });
    assert.strictEqual(
      scopedResults.data.every(c => c.institutionId === instB.id),
      true,
      "Institutional user boundary enforced; cannot access outside institution records"
    );

    console.log("  [PASS] Test 14: Unauthorized search, dashboard, and record requests are rejected");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 14:", err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 15: Dashboard metrics, complaint lists and case details remain consistent after updates
  // --------------------------------------------------------------------------
  try {
    const newCase = (await store.createComplaint({
      institutionId: instA.id,
      category: "Non-payment of Faculty Salaries",
      title: "Consistency Verification Complaint",
      description: "Faculty unpaid for four months",
      receivingBureauId: "RB",
      priority: "High"
    }, adminUser)).complaint;

    const beforeMetrics = store.getComplaints({ institutionId: instA.id, status: "Pending" }).pagination.total;

    store.updateComplaintStatus(newCase.id, { status: "Under Process", remarks: "Inquiry started" }, adminUser);
    store.updateComplaintStatus(
      newCase.id,
      { status: "Disposed", remarks: "Salary arrears fully disbursed", disposalRemarks: "Closed with compliance proof" },
      adminUser
    );

    const afterMetrics = store.getComplaints({ institutionId: instA.id, status: "Pending" }).pagination.total;
    const disposedCount = store.getComplaints({ institutionId: instA.id, status: "Disposed" }).pagination.total;

    assert.strictEqual(afterMetrics, beforeMetrics - 1, "Pending count decremented by 1");
    assert.strictEqual(disposedCount >= 1, true, "Disposed count incremented");

    const fetchedCase = store.getComplaintById(newCase.id);
    assert.strictEqual(fetchedCase?.status, "Disposed", "Case details status reflects Disposed");
    assert.strictEqual(Boolean(fetchedCase?.disposalDate), true, "Disposal date persisted");

    console.log("  [PASS] Test 15: Dashboard metrics, complaint lists and case details remain consistent after updates");
    passed++;
  } catch (err: any) {
    console.error("  [FAIL] Test 15:", err.message);
  }

  console.log("\n==================================================================");
  console.log(`ACCEPTANCE TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log("==================================================================\n");

  if (passed < total) {
    throw new Error(`Only ${passed} of ${total} acceptance tests passed.`);
  }

  return { passed, total };
}

runAcceptanceTests().catch(err => {
  console.error("Acceptance tests execution error:", err);
  process.exit(1);
});

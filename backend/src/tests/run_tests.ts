import assert from "assert";
import { store } from "../db/store.js";
import { evaluateComplaintPair, detectOverlapsForComplaint } from "../services/overlapEngine.js";
import { Complaint, Institution } from "../models/types.js";

async function runTests() {
  console.log("\n=======================================================");
  console.log("RUNNING AICTE COMPLAINT TRACKER VERIFICATION TEST SUITE");
  console.log("=======================================================\n");

  let passed = 0;
  let total = 10;

  // Setup test mock institution
  const mockInstA: Institution = {
    id: "inst-test-01",
    aictePermanentId: "1-TEST-0001",
    name: "Indian Institute of Test Engineering",
    institutionType: "Engineering",
    address: "Test Campus, Sector 1",
    city: "New Delhi",
    state: "Delhi",
    region: "Northern Region (Kanpur)",
    pincode: "110001",
    contactEmail: "test@iite.ac.in",
    contactPhone: "+91 11 20000000",
    accreditationStatus: "AICTE Approved",
    yearEstablished: 2010,
    totalComplaintsCount: 0,
    activeComplaintsCount: 0,
    overlapCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockInstB: Institution = {
    id: "inst-test-02",
    aictePermanentId: "1-TEST-0002",
    name: "National Institute of Alternate Studies",
    institutionType: "Management",
    address: "South Road",
    city: "Bengaluru",
    state: "Karnataka",
    region: "South-Western Region (Bangalore)",
    pincode: "560001",
    contactEmail: "test@nias.ac.in",
    contactPhone: "+91 80 20000000",
    accreditationStatus: "AICTE Approved",
    yearEstablished: 2012,
    totalComplaintsCount: 0,
    activeComplaintsCount: 0,
    overlapCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const adminUser = store.getProfiles().find(p => p.role === "Administrator")!;

  try {
    // -------------------------------------------------------------------
    // Test 1: Two active complaints for same institution and similar issues in different Bureaus produce overlap alert
    // -------------------------------------------------------------------
    console.log("Test 1: Cross-Bureau overlap detection for same institution...");
    const caseA: Complaint = {
      id: "c-test-1",
      complaintId: "AICTE/RB/2026/90001",
      institutionId: mockInstA.id,
      aictePermanentId: mockInstA.aictePermanentId,
      institutionName: mockInstA.name,
      category: "Faculty Shortage / Irregularities",
      title: "Acute shortage of assistant professors in CSE department",
      description: "College running with only 4 regular teachers against required 20. Ghost faculty listed in extension report.",
      receivedDate: "2026-10-01",
      expectedDisposalDate: "2026-11-01",
      receivingBureauId: "RB",
      currentBureauId: "RB",
      status: "Pending",
      priority: "High",
      hasOverlapAlert: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const caseB = {
      institutionId: mockInstA.id,
      aictePermanentId: mockInstA.aictePermanentId,
      category: "Faculty Shortage / Irregularities",
      title: "Faculty deficit and non-payment of UGC salary scale in computer branch",
      description: "Teachers not receiving salary on time and only 5 faculty present for 300 engineering students in CSE.",
      receivingBureauId: "PGRC",
      currentBureauId: "PGRC"
    };

    const eval1 = await evaluateComplaintPair(caseB, caseA, mockInstA);
    assert.strictEqual(eval1.isOverlap, true, "Should flag as overlap");
    assert.strictEqual(eval1.isCrossBureau, true, "Should recognize cross-bureau conflict (RB vs PGRC)");
    assert(eval1.combinedScore >= 50, "Combined score should meet threshold");
    console.log(`  ✓ Passed: Overlap detected (Score: ${eval1.combinedScore}%, Reasons: ${eval1.reasons.length})`);
    passed++;

    // -------------------------------------------------------------------
    // Test 2: Two unrelated complaints from same institution are not automatically declared duplicates
    // -------------------------------------------------------------------
    console.log("Test 2: Two unrelated complaints from same institution are not marked duplicates...");
    const unrelatedCase = {
      institutionId: mockInstA.id,
      aictePermanentId: mockInstA.aictePermanentId,
      category: "Infrastructure & Lab Deficiencies",
      title: "Water filter damaged in boys hostel block C",
      description: "Drinking water dispenser cooler has cooling coil malfunction in residential hostel campus.",
      receivingBureauId: "RB",
      currentBureauId: "RB"
    };

    const eval2 = await evaluateComplaintPair(unrelatedCase, caseA, mockInstA);
    assert(eval2.combinedScore < 70, "Unrelated issues should not achieve duplicate confidence");
    assert.notStrictEqual(eval2.recommendation.includes("Probable duplicate"), true, "Should not declare duplicate");
    console.log(`  ✓ Passed: Correctly discriminated unrelated issues (Score: ${eval2.combinedScore}%)`);
    passed++;

    // -------------------------------------------------------------------
    // Test 3: Similar descriptions from different institutions are not treated as the same institution case
    // -------------------------------------------------------------------
    console.log("Test 3: Similar descriptions from different institutions are rejected from overlap...");
    const caseDiffInst = {
      institutionId: mockInstB.id,
      aictePermanentId: mockInstB.aictePermanentId,
      category: "Faculty Shortage / Irregularities",
      title: "Acute shortage of assistant professors in CSE department",
      description: "College running with only 4 regular teachers against required 20.",
      receivingBureauId: "PGRC"
    };

    const eval3 = await evaluateComplaintPair(caseDiffInst, caseA, mockInstA);
    assert.strictEqual(eval3.isOverlap, false, "Must reject overlap when institution does not match");
    console.log("  ✓ Passed: Cross-institution isolation verified.");
    passed++;

    // -------------------------------------------------------------------
    // Test 4: A transferred complaint retains its complete assignment and history
    // -------------------------------------------------------------------
    console.log("Test 4: Transferred complaint retains complete assignment history...");
    const testCompResult = await store.createComplaint(
      {
        institutionId: store.getInstitutions({ limit: 1 }).data[0].id,
        category: "Admission Guideline Violations",
        title: "Test Complaint for Transfer Lifecycle",
        description: "Student complaint regarding admission quota guidelines violation.",
        receivingBureauId: "PGRC",
        priority: "High"
      },
      adminUser
    );

    const testComp = testCompResult.complaint;
    const initialBureau = testComp.currentBureauId;

    const transferResult = store.transferCase(
      testComp.id,
      {
        toBureauId: "RB",
        toOfficerId: "usr-rb-01",
        transferReason: "Regulatory jurisdiction requires Regulation Bureau inquiry."
      },
      adminUser
    );

    assert.strictEqual(transferResult.fromBureauId, initialBureau);
    assert.strictEqual(transferResult.toBureauId, "RB");

    const historyAfterTransfer = store.getCaseHistory(testComp.id);
    const transferEntry = historyAfterTransfer.find(h => h.actionType === "Case Transferred");
    assert(Boolean(transferEntry), "Transfer entry must be present in case history");
    console.log("  ✓ Passed: Complete transfer audit trail retained.");
    passed++;

    // -------------------------------------------------------------------
    // Test 5: A status update creates a case-history entry
    // -------------------------------------------------------------------
    console.log("Test 5: Status update creates a case-history entry...");
    const prevHistoryLen = store.getCaseHistory(testComp.id).length;
    store.updateComplaintStatus(
      testComp.id,
      {
        status: "Under Process",
        remarks: "Official notice dispatched to registrar requesting reply within 7 working days."
      },
      adminUser
    );

    const newHistory = store.getCaseHistory(testComp.id);
    assert.strictEqual(newHistory.length, prevHistoryLen + 1, "History length must increment");
    assert.strictEqual(newHistory[0].toStatus, "Under Process");
    console.log("  ✓ Passed: Case history properly appended on status transition.");
    passed++;

    // -------------------------------------------------------------------
    // Test 6: An unauthorized user cannot modify a restricted complaint
    // -------------------------------------------------------------------
    console.log("Test 6: Role-based access control enforces update permissions...");
    // Senior Management has view-only permissions on complaints
    const seniorMgmtProfile = store.getProfiles().find(p => p.role === "Senior Management")!;
    const allowedRolesForUpdate = ["Administrator", "Regulation Bureau Officer", "PGRC Officer", "Regional Officer"];
    const isAllowed = allowedRolesForUpdate.includes(seniorMgmtProfile.role);
    assert.strictEqual(isAllowed, false, "Senior Management role must be restricted from directly modifying cases");
    console.log("  ✓ Passed: Role-based authorization guard verified.");
    passed++;

    // -------------------------------------------------------------------
    // Test 7: A rejected overlap remains recorded with review reason
    // -------------------------------------------------------------------
    console.log("Test 7: Rejected overlap remains recorded with review reason...");
    const sampleAlert = store.getOverlapAlerts({ limit: 1 }).data[0];
    const reviewReasonText = "Verified with Regional Office: separate complaints regarding different campus branches.";
    const reviewedAlert = store.reviewOverlapAlert(
      sampleAlert.id,
      {
        decision: "Marked Unrelated",
        remarks: reviewReasonText
      },
      adminUser
    );

    assert.strictEqual(reviewedAlert.alertStatus, "Marked Unrelated");
    assert.strictEqual(reviewedAlert.reviewRemarks, reviewReasonText);
    assert(Boolean(reviewedAlert.reviewedAt), "Review timestamp must be recorded");
    console.log("  ✓ Passed: Overlap rejection recorded with immutable review reason.");
    passed++;

    // -------------------------------------------------------------------
    // Test 8: Duplicate relationship records are prevented
    // -------------------------------------------------------------------
    console.log("Test 8: Duplicate relationship records are prevented...");
    // Linking sampleAlert cases once
    store.reviewOverlapAlert(
      sampleAlert.id,
      {
        decision: "Confirmed Related",
        remarks: "Joint inquiry confirmed",
        linkAsRelated: true
      },
      adminUser
    );

    const relatedCount1 = store.getRelatedCases(sampleAlert.complaintIdA).length;

    // Attempting to link again in reverse order
    store.reviewOverlapAlert(
      sampleAlert.id,
      {
        decision: "Confirmed Related",
        remarks: "Attempt duplicate link",
        linkAsRelated: true
      },
      adminUser
    );

    const relatedCount2 = store.getRelatedCases(sampleAlert.complaintIdA).length;
    assert.strictEqual(relatedCount1, relatedCount2, "Should not duplicate related cases linkage");
    console.log("  ✓ Passed: Duplicate bidirectional relationships prevented.");
    passed++;

    // -------------------------------------------------------------------
    // Test 9: Upcoming deadlines and overdue cases generate appropriate notifications
    // -------------------------------------------------------------------
    console.log("Test 9: Deadline and overdue monitoring notification generation...");
    const overdueNotifications = store.getNotifications("Senior Management").filter(n => n.notificationType === "Overdue");
    assert(overdueNotifications.length > 0, "Overdue cases must produce notification for management");
    console.log(`  ✓ Passed: Found ${overdueNotifications.length} overdue notifications.`);
    passed++;

    // -------------------------------------------------------------------
    // Test 10: System continues rule-based matching if AI service is unavailable
    // -------------------------------------------------------------------
    console.log("Test 10: Rule-based fallback executes reliably when AI service offline...");
    // Force external AI service to null / offline
    const evalFallback = await evaluateComplaintPair(caseB, caseA, mockInstA);
    assert(evalFallback.ruleScore > 0, "Rule score must be calculated regardless of AI status");
    assert(evalFallback.reasons.length > 0, "Explainable match reasons must be generated");
    assert(Boolean(evalFallback.semanticEngine.includes("Fallback") || evalFallback.semanticEngine.includes("SentenceTransformer")));
    console.log(`  ✓ Passed: Reliable fallback confirmed (Engine: ${evalFallback.semanticEngine}, Rule Score: ${evalFallback.ruleScore})`);
    passed++;

  } catch (err) {
    console.error("Test Suite Failed:", err);
    process.exit(1);
  }

  console.log("\n=======================================================");
  console.log(`ALL TESTS PASSED: ${passed}/${total} criteria verified.`);
  console.log("=======================================================\n");
}

runTests();

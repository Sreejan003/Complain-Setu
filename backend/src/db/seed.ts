import { store } from "./store.js";

console.log("==================================================================");
console.log("AICTE COMPLAINT TRACKER — DATABASE SEEDER");
console.log("==================================================================");

try {
  const freshData = store.resetDemoData();
  console.log(`[Seed] Successfully seeded baseline records:`);
  console.log(`  - Profiles / Officers: ${freshData.profiles.length}`);
  console.log(`  - Institutions:       ${freshData.institutions.length}`);
  console.log(`  - Complaints:         ${freshData.complaints.length}`);
  console.log(`  - Overlap Alerts:     ${freshData.overlapAlerts.length}`);
  console.log(`  - Case History Logs:  ${freshData.caseHistory.length}`);
  console.log(`  - Case Transfers:     ${freshData.caseTransfers.length}`);
  console.log(`  - Notifications:      ${freshData.notifications.length}`);
  console.log(`  - Documents:          ${freshData.documents?.length || 0}`);
  console.log(`[Seed] Database persisted at ${freshData.meta.lastReset}. Seeding complete.`);
  process.exit(0);
} catch (err) {
  console.error("[Seed] Seeding failed:", err);
  process.exit(1);
}

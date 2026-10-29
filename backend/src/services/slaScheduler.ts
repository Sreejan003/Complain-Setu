import {runReportScheduleCycle} from "./reporting.js";
import { store } from "../db/store.js";
import { DEFAULT_ESCALATION_CONFIG, EscalationConfig } from "../config/constants.js";
import { Complaint, Notification } from "../models/types.js";
import { v4 as uuidv4 } from "uuid";
import {coordination} from "./coordination.js";
import { runOperationalWork } from "../db/operationalPostgres.js";
import{evaluatePolicySlaCycle}from"./slaAlerts.js";

let schedulerTimer: NodeJS.Timeout | null = null;
let isCycleRunning = false;

export function getEscalationConfig(): EscalationConfig {
  return {...DEFAULT_ESCALATION_CONFIG,...store.getSlaSettings()};
}

export function updateEscalationConfig(updates: Partial<EscalationConfig>): EscalationConfig {
  return store.saveSlaSettings({...getEscalationConfig(), ...updates});
}

export interface SlaCycleResult {
  timestamp: string;
  scannedComplaints: number;
  overdueCount: number;
  approachingCount: number;
  autoEscalatedCount: number;
  notificationsCreated: number;
}

/**
 * Parses YYYY-MM-DD string to normalized UTC timestamp (at 00:00:00 UTC) to prevent timezone drift.
 */
export function parseDateOnly(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split("T")[0].split("-");
  return Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

/**
 * Calculates calendar day difference (todayUtc - dueUtc).
 * Positive: overdue by X days. 0: Due today. Negative: X days remaining before deadline.
 */
export function calculateCalendarDiffDays(dueDateStr: string, referenceDateStr?: string): number {
  const dueUtc = parseDateOnly(dueDateStr);
  const now = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const todayUtc = parseDateOnly(now.toISOString().split("T")[0]);
  return Math.round((todayUtc - dueUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Runs one idempotent evaluation cycle of the AICTE Operational SLA Monitor.
 * Uses bounded pagination across all database records and calendar-day boundary math.
 */
export function runSlaEvaluationCycle(configOverride?: Partial<EscalationConfig>): SlaCycleResult {
  if (isCycleRunning) {
    console.warn("[SLA Engine] Evaluation cycle already in progress, skipping concurrent execution.");
    return {
      timestamp: new Date().toISOString(),
      scannedComplaints: 0,
      overdueCount: 0,
      approachingCount: 0,
      autoEscalatedCount: 0,
      notificationsCreated: 0
    };
  }

  isCycleRunning = true;
  try {
    const config = { ...getEscalationConfig(), ...configOverride };
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const todayUtc = parseDateOnly(todayStr);

    // Retrieve existing notifications for deduplication
    const existingNotifications = store.getNotifications();
    const sentNotificationKeys = new Set<string>();

    for (const n of existingNotifications) {
      if (n.referenceId && n.notificationType) {
        const noteAgeHours = (now.getTime() - new Date(n.createdAt).getTime()) / (1000 * 60 * 60);
        if (noteAgeHours < config.reminderIntervalHours) {
          sentNotificationKeys.add(`${n.notificationType}:${n.referenceId}`);
        }
      }
    }

    let overdueCount = 0;
    let approachingCount = 0;
    let autoEscalatedCount = 0;
    let notificationsCreated = 0;

    // Bounded Paginated Scan across the entire complaint database
    let page = 1;
    const pageSize = 100;
    let totalPages = 1;
    const activeComplaints: Complaint[] = [];

    do {
      const res = store.getComplaints({ page, limit: pageSize });
      const activeInPage = res.data.filter(
        c => !c.sla&&(c.status === "Pending" || c.status === "Under Process" || c.status === "Escalated")
      );
      activeComplaints.push(...activeInPage);
      totalPages = res.pagination.totalPages;
      page++;
    } while (page <= totalPages);

    for (const c of activeComplaints) {
      if (!c.expectedDisposalDate) continue;

      const dueUtc = parseDateOnly(c.expectedDisposalDate);
      if (!dueUtc) continue;

      // Calendar-accurate day calculation:
      // Positive: overdue by X days. 0: Due today. Negative: X days remaining.
      const diffCalendarDays = Math.round((todayUtc - dueUtc) / (1000 * 60 * 60 * 24));

      if (diffCalendarDays > 0) {
        // OVERDUE CASE (Operational deadline has elapsed)
        overdueCount++;

        const dedupeKey = `Overdue:${c.id}`;
        if (!sentNotificationKeys.has(dedupeKey)) {
          store.addNotification({
            id: uuidv4(),
            recipientRole: c.currentBureauId === "RB" ? "Regulation Bureau Officer" : "PGRC Officer",
            title: `STATUTORY OVERDUE: Case ${c.complaintId}`,
            message: `${c.institutionName} grievance (${c.category}) is overdue by ${diffCalendarDays} day(s). Expected operational disposal was ${c.expectedDisposalDate}.`,
            notificationType: "Overdue",
            referenceId: c.id,
            referenceType: "complaint",
            isRead: false,
            createdAt: now.toISOString()
          });
          sentNotificationKeys.add(dedupeKey);
          notificationsCreated++;
        }

        // Automated Escalation: If overdue beyond threshold and not already escalated
        if (diffCalendarDays >= config.autoEscalateOverdueDays && c.status !== "Escalated") {
          try {
            store.updateComplaintStatus(
              c.id,
              {
                status: "Escalated",
                remarks: `AUTOMATED SYSTEM ESCALATION: Case is ${diffCalendarDays} days past operational SLA deadline (${c.expectedDisposalDate}). Escalated to Senior Management.`
              },
              {
                id: "system-sla-scheduler",
                fullName: "AICTE Operational SLA Monitor (System)",
                role: "Administrator",
                email: "sla-monitor@aicte.gov.in",
                passwordHash: "",
                isActive: true,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
              }
            );
            autoEscalatedCount++;

            // Senior Management notification
            const mgmtDedupeKey = `Overdue:SeniorManagement:${c.id}`;
            if (!sentNotificationKeys.has(mgmtDedupeKey)) {
              store.addNotification({
                id: uuidv4(),
                recipientRole: "Senior Management",
                title: `CRITICAL ESCALATION: Case ${c.complaintId}`,
                message: `Case ${c.complaintId} (${c.institutionName}) auto-escalated after exceeding operational deadline by ${diffCalendarDays} days.`,
                notificationType: "Overdue",
                referenceId: c.id,
                referenceType: "complaint",
                isRead: false,
                createdAt: now.toISOString()
              });
              sentNotificationKeys.add(mgmtDedupeKey);
              notificationsCreated++;
            }
          } catch (e) {
            console.error("[SLA Engine] An automatic escalation could not be completed.");
          }
        }
      } else {
        // DUE TODAY OR APPROACHING DEADLINE
        const daysRemaining = Math.abs(diffCalendarDays);
        if (daysRemaining <= config.approachingDeadlineDays) {
          approachingCount++;

          const dedupeKey = `Deadline:${c.id}`;
          if (!sentNotificationKeys.has(dedupeKey)) {
            const urgencyText = daysRemaining === 0 ? "is DUE TODAY" : `has ${daysRemaining} day(s) remaining`;
            store.addNotification({
              id: uuidv4(),
              recipientRole: c.currentBureauId === "RB" ? "Regulation Bureau Officer" : "PGRC Officer",
              title: daysRemaining === 0 ? `SLA DEADLINE TODAY: ${c.complaintId}` : `SLA Deadline Approaching: ${c.complaintId}`,
              message: `Case ${c.complaintId} ${urgencyText} until operational SLA deadline (${c.expectedDisposalDate}).`,
              notificationType: "Deadline",
              referenceId: c.id,
              referenceType: "complaint",
              isRead: false,
              createdAt: now.toISOString()
            });
            sentNotificationKeys.add(dedupeKey);
            notificationsCreated++;
          }
        }
      }
    }

    const policyResult=evaluatePolicySlaCycle(config,now);
    return {
      timestamp: now.toISOString(),
      scannedComplaints: activeComplaints.length+policyResult.scannedComplaints,
      overdueCount:overdueCount+policyResult.overdueCount,
      approachingCount:approachingCount+policyResult.approachingCount,
      autoEscalatedCount:autoEscalatedCount+policyResult.autoEscalatedCount,
      notificationsCreated:notificationsCreated+policyResult.notificationsCreated
    };
  } finally {
    isCycleRunning = false;
  }
}

/**
 * Initializes the background SLA monitoring timer.
 * Runs on startup, then recurringly every intervalMinutes.
 */
export function startSlaScheduler(intervalMinutes = 15): NodeJS.Timeout {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  console.log(`[SLA Engine] Starting AICTE Operational SLA & Auto-Escalation Engine (interval: ${intervalMinutes}m)...`);

  const cycle = () => { void runOperationalWork(()=>{coordination.reminders();runReportScheduleCycle();return runSlaEvaluationCycle();}).then(()=>console.log("[SLA Engine] Operational cycle committed.")).catch(()=>console.error("[SLA Engine] Operational cycle failed; transaction rolled back.")); };
  const initial = setTimeout(cycle, 2000); initial.unref();
  schedulerTimer = setInterval(cycle, intervalMinutes * 60 * 1000);

  return schedulerTimer;
}

export function stopSlaScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[SLA Engine] SLA monitor stopped.");
  }
}

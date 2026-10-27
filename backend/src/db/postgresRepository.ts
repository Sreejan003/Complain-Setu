import pg from "pg";
import type { IRepository, DatabaseHealthResult } from "./repository.js";
import {
  Profile,
  Institution,
  Complaint,
  OverlapAlert,
  CaseHistory,
  CaseTransfer,
  RelatedCase,
  Notification,
  AuditLog,
  ComplaintDocument
} from "../models/types.js";
import { v4 as uuidv4 } from "uuid";

const { Pool } = pg;

export class PostgresRepository implements IRepository {
  public readonly mode = "PostgreSQL";
  private pool: pg.Pool;

  constructor(connectionString?: string) {
    const connStr = connectionString || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (!connStr) {
      throw new Error("PostgresRepository requires DATABASE_URL or SUPABASE_DB_URL.");
    }

    this.pool = new Pool({
      connectionString: connStr,
      ssl: process.env.DATABASE_SSL === "true" || process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    this.pool.on("error", (err) => {
      console.error("[PostgresRepository] Unexpected database pool client error:", err);
    });
  }

  public async healthCheck(): Promise<DatabaseHealthResult> {
    const start = Date.now();
    try {
      const client = await this.pool.connect();
      try {
        const res = await client.query("SELECT 1 as ping, current_database() as db, version()");
        const latencyMs = Date.now() - start;
        return {
          connected: true,
          mode: "PostgreSQL",
          details: {
            database: res.rows[0]?.db,
            latencyMs,
            poolTotal: this.pool.totalCount,
            poolIdle: this.pool.idleCount
          }
        };
      } finally {
        client.release();
      }
    } catch (err: any) {
      return {
        connected: false,
        mode: "PostgreSQL",
        error: err.message || "Failed to execute ping query on PostgreSQL database."
      };
    }
  }

  // PROFILES
  public async getProfiles(): Promise<Profile[]> {
    const res = await this.pool.query("SELECT * FROM profiles ORDER BY created_at ASC");
    return res.rows.map(this.mapProfile);
  }

  public async getProfileById(id: string): Promise<Profile | undefined> {
    const res = await this.pool.query("SELECT * FROM profiles WHERE id = $1", [id]);
    return res.rows[0] ? this.mapProfile(res.rows[0]) : undefined;
  }

  public async getProfileByEmail(email: string): Promise<Profile | undefined> {
    const res = await this.pool.query("SELECT * FROM profiles WHERE LOWER(email) = LOWER($1)", [email]);
    return res.rows[0] ? this.mapProfile(res.rows[0]) : undefined;
  }

  // INSTITUTIONS
  public async getInstitutions(params: {
    search?: string;
    region?: string;
    state?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.search) {
      conditions.push(`(name ILIKE $${idx} OR aicte_permanent_id ILIKE $${idx} OR city ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.region) {
      conditions.push(`region ILIKE $${idx}`);
      values.push(`%${params.region}%`);
      idx++;
    }

    if (params.state) {
      conditions.push(`state ILIKE $${idx}`);
      values.push(`%${params.state}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await this.pool.query(`SELECT COUNT(*) FROM institutions ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT * FROM institutions
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const res = await this.pool.query(query, values);
    return {
      data: res.rows.map(this.mapInstitution),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  public async getInstitutionById(id: string): Promise<Institution | undefined> {
    const res = await this.pool.query(
      "SELECT * FROM institutions WHERE id = $1 OR aicte_permanent_id = $1",
      [id]
    );
    return res.rows[0] ? this.mapInstitution(res.rows[0]) : undefined;
  }

  public async createInstitution(data: any): Promise<Institution> {
    const id = uuidv4();
    const query = `
      INSERT INTO institutions (
        id, aicte_permanent_id, name, institution_type, address, city, state, region,
        pincode, contact_email, contact_phone, accreditation_status, year_established
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const values = [
      id,
      data.aictePermanentId,
      data.name,
      data.institutionType,
      data.address,
      data.city,
      data.state,
      data.region,
      data.pincode,
      data.contactEmail,
      data.contactPhone,
      data.accreditationStatus || "Approved",
      data.yearEstablished || new Date().getFullYear()
    ];
    const res = await this.pool.query(query, values);
    return this.mapInstitution(res.rows[0]);
  }

  // COMPLAINTS
  public async getComplaints(params: any) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 25;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.institutionId) {
      conditions.push(`institution_id = $${idx}`);
      values.push(params.institutionId);
      idx++;
    }

    if (params.search) {
      conditions.push(`(complaint_id ILIKE $${idx} OR title ILIKE $${idx} OR description ILIKE $${idx} OR institution_name ILIKE $${idx} OR aicte_permanent_id ILIKE $${idx} OR category ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.bureau) {
      conditions.push(`(current_bureau_id = $${idx} OR receiving_bureau_id = $${idx})`);
      values.push(params.bureau);
      idx++;
    }

    if (params.status) {
      conditions.push(`status = $${idx}`);
      values.push(params.status);
      idx++;
    }

    if (params.priority) {
      conditions.push(`priority = $${idx}`);
      values.push(params.priority);
      idx++;
    }

    if (params.hasOverlap !== undefined) {
      conditions.push(`has_overlap_alert = $${idx}`);
      values.push(params.hasOverlap);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await this.pool.query(`SELECT COUNT(*) FROM complaints ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT * FROM complaints
      ${whereClause}
      ORDER BY received_date DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const res = await this.pool.query(query, values);
    return {
      data: res.rows.map(this.mapComplaint),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  public async getComplaintById(id: string): Promise<Complaint | undefined> {
    const res = await this.pool.query(
      "SELECT * FROM complaints WHERE id = $1 OR complaint_id = $1",
      [id]
    );
    return res.rows[0] ? this.mapComplaint(res.rows[0]) : undefined;
  }

  public async createComplaint(complaintData: any, creator: Profile) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const id = uuidv4();
      const countRes = await client.query("SELECT COUNT(*) FROM complaints");
      const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
      const complaintId = `AICTE/${complaintData.receivingBureauId}/2026/${String(nextNum).padStart(5, "0")}`;

      const instRes = await client.query("SELECT * FROM institutions WHERE id = $1", [complaintData.institutionId]);
      const inst = instRes.rows[0];

      const query = `
        INSERT INTO complaints (
          id, complaint_id, institution_id, aicte_permanent_id, institution_name,
          category, title, description, received_date, expected_disposal_date,
          receiving_bureau_id, current_bureau_id, assigned_officer_id, assigned_officer_name,
          status, priority, has_overlap_alert, created_by, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `;
      const values = [
        id,
        complaintId,
        complaintData.institutionId,
        inst?.aicte_permanent_id || "PENDING",
        inst?.name || "Institution",
        complaintData.category,
        complaintData.title,
        complaintData.description,
        new Date().toISOString().split("T")[0],
        complaintData.expectedDisposalDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        complaintData.receivingBureauId,
        complaintData.receivingBureauId,
        complaintData.assignedOfficerId || null,
        null,
        "Pending",
        complaintData.priority,
        false,
        creator.id,
        creator.fullName
      ];

      const res = await client.query(query, values);
      const newComp = this.mapComplaint(res.rows[0]);

      // Add Initial Case History entry
      await client.query(`
        INSERT INTO case_history (
          id, complaint_id, action_type, to_status, remarks, performed_by, performed_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        uuidv4(),
        id,
        "Grievance Lodged",
        "Pending",
        `Grievance officially registered into AICTE portal by ${creator.fullName}.`,
        creator.id,
        creator.fullName
      ]);

      await client.query("COMMIT");
      return { complaint: newComp, detectedOverlaps: [] };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  public async updateComplaintStatus(complaintId: string, updates: any, user: Profile): Promise<Complaint> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT * FROM complaints WHERE id = $1", [complaintId]);
      if (current.rows.length === 0) throw new Error("Complaint not found.");

      const oldStatus = current.rows[0].status;
      const disposalDate = updates.status === "Disposed" ? new Date().toISOString().split("T")[0] : null;

      const updateRes = await client.query(`
        UPDATE complaints
        SET status = $1, disposal_date = $2, disposal_remarks = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [updates.status, disposalDate, updates.disposalRemarks || null, complaintId]);

      // Append immutable case history
      await client.query(`
        INSERT INTO case_history (
          id, complaint_id, action_type, from_status, to_status, remarks, performed_by, performed_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        uuidv4(),
        complaintId,
        "Status Update",
        oldStatus,
        updates.status,
        updates.remarks,
        user.id,
        user.fullName
      ]);

      await client.query("COMMIT");
      return this.mapComplaint(updateRes.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  public async overrideSlaDeadline(complaintId: string, newDeadline: string, overrideReason: string, user: Profile): Promise<Complaint> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT * FROM complaints WHERE id = $1", [complaintId]);
      if (current.rows.length === 0) throw new Error("Complaint not found.");

      const comp = current.rows[0];
      const oldDeadline = comp.expected_disposal_date;

      const updateRes = await client.query(`
        UPDATE complaints
        SET expected_disposal_date = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [newDeadline, complaintId]);

      await client.query(`
        INSERT INTO case_history (
          id, complaint_id, action_type, from_status, to_status, remarks, performed_by, performed_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        uuidv4(),
        complaintId,
        "SLA Deadline Overridden",
        comp.status,
        comp.status,
        `Statutory deadline adjusted from ${oldDeadline} to ${newDeadline}. Official Justification: ${overrideReason}`,
        user.id,
        user.fullName
      ]);

      await client.query("COMMIT");
      return this.mapComplaint(updateRes.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // CASE HISTORY
  public async getCaseHistory(complaintId: string): Promise<CaseHistory[]> {
    const res = await this.pool.query(
      "SELECT * FROM case_history WHERE complaint_id = $1 ORDER BY created_at DESC",
      [complaintId]
    );
    return res.rows.map(this.mapCaseHistory);
  }

  public async addCaseHistory(history: CaseHistory): Promise<CaseHistory> {
    const query = `
      INSERT INTO case_history (
        id, complaint_id, action_type, from_status, to_status, remarks, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      history.id || uuidv4(),
      history.complaintId,
      history.actionType,
      history.fromStatus || null,
      history.toStatus || null,
      history.remarks,
      history.performedBy,
      history.performedByName
    ];
    const res = await this.pool.query(query, values);
    return this.mapCaseHistory(res.rows[0]);
  }

  // TRANSFERS
  public async getTransfers(): Promise<CaseTransfer[]> {
    const res = await this.pool.query("SELECT * FROM case_transfers ORDER BY transferred_at DESC");
    return res.rows.map(this.mapTransfer);
  }

  public async transferCase(complaintId: string, transferData: any, user: Profile): Promise<CaseTransfer> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const compRes = await client.query("SELECT * FROM complaints WHERE id = $1", [complaintId]);
      if (compRes.rows.length === 0) throw new Error("Complaint not found.");
      const comp = compRes.rows[0];

      const transferId = uuidv4();
      const insertTransfer = `
        INSERT INTO case_transfers (
          id, complaint_id, complaint_ref_id, institution_name, from_bureau_id, to_bureau_id,
          from_officer_id, from_officer_name, to_officer_id, to_officer_name, transfer_reason,
          transferred_by, transferred_by_name, acceptance_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Accepted')
        RETURNING *
      `;
      const transferRes = await client.query(insertTransfer, [
        transferId,
        comp.id,
        comp.complaint_id,
        comp.institution_name,
        comp.current_bureau_id,
        transferData.toBureauId,
        comp.assigned_officer_id,
        comp.assigned_officer_name,
        transferData.toOfficerId || null,
        null,
        transferData.transferReason,
        user.id,
        user.fullName
      ]);

      // Update complaint current bureau
      await client.query(`
        UPDATE complaints
        SET current_bureau_id = $1, assigned_officer_id = $2, status = 'Transferred', updated_at = NOW()
        WHERE id = $3
      `, [transferData.toBureauId, transferData.toOfficerId || null, complaintId]);

      // Append case history
      await client.query(`
        INSERT INTO case_history (
          id, complaint_id, action_type, from_status, to_status, remarks, performed_by, performed_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        uuidv4(),
        complaintId,
        "Bureau Transfer",
        comp.status,
        "Transferred",
        `Case transferred from ${comp.current_bureau_id} to ${transferData.toBureauId}. Reason: ${transferData.transferReason}`,
        user.id,
        user.fullName
      ]);

      await client.query("COMMIT");
      return this.mapTransfer(transferRes.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // RELATED CASES
  public async getRelatedCases(complaintId: string): Promise<RelatedCase[]> {
    const res = await this.pool.query(`
      SELECT * FROM related_cases
      WHERE complaint_id_a = $1 OR complaint_id_b = $1
      ORDER BY created_at DESC
    `, [complaintId]);
    return res.rows.map(this.mapRelatedCase);
  }

  public async linkCases(caseAId: string, caseBId: string, type: any, user: Profile, notes?: string): Promise<RelatedCase> {
    const compA = (await this.pool.query("SELECT * FROM complaints WHERE id = $1", [caseAId])).rows[0];
    const compB = (await this.pool.query("SELECT * FROM complaints WHERE id = $1", [caseBId])).rows[0];
    if (!compA || !compB) throw new Error("Both complaints must exist.");

    const id = uuidv4();
    const query = `
      INSERT INTO related_cases (
        id, complaint_id_a, complaint_id_b, complaint_ref_a, complaint_ref_b,
        relationship_type, linked_by, linked_by_name, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      id, caseAId, caseBId, compA.complaint_id, compB.complaint_id, type, user.id, user.fullName, notes || null
    ]);
    return this.mapRelatedCase(res.rows[0]);
  }

  // OVERLAP ALERTS
  public async getOverlapAlerts(params: any) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.bureau) {
      conditions.push(`(bureau_a = $${idx} OR bureau_b = $${idx})`);
      values.push(params.bureau);
      idx++;
    }

    if (params.alertStatus) {
      conditions.push(`alert_status = $${idx}`);
      values.push(params.alertStatus);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await this.pool.query(`SELECT COUNT(*) FROM overlap_alerts ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT * FROM overlap_alerts
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const res = await this.pool.query(query, values);
    return {
      data: res.rows.map(this.mapOverlapAlert),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  public async getOverlapAlertById(id: string): Promise<OverlapAlert | undefined> {
    const res = await this.pool.query("SELECT * FROM overlap_alerts WHERE id = $1 OR alert_id = $1", [id]);
    return res.rows[0] ? this.mapOverlapAlert(res.rows[0]) : undefined;
  }

  public async reviewOverlapAlert(
    alertId: string,
    reviewData: { decision: OverlapAlert["alertStatus"]; remarks: string; linkAsRelated?: boolean },
    reviewer: Profile
  ): Promise<OverlapAlert> {
    const query = `
      UPDATE overlap_alerts
      SET alert_status = $1, review_remarks = $2, reviewed_by = $3, reviewed_by_name = $4, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $5 OR alert_id = $5
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      reviewData.decision, reviewData.remarks, reviewer.id, reviewer.fullName, alertId
    ]);
    if (res.rows.length === 0) throw new Error("Overlap alert not found.");
    return this.mapOverlapAlert(res.rows[0]);
  }

  // NOTIFICATIONS
  public async getNotifications(role?: string): Promise<Notification[]> {
    let query = "SELECT * FROM notifications";
    const values: any[] = [];
    if (role) {
      query += " WHERE recipient_role IS NULL OR recipient_role = $1";
      values.push(role);
    }
    query += " ORDER BY created_at DESC LIMIT 50";
    const res = await this.pool.query(query, values);
    return res.rows.map(this.mapNotification);
  }

  public async addNotification(notif: Notification): Promise<Notification> {
    const query = `
      INSERT INTO notifications (
        id, recipient_id, recipient_role, title, message, notification_type, reference_id, reference_type, is_read
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      notif.id || uuidv4(),
      notif.recipientId || null,
      notif.recipientRole || null,
      notif.title,
      notif.message,
      notif.notificationType,
      notif.referenceId || null,
      notif.referenceType || null,
      notif.isRead || false
    ]);
    return this.mapNotification(res.rows[0]);
  }

  public async markNotificationRead(id: string): Promise<boolean> {
    const res = await this.pool.query("UPDATE notifications SET is_read = TRUE WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  public async markAllNotificationsRead(role?: string): Promise<number> {
    let query = "UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE";
    const values: any[] = [];
    if (role) {
      query += " AND (recipient_role IS NULL OR recipient_role = $1)";
      values.push(role);
    }
    const res = await this.pool.query(query, values);
    return res.rowCount ?? 0;
  }

  // DOCUMENTS
  public async getDocuments(params: { complaintId?: string; institutionId?: string }): Promise<ComplaintDocument[]> {
    let query = "SELECT * FROM documents WHERE 1=1";
    const values: any[] = [];
    let idx = 1;

    if (params.complaintId) {
      query += ` AND complaint_id = $${idx}`;
      values.push(params.complaintId);
      idx++;
    }

    if (params.institutionId) {
      query += ` AND institution_id = $${idx}`;
      values.push(params.institutionId);
      idx++;
    }

    query += " ORDER BY uploaded_at DESC";
    const res = await this.pool.query(query, values);
    return res.rows.map(this.mapDocument);
  }

  public async getDocumentById(id: string): Promise<ComplaintDocument | undefined> {
    const res = await this.pool.query("SELECT * FROM documents WHERE id = $1", [id]);
    return res.rows[0] ? this.mapDocument(res.rows[0]) : undefined;
  }

  public async addDocument(doc: ComplaintDocument): Promise<ComplaintDocument> {
    const query = `
      INSERT INTO documents (
        id, complaint_id, institution_id, file_name, original_name, file_size,
        mime_type, file_url, document_type, uploaded_by, uploaded_by_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      doc.id || uuidv4(),
      doc.complaintId,
      doc.institutionId || null,
      doc.fileName,
      doc.originalName,
      doc.fileSize,
      doc.mimeType,
      doc.fileUrl,
      doc.documentType,
      doc.uploadedBy,
      doc.uploadedByName
    ]);
    return this.mapDocument(res.rows[0]);
  }

  public async deleteDocument(id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM documents WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // AUDIT LOGS
  public async getAuditLogs(): Promise<AuditLog[]> {
    const res = await this.pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100");
    return res.rows.map(this.mapAuditLog);
  }

  public async addAuditLog(log: any): Promise<AuditLog> {
    const query = `
      INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      uuidv4(),
      log.userId || null,
      log.userName || null,
      log.action,
      log.entityType,
      log.entityId,
      log.details ? JSON.stringify(log.details) : null,
      log.ipAddress || null
    ]);
    return this.mapAuditLog(res.rows[0]);
  }

  // ANALYTICS
  public async getDashboardAnalytics(): Promise<any> {
    const compTotal = await this.pool.query("SELECT COUNT(*) FROM complaints");
    const compOverdue = await this.pool.query("SELECT COUNT(*) FROM complaints WHERE expected_disposal_date < CURRENT_DATE AND status NOT IN ('Disposed')");
    const compPending = await this.pool.query("SELECT COUNT(*) FROM complaints WHERE status = 'Pending'");
    const compDisposed = await this.pool.query("SELECT COUNT(*) FROM complaints WHERE status = 'Disposed'");
    const overlapAlerts = await this.pool.query("SELECT COUNT(*) FROM overlap_alerts WHERE alert_status = 'Pending Review'");

    return {
      kpis: {
        totalComplaints: parseInt(compTotal.rows[0].count, 10),
        activeComplaints: parseInt(compPending.rows[0].count, 10),
        disposedComplaints: parseInt(compDisposed.rows[0].count, 10),
        overdueComplaints: parseInt(compOverdue.rows[0].count, 10),
        pendingOverlapAlerts: parseInt(overlapAlerts.rows[0].count, 10)
      }
    };
  }

  public async getPerformanceReport(params: { period?: string; bureau?: string }): Promise<any> {
    return {
      generatedAt: new Date().toISOString(),
      period: params.period || "all",
      bureau: params.bureau || "ALL"
    };
  }

  public async resetDemoData(): Promise<any> {
    throw new Error("resetDemoData() is only supported in local JSON development mode.");
  }

  // Mappers
  private mapProfile(r: any): Profile {
    return {
      id: r.id,
      email: r.email,
      passwordHash: r.password_hash,
      fullName: r.full_name,
      role: r.role,
      bureauId: r.bureau_id,
      region: r.region,
      designation: r.designation,
      isActive: r.is_active,
      createdAt: r.created_at?.toISOString?.() || r.created_at,
      updatedAt: r.updated_at?.toISOString?.() || r.updated_at
    };
  }

  private mapInstitution(r: any): Institution {
    return {
      id: r.id,
      aictePermanentId: r.aicte_permanent_id,
      name: r.name,
      institutionType: r.institution_type,
      address: r.address,
      city: r.city,
      state: r.state,
      region: r.region,
      pincode: r.pincode,
      contactEmail: r.contact_email,
      contactPhone: r.contact_phone,
      accreditationStatus: r.accreditation_status,
      yearEstablished: r.year_established,
      totalComplaintsCount: r.total_complaints_count || 0,
      activeComplaintsCount: r.active_complaints_count || 0,
      overlapCount: 0,
      createdAt: r.created_at?.toISOString?.() || r.created_at,
      updatedAt: r.updated_at?.toISOString?.() || r.updated_at
    };
  }

  private mapComplaint(r: any): Complaint {
    return {
      id: r.id,
      complaintId: r.complaint_id,
      institutionId: r.institution_id,
      aictePermanentId: r.aicte_permanent_id,
      institutionName: r.institution_name,
      category: r.category,
      title: r.title,
      description: r.description,
      receivedDate: r.received_date?.toISOString?.()?.split("T")[0] || r.received_date,
      expectedDisposalDate: r.expected_disposal_date?.toISOString?.()?.split("T")[0] || r.expected_disposal_date,
      receivingBureauId: r.receiving_bureau_id,
      currentBureauId: r.current_bureau_id,
      assignedOfficerId: r.assigned_officer_id,
      assignedOfficerName: r.assigned_officer_name,
      status: r.status,
      priority: r.priority,
      hasOverlapAlert: r.has_overlap_alert,
      disposalDate: r.disposal_date?.toISOString?.()?.split("T")[0] || r.disposal_date,
      disposalRemarks: r.disposal_remarks,
      createdBy: r.created_by,
      createdByName: r.created_by_name,
      createdAt: r.created_at?.toISOString?.() || r.created_at,
      updatedAt: r.updated_at?.toISOString?.() || r.updated_at
    };
  }

  private mapCaseHistory(r: any): CaseHistory {
    return {
      id: r.id,
      complaintId: r.complaint_id,
      actionType: r.action_type,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      remarks: r.remarks,
      performedBy: r.performed_by,
      performedByName: r.performed_by_name,
      createdAt: r.created_at?.toISOString?.() || r.created_at
    };
  }

  private mapTransfer(r: any): CaseTransfer {
    return {
      id: r.id,
      complaintId: r.complaint_id,
      complaintRefId: r.complaint_ref_id,
      institutionName: r.institution_name,
      fromBureauId: r.from_bureau_id,
      toBureauId: r.to_bureau_id,
      fromOfficerId: r.from_officer_id,
      fromOfficerName: r.from_officer_name,
      toOfficerId: r.to_officer_id,
      toOfficerName: r.to_officer_name,
      transferReason: r.transfer_reason,
      transferredBy: r.transferred_by,
      transferredByName: r.transferred_by_name,
      transferredAt: r.transferred_at?.toISOString?.() || r.transferred_at,
      acceptanceStatus: r.acceptance_status
    };
  }

  private mapRelatedCase(r: any): RelatedCase {
    return {
      id: r.id,
      complaintIdA: r.complaint_id_a,
      complaintIdB: r.complaint_id_b,
      complaintRefA: r.complaint_ref_a,
      complaintRefB: r.complaint_ref_b,
      relationshipType: r.relationship_type,
      linkedBy: r.linked_by,
      linkedByName: r.linked_by_name,
      notes: r.notes,
      createdAt: r.created_at?.toISOString?.() || r.created_at
    };
  }

  private mapOverlapAlert(r: any): OverlapAlert {
    return {
      id: r.id,
      alertId: r.alert_id,
      institutionId: r.institution_id,
      aictePermanentId: r.aicte_permanent_id,
      institutionName: r.institution_name,
      complaintIdA: r.complaint_id_a,
      complaintRefA: r.complaint_ref_a,
      complaintTitleA: r.complaint_title_a,
      complaintDescA: r.complaint_desc_a,
      complaintIdB: r.complaint_id_b,
      complaintRefB: r.complaint_ref_b,
      complaintTitleB: r.complaint_title_b,
      complaintDescB: r.complaint_desc_b,
      bureauA: r.bureau_a,
      bureauB: r.bureau_b,
      categoryA: r.category_a,
      categoryB: r.category_b,
      statusA: r.status_a,
      statusB: r.status_b,
      ruleMatchScore: Number(r.rule_match_score),
      semanticSimilarityScore: r.semantic_similarity_score ? Number(r.semantic_similarity_score) : undefined,
      matchReasons: typeof r.match_reasons === "string" ? JSON.parse(r.match_reasons) : r.match_reasons || [],
      explanation: typeof r.explanation === "string" ? JSON.parse(r.explanation) : r.explanation,
      alertStatus: r.alert_status,
      recommendedAction: r.recommended_action,
      reviewedBy: r.reviewed_by,
      reviewedByName: r.reviewed_by_name,
      reviewedAt: r.reviewed_at?.toISOString?.() || r.reviewed_at,
      reviewRemarks: r.review_remarks,
      createdAt: r.created_at?.toISOString?.() || r.created_at,
      updatedAt: r.updated_at?.toISOString?.() || r.updated_at
    };
  }

  private mapNotification(r: any): Notification {
    return {
      id: r.id,
      recipientId: r.recipient_id,
      recipientRole: r.recipient_role,
      title: r.title,
      message: r.message,
      notificationType: r.notification_type,
      referenceId: r.reference_id,
      referenceType: r.reference_type,
      isRead: r.is_read,
      createdAt: r.created_at?.toISOString?.() || r.created_at
    };
  }

  private mapDocument(r: any): ComplaintDocument {
    return {
      id: r.id,
      complaintId: r.complaint_id,
      institutionId: r.institution_id,
      fileName: r.file_name,
      originalName: r.original_name,
      fileSize: Number(r.file_size),
      mimeType: r.mime_type,
      fileUrl: r.file_url,
      documentType: r.document_type,
      uploadedBy: r.uploaded_by,
      uploadedByName: r.uploaded_by_name,
      uploadedAt: r.uploaded_at?.toISOString?.() || r.uploaded_at
    };
  }

  private mapAuditLog(r: any): AuditLog {
    return {
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: typeof r.details === "string" ? JSON.parse(r.details) : r.details,
      ipAddress: r.ip_address,
      createdAt: r.created_at?.toISOString?.() || r.created_at
    };
  }
}

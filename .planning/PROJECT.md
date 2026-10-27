# ComplaintTracker (AICTE Integrated Institution Complaint Monitoring System)

## What This Is
An institutional-grade complaint monitoring and status tracking platform designed for AICTE and regulatory bodies. It handles multi-bureau grievance workflows, cross-bureau duplicate and related case detection, statutory SLA tracking with auto-escalation, case transfer handoffs, document attachment management, and role-based administrative oversight.

## Core Value
Ensure rigorous regulatory accountability by preventing overlapping or duplicate proceedings across bureaus, enforcing statutory SLA deadlines, maintaining immutable audit trails for every case action, and securing sensitive institutional data with robust role-based access control and persistent storage.

## Stack & Architecture
- **Frontend**: React 18, TypeScript, Vite, React Router 6, Lucide icons, Vanilla CSS design system.
- **Backend**: Node.js, Express, TypeScript, JWT auth, bcryptjs, Multer for evidence storage.
- **Persistence Target**: PostgreSQL / Supabase with clean migration management, connection pooling, transactional integrity, and explicit local/test fallback adapter.
- **AI/ML Layer**: Semantic text similarity via SentenceTransformers service with an in-process lexical/TF-IDF cosine fallback.

## Current Milestone Goals (Milestone 1.0 - Full Repair & Hardening)
1. Phase 1: Baseline Establishment & Comprehensive System Audit.
2. Phase 2: Build & Development Environment Repair.
3. Phase 3: Authentication Hardening & Role-Based Authorization Enforcement.
4. Phase 4: Production PostgreSQL / Supabase Database Architecture & Migrations.
5. Phase 5: Complaint Lifecycle, Transfer Workflows & Overlap Engine Integrity.
6. Phase 6: SLA Boundary Calculation, Pagination & Idempotent Escalation.
7. Phase 7: Frontend Authentication Guards & UX Hardening.
8. Phase 8: Analytics Security, CSV Sanitization & Evidence Protection.
9. Phase 9: Automated Test Suite Expansion (Security, Workflow, Isolation).
10. Phase 10: Production Readiness, Documentation & Verification.

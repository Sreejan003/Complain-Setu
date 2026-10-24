# AICTE Integrated Institution Complaint Monitoring & Overlap Dashboard

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-brightgreen)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-19.x-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/Build-Passing-brightgreen)]()
[![SIH 2026](https://img.shields.io/badge/Smart%20India%20Hackathon-2026-orange)]()

An enterprise, government-grade centralized complaint-monitoring and multi-Bureau coordination platform designed for the **All India Council for Technical Education (AICTE)**.

AICTE receives thousands of grievances related to approved technical education institutions through distinct Bureaus and Cells:
* **Regulation Bureau (RB)**
* **Public Grievance Redressal Cell (PGRC)**
* **Regional Offices (RO)** (8 Regional Jurisdictions across India)
* **Approval Bureau (AB)**
* **Policy and Academic Planning Bureau (PB)**

Often, the same institution has related or duplicate complaints processed simultaneously across multiple departments without mutual visibility. This platform solves that critical problem with **Intelligent Cross-Bureau Overlap Detection**, consolidated institution profiles, statutory SLA lifecycle tracking, and workflow transfer governance.

---

## 🏆 Open-Source Repositories Evaluated & Reused

In accordance with project requirements, three candidate open-source repositories were analyzed:

| Repository | Tech Stack | License | Evaluation & Fit |
|---|---|---|---|
| **1. [Aberami7/-Smart-Grievance-and-Feedback-Management-System](https://github.com/Aberami7/-Smart-Grievance-and-Feedback-Management-System)** | React, Node.js, Express, MySQL | Unspecified | Useful 3-tier architecture, but lacked institution registry and AI overlap intelligence. |
| **2. [abdul-kheeyan/Grievance-Management-System (Nagrik Setu)](https://github.com/abdul-kheeyan/Grievance-Management-System)** | React 18, Vite, Express REST API, LowDB / Dual DB | MIT License | **Selected as Primary Base Architectural Reference**. Clean Express route structure, SLA tracking, and complaint lifecycle state machines. |
| **3. [TjWhiteboy/ResolveIT](https://github.com/TjWhiteboy/ResolveIT-Smart-Grievance-and-Feedback-Management-System)** | Java 21, Spring Boot, MySQL | MIT License | Incompatible backend language (Java Spring Boot), but provided architectural inspiration for immutable audit history logs. |

### Components Reused vs. Newly Implemented
* **Reused Architectural Patterns**:
  * Express REST API routing and JWT authentication guards (adapted from *Nagrik Setu*).
  * Automated SLA deadline computation and state transitions (`Pending` &rarr; `Under Process` &rarr; `Disposed` / `Transferred` / `Escalated`).
  * Dual-layer database strategy (PostgreSQL / Supabase with offline ACID JSON persistence).
* **Newly Engineered Innovations**:
  1. **AICTE Institution Directory & Verified Permanent IDs**: Strict duplicate protection and 30-institution pre-seeded dataset.
  2. **3-Stage Hybrid Overlap Detection Engine**:
     * *Stage A: Exact Institution Matching* (AICTE Permanent ID resolution).
     * *Stage B: Rule-Based Heuristic Matching* (cross-bureau detection, category weighting, status recency, and keyword concordance).
     * *Stage C: Semantic Similarity Matching* (Sentence-Transformers `all-MiniLM-L6-v2` + built-in TF-IDF cosine similarity fallback).
  3. **Live Pre-Submission Overlap Warning**: Real-time interceptor warning officers before filing companion complaints.
  4. **Overlap Detection Center (Page 7)**: Side-by-side Case A vs. Case B visual comparator with common keyword highlight and administrative review actions.
  5. **Consolidated Institution Profiles (Page 3)**: 5-tab interface (All Complaints, Related Cases, Action History, Documents, and Analytics).
  6. **Inter-Bureau Transfer Workflow (Page 8)**: Complete transfer justification trail and jurisdiction routing.
  7. **Executive Government UI**: AICTE deep navy theme, collapsible sidebar, in-app notifications, and instant demo role switcher.

---

## 🔐 Demo Accounts (One-Click Role Switcher)

The application includes an instant **Role Switcher** in the top navbar. You can also sign in manually with any of these pre-seeded demo accounts:

| Role | Email | Password | Designation / Department |
|---|---|---|---|
| **Administrator** | `admin@aicte.gov.in` | `Aicte@2026` | Chief Administrative Officer & System Architect |
| **Regulation Bureau Officer** | `rb.officer@aicte.gov.in` | `Aicte@2026` | Senior Director (Regulation & Norms) |
| **PGRC Officer** | `pgrc.officer@aicte.gov.in` | `Aicte@2026` | Joint Secretary (Public Grievance Redressal) |
| **Regional Officer** | `ro.officer@aicte.gov.in` | `Aicte@2026` | Regional Officer (Southern Region - Chennai) |
| **Senior Management** | `senior.mgmt@aicte.gov.in` | `Aicte@2026` | Member Secretary (AICTE HQ) |

---

## ⚡ Quick Start & Local Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **Python**: (Optional, only needed if running external Sentence Transformers AI microservice)

### 1. Installation
Clone the repository and install dependencies for both backend and frontend:

```bash
# Clone the repository
git clone https://github.com/your-username/ComplaintTracker.git
cd ComplaintTracker

# Install dependencies
npm --prefix backend install
npm --prefix frontend install
```

### 2. Run Automated Verification Tests
Verify all 10 core business logic criteria before starting:

```bash
npm test
# or
npm --prefix backend test
```

### 3. Launch Development Servers
Run both backend and frontend concurrently:

```bash
# In Terminal 1: Start Backend API (Port 5000)
npm run dev:backend

# In Terminal 2: Start Frontend Web Application (Port 3000)
npm run dev:frontend
```

Open your browser at:
```
http://localhost:3000
```

---

## 🧠 Core Innovation: 3-Stage Overlap Detection Engine

The engine scrutinizes new complaints against the existing database using three distinct stages:

```
NEW COMPLAINT SUBMITTED
           │
           ▼
[ STAGE A: Exact Institution Resolution ]
  • Match by internal Institution ID or AICTE Permanent ID (e.g., 1-4458921102)
  • Exclude non-matching institutions
           │
           ▼
[ STAGE B: Explainable Rule-Based Heuristics ]
  • Cross-Bureau Check: Different Bureaus handling active cases (RB vs. PGRC) (+10 pts)
  • Category Correlation: Identical violation (+25 pts) or Related scope (+18 pts)
  • Active Status: Target case currently Pending or Under Process (+10 pts)
  • Lexical Concordance: Overlapping domain keywords (faculty, salary, fee, etc.) (+20 pts)
           │
           ▼
[ STAGE C: Semantic Similarity Matching ]
  • Sentence Transformers (all-MiniLM-L6-v2) cosine similarity embedding
  • Built-in TF-IDF / Token Cosine fallback if AI service is offline
           │
           ▼
[ COMBINED SCORE CALCULATION ]
  Combined Score = (0.6 × Rule Score) + (0.4 × Semantic Score)
           │
           ▼
[ DECISION ACTION ]
  • Score ≥ 50% & Cross-Bureau ➔ Flag "Potential Overlap Alert"
  • Score ≥ 80% ➔ High-Confidence Duplicate Warning
  • Reviewer Confirms ➔ Link Cases & Notify Respective Bureau Officers
```

---

## 🗄️ Database Architecture & Supabase Compatibility

The project includes production-ready PostgreSQL schemas and Row Level Security (RLS) policies:

* `database/01_schema.sql`: 11 normalized tables (`institutions`, `complaints`, `overlap_alerts`, `case_history`, `case_transfers`, `related_cases`, `notifications`, `audit_logs`, etc.) with foreign keys, checks, and performance indexes.
* `database/02_rls_policies.sql`: Granular Row Level Security policies enforcing data isolation by bureau and role.

### Local Zero-Friction Development
When external Supabase credentials are not provided, the application automatically operates using an ACID in-process JSON persistent store (`backend/src/data/db.json`). This ensures that:
* The application runs out of the box with zero external dependencies.
* Realistic synthetic data is preserved across server restarts.
* The Administrator can reset to baseline seed data anytime via the Administration panel.

---

## 📋 Comprehensive Automated Tests (10/10 Passing)

Run `npm test` to execute the verification suite in `backend/src/tests/run_tests.ts`:

1. ✅ **Test 1**: Two active complaints for the same institution and similar issues in different Bureaus produce an overlap alert.
2. ✅ **Test 2**: Two unrelated complaints from the same institution are not automatically declared duplicates.
3. ✅ **Test 3**: Similar descriptions from different institutions are not treated as the same institution's case.
4. ✅ **Test 4**: A transferred complaint retains its complete assignment and history.
5. ✅ **Test 5**: A status update creates an immutable case-history entry.
6. ✅ **Test 6**: An unauthorized user cannot modify a restricted complaint (RBAC verification).
7. ✅ **Test 7**: A rejected overlap remains recorded with the review reason.
8. ✅ **Test 8**: Duplicate relationship records are prevented.
9. ✅ **Test 9**: Upcoming deadlines and overdue cases generate appropriate notifications.
10. ✅ **Test 10**: The system continues rule-based matching if the external AI service is unavailable.

---

## 📄 Application Pages Breakdown

1. **Overview Dashboard (`/`)**: 8 clickable KPI cards, Bureau Workload chart, Status Distribution donut, 6-Month Influx vs Disposal trend, Ageing chart, and Critical Alerts panel.
2. **Institution Directory (`/institutions`)**: Searchable table of 30 institutions with permanent IDs, regional filters, and institution registration modal.
3. **Institution Profile (`/institutions/:id`)**: 5 tabs: All Complaints, Related Overlaps, Audit History, Documents & Approvals, and Analytics.
4. **Complaint Register (`/complaints/register`)**: Intake form with real-time pre-submission overlap detection warning modal.
5. **Complaint Register / All Cases (`/cases`)**: Multi-filter searchable database with sorting, pagination, and overdue/overlap indicators.
6. **Complaint Details (`/cases/:id`)**: Comprehensive case dossier, chronological action timeline, status updater, and case transfer tool.
7. **Overlap Detection Center (`/overlaps`)**: Side-by-side comparison modal (Case A vs. Case B), similarity scores, and review decision commit.
8. **Workflow & Transfers (`/transfers`)**: Inter-bureau jurisdiction re-allocation and transfer ledger.
9. **Notification Center (`/notifications`)**: Real-time alerts for overlaps, SLA breaches, and case transfers.
10. **Reports & Analytics (`/analytics`)**: Formal performance tables, metric definitions, and one-click CSV export.
11. **Administration (`/admin`)**: Official directory, RBAC matrix, SLA rules table, audit records, and demo data reset.

---

## ⚖️ License & Attribution

This project is licensed under the [MIT License](./LICENSE).
* Portions Copyright (c) 2024 **abdul-kheeyan** (*Nagrik Setu* - MIT License)
* Portions Copyright (c) 2026 **Thikash J** (*ResolveIT* - MIT License)
* AICTE Multi-Bureau Overlap Engine & SIH 2026 Implementation by AICTE Hackathon Contributors.

-- ====================================================================
-- AICTE INTEGRATED INSTITUTION COMPLAINT MONITORING DATABASE SCHEMA
-- Target Database: PostgreSQL 14+ / Supabase PostgreSQL
-- ====================================================================

-- 1. Profiles / User Directory Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'Administrator',
        'Regulation Bureau Officer',
        'PGRC Officer',
        'Bureau Officer',
        'Regional Officer',
        'Senior Management',
        'Competent Authority',
        'Institutional User'
    )),
    bureau_id VARCHAR(50),
    region VARCHAR(100),
    designation VARCHAR(150),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bureaus / Cells Table
CREATE TABLE IF NOT EXISTS bureaus (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    head_officer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Institutions Directory Table
CREATE TABLE IF NOT EXISTS institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aicte_permanent_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    institution_type VARCHAR(100) NOT NULL, -- Engineering, Management, Pharmacy, Polytechnic
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL, -- Northern, Southern, Western, Eastern, etc.
    pincode VARCHAR(20),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    accreditation_status VARCHAR(100) DEFAULT 'Approved',
    year_established INT,
    total_complaints_count INT DEFAULT 0,
    active_complaints_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Complaints Master Table
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id VARCHAR(50) UNIQUE NOT NULL, -- e.g. AICTE/RB/2026/00142
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    aicte_permanent_id VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT NOT NULL,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_disposal_date DATE NOT NULL,
    receiving_bureau_id VARCHAR(50) NOT NULL REFERENCES bureaus(id),
    current_bureau_id VARCHAR(50) NOT NULL REFERENCES bureaus(id),
    assigned_officer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN (
        'Pending',
        'Under Process',
        'Disposed',
        'Transferred',
        'Escalated'
    )),
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    has_overlap_alert BOOLEAN DEFAULT FALSE,
    disposal_date DATE,
    disposal_remarks TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Case Assignments Table
CREATE TABLE IF NOT EXISTS case_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    bureau_id VARCHAR(50) NOT NULL REFERENCES bureaus(id),
    officer_id UUID NOT NULL REFERENCES profiles(id),
    assigned_by UUID REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT
);

-- 6. Case History / Timeline Table (Audit log for lifecycle)
CREATE TABLE IF NOT EXISTS case_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL, -- 'Status Update', 'Officer Assignment', 'Transfer', 'Remark Added', 'Escalation', 'Overlap Detected'
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    remarks TEXT NOT NULL,
    performed_by UUID NOT NULL REFERENCES profiles(id),
    performed_by_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Case Transfers Table
CREATE TABLE IF NOT EXISTS case_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    from_bureau_id VARCHAR(50) NOT NULL REFERENCES bureaus(id),
    to_bureau_id VARCHAR(50) NOT NULL REFERENCES bureaus(id),
    from_officer_id UUID REFERENCES profiles(id),
    to_officer_id UUID REFERENCES profiles(id),
    transfer_reason TEXT NOT NULL,
    transferred_by UUID NOT NULL REFERENCES profiles(id),
    transferred_at TIMESTAMPTZ DEFAULT NOW(),
    acceptance_status VARCHAR(50) DEFAULT 'Accepted' CHECK (acceptance_status IN ('Pending', 'Accepted', 'Rejected'))
);

-- 8. Related Cases Links Table
CREATE TABLE IF NOT EXISTS related_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id_a UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    complaint_id_b UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN ('Duplicate', 'Related', 'Coordinated')),
    linked_by UUID NOT NULL REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT no_self_link CHECK (complaint_id_a != complaint_id_b),
    CONSTRAINT unique_relation UNIQUE (complaint_id_a, complaint_id_b)
);

-- 9. Overlap Alerts Table
CREATE TABLE IF NOT EXISTS overlap_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id VARCHAR(50) UNIQUE NOT NULL, -- e.g. OVL-2026-0042
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    aicte_permanent_id VARCHAR(50) NOT NULL,
    complaint_id_a UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    complaint_id_b UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    bureau_a VARCHAR(50) NOT NULL,
    bureau_b VARCHAR(50) NOT NULL,
    category_a VARCHAR(100) NOT NULL,
    category_b VARCHAR(100) NOT NULL,
    rule_match_score NUMERIC(5,2) NOT NULL, -- 0 to 100
    semantic_similarity_score NUMERIC(5,2), -- 0 to 100 (null if fallback used)
    match_reasons JSONB NOT NULL, -- Array of strings explainable reasons
    alert_status VARCHAR(50) NOT NULL DEFAULT 'Pending Review' CHECK (alert_status IN (
        'Pending Review',
        'Confirmed Related',
        'Confirmed Duplicate',
        'Marked Unrelated',
        'Resolved'
    )),
    recommended_action TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_overlap_pair UNIQUE (complaint_id_a, complaint_id_b)
);

-- 10. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_role VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'Overlap Alert', 'Deadline', 'Overdue', 'Transfer', 'Status'
    reference_id VARCHAR(100),
    reference_type VARCHAR(50), -- 'complaint', 'overlap'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for optimal lookup performance
CREATE INDEX IF NOT EXISTS idx_complaints_inst_id ON complaints(institution_id);
CREATE INDEX IF NOT EXISTS idx_complaints_perm_id ON complaints(aicte_permanent_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_bureau ON complaints(current_bureau_id);
CREATE INDEX IF NOT EXISTS idx_complaints_received ON complaints(received_date);
CREATE INDEX IF NOT EXISTS idx_institutions_perm_id ON institutions(aicte_permanent_id);
CREATE INDEX IF NOT EXISTS idx_overlap_alerts_inst ON overlap_alerts(institution_id);
CREATE INDEX IF NOT EXISTS idx_overlap_alerts_status ON overlap_alerts(alert_status);
CREATE INDEX IF NOT EXISTS idx_history_complaint ON case_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(recipient_id, is_read);

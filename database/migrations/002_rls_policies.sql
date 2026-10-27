-- ====================================================================
-- AICTE COMPLAINT TRACKER — ROW LEVEL SECURITY POLICIES (MIGRATION 002)
-- Target Database: PostgreSQL 14+ / Supabase PostgreSQL
-- ====================================================================

-- Enable RLS on core tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlap_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Table Policies
-- Users can view their own profile or Administrators can view all profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
CREATE POLICY "profiles_select_policy" ON profiles
    FOR SELECT
    USING (
        auth.uid()::text = id 
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid()::text AND p.role IN ('Administrator', 'Senior Management')
        )
    );

-- 2. Complaints Table Policies
-- Read policy: Admins and Senior Management have global access; Bureau officers see their bureau; Regional officers see their region
DROP POLICY IF EXISTS "complaints_select_policy" ON complaints;
CREATE POLICY "complaints_select_policy" ON complaints
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid()::text 
            AND (
                p.role IN ('Administrator', 'Senior Management')
                OR (p.role = 'Regulation Bureau Officer' AND (current_bureau_id = 'RB' OR receiving_bureau_id = 'RB'))
                OR (p.role = 'PGRC Officer' AND (current_bureau_id = 'PGRC' OR receiving_bureau_id = 'PGRC'))
                OR (p.role = 'Regional Officer' AND EXISTS (
                    SELECT 1 FROM institutions i WHERE i.id = complaints.institution_id AND i.region ILIKE '%' || p.region || '%'
                ))
            )
        )
    );

-- 3. Overlap Alerts Policies
DROP POLICY IF EXISTS "overlap_alerts_select_policy" ON overlap_alerts;
CREATE POLICY "overlap_alerts_select_policy" ON overlap_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid()::text 
            AND (
                p.role IN ('Administrator', 'Senior Management')
                OR (p.role = 'Regulation Bureau Officer' AND (bureau_a = 'RB' OR bureau_b = 'RB'))
                OR (p.role = 'PGRC Officer' AND (bureau_a = 'PGRC' OR bureau_b = 'PGRC'))
            )
        )
    );

-- 4. Case History Policies
-- Case history is strictly immutable: SELECT permitted for authorized case viewers, INSERT only
DROP POLICY IF EXISTS "case_history_select_policy" ON case_history;
CREATE POLICY "case_history_select_policy" ON case_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM complaints c 
            WHERE c.id = case_history.complaint_id
        )
    );

-- 5. Documents Policies
DROP POLICY IF EXISTS "documents_select_policy" ON documents;
CREATE POLICY "documents_select_policy" ON documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM complaints c 
            WHERE c.id = documents.complaint_id
        )
    );

-- 6. Audit Logs Policies (Admins and Senior Management only)
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
CREATE POLICY "audit_logs_select_policy" ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid()::text AND p.role IN ('Administrator', 'Senior Management')
        )
    );

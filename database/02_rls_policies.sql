-- ====================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE related_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlap_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can read directory; Admins can manage all profiles
CREATE POLICY "Allow authenticated read profiles" ON profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin manage profiles" ON profiles
    FOR ALL TO authenticated USING (
        auth.jwt() ->> 'role' = 'Administrator'
    );

-- Institutions: Public/Officer read; Admins & Officers can register
CREATE POLICY "Allow authenticated read institutions" ON institutions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authorized manage institutions" ON institutions
    FOR ALL TO authenticated USING (
        auth.jwt() ->> 'role' IN ('Administrator', 'Regulation Bureau Officer', 'PGRC Officer')
    );

-- Complaints: Role-based read & write
CREATE POLICY "Allow authorized read complaints" ON complaints
    FOR SELECT TO authenticated USING (
        auth.jwt() ->> 'role' IN ('Administrator', 'Senior Management') OR
        (auth.jwt() ->> 'role' = 'Regulation Bureau Officer' AND current_bureau_id = 'RB') OR
        (auth.jwt() ->> 'role' = 'PGRC Officer' AND current_bureau_id = 'PGRC') OR
        (auth.jwt() ->> 'role' = 'Regional Officer')
    );

CREATE POLICY "Allow authorized insert complaints" ON complaints
    FOR INSERT TO authenticated WITH CHECK (
        auth.jwt() ->> 'role' IN ('Administrator', 'Regulation Bureau Officer', 'PGRC Officer', 'Regional Officer')
    );

CREATE POLICY "Allow authorized update complaints" ON complaints
    FOR UPDATE TO authenticated USING (
        auth.jwt() ->> 'role' IN ('Administrator', 'Regulation Bureau Officer', 'PGRC Officer', 'Regional Officer')
    );

-- Overlap Alerts: RBAC Read & Review
CREATE POLICY "Allow officers view overlap alerts" ON overlap_alerts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow officers review overlap alerts" ON overlap_alerts
    FOR UPDATE TO authenticated USING (
        auth.jwt() ->> 'role' IN ('Administrator', 'Regulation Bureau Officer', 'PGRC Officer', 'Senior Management')
    );

-- Notifications: User scoped read & update
CREATE POLICY "Allow user read own notifications" ON notifications
    FOR SELECT TO authenticated USING (
        recipient_id = auth.uid() OR recipient_role = auth.jwt() ->> 'role'
    );

CREATE POLICY "Allow user update own notifications" ON notifications
    FOR UPDATE TO authenticated USING (
        recipient_id = auth.uid() OR recipient_role = auth.jwt() ->> 'role'
    );

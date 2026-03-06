
-- Performance indexes for high-traffic tables
CREATE INDEX IF NOT EXISTS idx_activities_office ON activities(office_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_due ON activities(due_date);
CREATE INDEX IF NOT EXISTS idx_meetings_office ON meetings(office_id);
CREATE INDEX IF NOT EXISTS idx_meetings_user ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bonus_grants_office ON bonus_grants(office_id);
CREATE INDEX IF NOT EXISTS idx_bonus_requests_office ON bonus_requests(office_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_office ON health_scores(office_id);

-- Fix Activities RLS: Manager can view team activities
CREATE POLICY "Manager can view team activities"
ON activities FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager') AND office_id IN (SELECT get_manager_office_ids(auth.uid())));

-- Fix Activities RLS: Viewer can view all activities
CREATE POLICY "Viewer can view all activities"
ON activities FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'viewer'));

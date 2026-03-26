-- Add page visibility keys for Medewerkers and Activity Log
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_page_visibility_page_key_check'
  ) THEN
    ALTER TABLE user_page_visibility DROP CONSTRAINT user_page_visibility_page_key_check;
  END IF;
END $$;

ALTER TABLE user_page_visibility
ADD CONSTRAINT user_page_visibility_page_key_check CHECK (
  page_key IN (
    'dashboard',
    'organisatie',
    'brands',
    'automontage',
    'werkzaamheden',
    'medewerkers',
    'activity_log',
    'onderdelen',
    'user_management',
    'users_log'
  )
);

-- Application activity log for repairs, maintenance and vehicles
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN (
      'repair_created',
      'repair_updated',
      'repair_status_changed',
      'repair_part_added',
      'maintenance_created',
      'maintenance_plan_created',
      'maintenance_plan_updated',
      'maintenance_status_changed',
      'vehicle_created',
      'vehicle_updated',
      'vehicle_deleted'
    )
  ),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('repair', 'maintenance_work', 'maintenance_aanpak', 'vehicle')),
  subject_id UUID,
  subject_label TEXT NOT NULL,
  amount NUMERIC(12, 2),
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type
  ON activity_logs(activity_type);

CREATE INDEX IF NOT EXISTS idx_activity_logs_subject
  ON activity_logs(subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
  ON activity_logs(user_id);

GRANT SELECT, INSERT ON TABLE activity_logs TO anon;
GRANT SELECT, INSERT ON TABLE activity_logs TO authenticated;

NOTIFY pgrst, 'reload schema';

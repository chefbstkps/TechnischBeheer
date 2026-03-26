-- Allow logging of failed login attempts.

ALTER TABLE public.user_activity_logs
  DROP CONSTRAINT IF EXISTS user_activity_logs_activity_type_check;

ALTER TABLE public.user_activity_logs
  ADD CONSTRAINT user_activity_logs_activity_type_check
  CHECK (activity_type IN ('login', 'logout', 'auto_logout', 'failed_login', 'password_change', 'profile_update'));

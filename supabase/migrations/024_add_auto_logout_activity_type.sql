-- Allow logging of automatic / forced logout events.

ALTER TABLE public.user_activity_logs
  DROP CONSTRAINT IF EXISTS user_activity_logs_activity_type_check;

ALTER TABLE public.user_activity_logs
  ADD CONSTRAINT user_activity_logs_activity_type_check
  CHECK (activity_type IN ('login', 'logout', 'auto_logout', 'password_change', 'profile_update'));


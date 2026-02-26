-- ============================================================
-- PostgREST 404 diagnose: voer uit in SQL Editor
-- ============================================================

-- 1) Bestaat de functie in public?
SELECT n.nspname AS schema_name, p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'login_user';

-- 2) Notification queue verversen (vaak oorzaak van 404)
SELECT pg_notification_queue_usage();

-- 3) PostgREST schema reload
NOTIFY pgrst, 'reload schema';

-- Na het uitvoeren: wacht 5–10 seconden en probeer opnieuw in te loggen.
-- Blijft het 404? Gebruik dan de Edge Function (zie README of deploy auth-login).

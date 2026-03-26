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
    'profile',
    'organisatie',
    'brands',
    'automontage',
    'werkzaamheden',
    'reparaties',
    'medewerkers',
    'activity_log',
    'onderdelen',
    'user_management',
    'users_log'
  )
);

NOTIFY pgrst, 'reload schema';

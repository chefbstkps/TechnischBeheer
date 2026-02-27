-- Extend auth system with signup + admin user management RPCs

-- Expand allowed page keys for visibility guard
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
    'onderdelen',
    'user_management',
    'users_log'
  )
);

-- Public signup: new user is inactive until admin approval
CREATE OR REPLACE FUNCTION signup_user(
  p_username TEXT,
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_password TEXT,
  p_telefoonnummer TEXT DEFAULT NULL,
  p_rang TEXT DEFAULT NULL,
  p_organisatie TEXT DEFAULT NULL,
  p_structuur TEXT DEFAULT NULL,
  p_afdeling TEXT DEFAULT NULL
)
RETURNS SETOF app_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user app_users;
BEGIN
  INSERT INTO app_users (
    username,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    is_active,
    must_change_password,
    telefoonnummer,
    rang,
    organisatie,
    structuur,
    afdeling
  )
  VALUES (
    TRIM(p_username),
    TRIM(p_email),
    hash_password(p_password),
    TRIM(p_first_name),
    TRIM(p_last_name),
    'user',
    false,
    true,
    NULLIF(TRIM(COALESCE(p_telefoonnummer, '')), ''),
    NULLIF(TRIM(COALESCE(p_rang, '')), ''),
    NULLIF(TRIM(COALESCE(p_organisatie, '')), ''),
    NULLIF(TRIM(COALESCE(p_structuur, '')), ''),
    NULLIF(TRIM(COALESCE(p_afdeling, '')), '')
  )
  RETURNING * INTO v_user;

  RETURN QUERY
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at
  FROM app_users
  WHERE id = v_user.id;
END;
$$;

CREATE OR REPLACE FUNCTION get_all_users()
RETURNS SETOF app_users
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at
  FROM app_users
  ORDER BY username;
$$;

CREATE OR REPLACE FUNCTION create_user(
  p_username TEXT,
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'user',
  p_telefoonnummer TEXT DEFAULT NULL,
  p_rang TEXT DEFAULT NULL,
  p_organisatie TEXT DEFAULT NULL,
  p_structuur TEXT DEFAULT NULL,
  p_afdeling TEXT DEFAULT NULL
)
RETURNS SETOF app_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user app_users;
BEGIN
  INSERT INTO app_users (
    username,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    is_active,
    must_change_password,
    telefoonnummer,
    rang,
    organisatie,
    structuur,
    afdeling
  )
  VALUES (
    TRIM(p_username),
    TRIM(p_email),
    hash_password(p_password),
    TRIM(p_first_name),
    TRIM(p_last_name),
    CASE WHEN p_role IN ('admin', 'super_user', 'user') THEN p_role ELSE 'user' END,
    true,
    true,
    NULLIF(TRIM(COALESCE(p_telefoonnummer, '')), ''),
    NULLIF(TRIM(COALESCE(p_rang, '')), ''),
    NULLIF(TRIM(COALESCE(p_organisatie, '')), ''),
    NULLIF(TRIM(COALESCE(p_structuur, '')), ''),
    NULLIF(TRIM(COALESCE(p_afdeling, '')), '')
  )
  RETURNING * INTO v_user;

  RETURN QUERY
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at
  FROM app_users
  WHERE id = v_user.id;
END;
$$;

CREATE OR REPLACE FUNCTION update_user(
  p_user_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_session_timeout_minutes INTEGER DEFAULT NULL,
  p_session_timeout_type TEXT DEFAULT NULL,
  p_telefoonnummer TEXT DEFAULT NULL,
  p_rang TEXT DEFAULT NULL,
  p_organisatie TEXT DEFAULT NULL,
  p_structuur TEXT DEFAULT NULL,
  p_afdeling TEXT DEFAULT NULL
)
RETURNS SETOF app_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE app_users
  SET
    first_name = COALESCE(NULLIF(TRIM(p_first_name), ''), first_name),
    last_name = COALESCE(NULLIF(TRIM(p_last_name), ''), last_name),
    email = COALESCE(NULLIF(TRIM(p_email), ''), email),
    role = CASE
      WHEN p_role IS NULL THEN role
      WHEN p_role IN ('admin', 'super_user', 'user') THEN p_role
      ELSE role
    END,
    is_active = COALESCE(p_is_active, is_active),
    session_timeout_minutes = COALESCE(p_session_timeout_minutes, session_timeout_minutes),
    session_timeout_type = COALESCE(NULLIF(p_session_timeout_type, ''), session_timeout_type),
    telefoonnummer = COALESCE(NULLIF(TRIM(p_telefoonnummer), ''), telefoonnummer),
    rang = COALESCE(NULLIF(TRIM(p_rang), ''), rang),
    organisatie = COALESCE(NULLIF(TRIM(p_organisatie), ''), organisatie),
    structuur = COALESCE(NULLIF(TRIM(p_structuur), ''), structuur),
    afdeling = COALESCE(NULLIF(TRIM(p_afdeling), ''), afdeling),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at
  FROM app_users
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM app_users WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION reset_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE app_users
  SET
    password_hash = hash_password(p_new_password),
    must_change_password = true,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Optional RPC for log retrieval (admin/user views)
CREATE OR REPLACE FUNCTION get_user_activity_logs(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  activity_type TEXT,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.user_id,
    u.username,
    l.activity_type,
    l.success,
    l.error_message,
    l.created_at,
    l.ip_address,
    l.user_agent
  FROM user_activity_logs l
  LEFT JOIN app_users u ON u.id = l.user_id
  WHERE p_user_id IS NULL OR l.user_id = p_user_id
  ORDER BY l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION signup_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_all_users() TO anon;
GRANT EXECUTE ON FUNCTION create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION update_user(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION delete_user(UUID) TO anon;
GRANT EXECUTE ON FUNCTION reset_password(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_activity_logs(UUID) TO anon;

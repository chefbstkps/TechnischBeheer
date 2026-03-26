-- Add is_medewerker to app_users (default false for existing and new)
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS is_medewerker BOOLEAN NOT NULL DEFAULT false;

-- Update create_user: add p_is_medewerker and use it in INSERT/SELECT
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
  p_afdeling TEXT DEFAULT NULL,
  p_is_medewerker BOOLEAN DEFAULT false
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
    afdeling,
    is_medewerker
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
    NULLIF(TRIM(COALESCE(p_afdeling, '')), ''),
    COALESCE(p_is_medewerker, false)
  )
  RETURNING * INTO v_user;

  RETURN QUERY
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at, is_medewerker
  FROM app_users
  WHERE id = v_user.id;
END;
$$;

-- Update update_user: add p_is_medewerker and update SET / SELECT
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
  p_afdeling TEXT DEFAULT NULL,
  p_is_medewerker BOOLEAN DEFAULT NULL
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
    is_medewerker = COALESCE(p_is_medewerker, is_medewerker),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at, is_medewerker
  FROM app_users
  WHERE id = p_user_id;
END;
$$;

-- get_all_users: include is_medewerker in SELECT
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS SETOF app_users
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at, is_medewerker
  FROM app_users
  ORDER BY username;
$$;

-- signup_user: include is_medewerker in returned SELECT (insert uses default false)
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
         created_at, updated_at, is_medewerker
  FROM app_users
  WHERE id = v_user.id;
END;
$$;

-- login_user: include is_medewerker in RETURN QUERY
CREATE OR REPLACE FUNCTION login_user(
  p_username TEXT,
  p_password TEXT,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS SETOF app_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user app_users;
BEGIN
  SELECT * INTO v_user
  FROM app_users
  WHERE LOWER(username) = LOWER(p_username)
    AND is_active = true;

  IF v_user.id IS NULL THEN
    RETURN;
  END IF;

  IF NOT verify_password(p_password, v_user.password_hash) THEN
    RETURN;
  END IF;

  UPDATE app_users
  SET last_login = now(),
      last_login_ip = p_ip,
      last_login_user_agent = p_user_agent,
      updated_at = now()
  WHERE id = v_user.id;

  RETURN QUERY
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at, is_medewerker
  FROM app_users
  WHERE id = v_user.id;
END;
$$;

-- get_user_by_id: include is_medewerker in SELECT
CREATE OR REPLACE FUNCTION get_user_by_id(p_id UUID)
RETURNS SETOF app_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at, is_medewerker
  FROM app_users
  WHERE id = p_id AND is_active = true;
END;
$$;

-- Update grants for new function signatures
GRANT EXECUTE ON FUNCTION create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION update_user(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon;

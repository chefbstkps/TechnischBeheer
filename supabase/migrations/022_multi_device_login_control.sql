-- Add per-user multi-device setting and server-side session control.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS allow_multiple_sessions BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  session_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id_active
  ON user_sessions(user_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token
  ON user_sessions(session_token);

DROP FUNCTION IF EXISTS login_user(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION login_user(
  p_username TEXT,
  p_password TEXT,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_force_takeover BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT,
  is_active BOOLEAN,
  must_change_password BOOLEAN,
  last_login TIMESTAMPTZ,
  last_login_ip TEXT,
  last_login_user_agent TEXT,
  session_timeout_minutes INTEGER,
  session_timeout_type TEXT,
  telefoonnummer TEXT,
  rang TEXT,
  organisatie TEXT,
  structuur TEXT,
  afdeling TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_medewerker BOOLEAN,
  allow_multiple_sessions BOOLEAN,
  session_token UUID,
  login_conflict BOOLEAN,
  conflict_message TEXT,
  conflict_ip TEXT,
  conflict_user_agent TEXT,
  conflict_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user app_users;
  v_existing_session user_sessions;
  v_session_token UUID;
  v_allows_multiple BOOLEAN;
BEGIN
  SELECT * INTO v_user
  FROM app_users AS au
  WHERE LOWER(au.username) = LOWER(p_username)
    AND au.is_active = true;

  IF v_user.id IS NULL THEN
    RETURN;
  END IF;

  IF NOT verify_password(p_password, v_user.password_hash) THEN
    RETURN;
  END IF;

  v_allows_multiple := v_user.role = 'admin' OR COALESCE(v_user.allow_multiple_sessions, false);

  IF NOT v_allows_multiple THEN
    SELECT *
    INTO v_existing_session
    FROM user_sessions AS us
    WHERE us.user_id = v_user.id
      AND us.is_active = true
    ORDER BY us.created_at DESC
    LIMIT 1;

    IF v_existing_session.id IS NOT NULL AND COALESCE(p_force_takeover, false) = false THEN
      RETURN QUERY
      SELECT
        v_user.id,
        v_user.username,
        v_user.email,
        ''::TEXT,
        v_user.first_name,
        v_user.last_name,
        v_user.role,
        v_user.is_active,
        v_user.must_change_password,
        v_user.last_login,
        v_user.last_login_ip,
        v_user.last_login_user_agent,
        v_user.session_timeout_minutes,
        v_user.session_timeout_type,
        v_user.telefoonnummer,
        v_user.rang,
        v_user.organisatie,
        v_user.structuur,
        v_user.afdeling,
        v_user.created_at,
        v_user.updated_at,
        v_user.is_medewerker,
        v_user.allow_multiple_sessions,
        NULL::UUID,
        true,
        'Deze gebruiker is al ingelogd op een ander apparaat.',
        v_existing_session.ip_address,
        v_existing_session.user_agent,
        v_existing_session.created_at;
      RETURN;
    END IF;

    IF v_existing_session.id IS NOT NULL THEN
      UPDATE user_sessions
      SET is_active = false,
          invalidated_at = now()
      WHERE user_sessions.user_id = v_user.id
        AND user_sessions.is_active = true;
    END IF;
  END IF;

  INSERT INTO user_sessions (user_id, ip_address, user_agent)
  VALUES (v_user.id, p_ip, p_user_agent)
  RETURNING user_sessions.session_token INTO v_session_token;

  UPDATE app_users
  SET last_login = now(),
      last_login_ip = p_ip,
      last_login_user_agent = p_user_agent,
      updated_at = now()
  WHERE app_users.id = v_user.id
  RETURNING * INTO v_user;

  RETURN QUERY
  SELECT
    v_user.id,
    v_user.username,
    v_user.email,
    ''::TEXT,
    v_user.first_name,
    v_user.last_name,
    v_user.role,
    v_user.is_active,
    v_user.must_change_password,
    v_user.last_login,
    v_user.last_login_ip,
    v_user.last_login_user_agent,
    v_user.session_timeout_minutes,
    v_user.session_timeout_type,
    v_user.telefoonnummer,
    v_user.rang,
    v_user.organisatie,
    v_user.structuur,
    v_user.afdeling,
    v_user.created_at,
    v_user.updated_at,
    v_user.is_medewerker,
    v_user.allow_multiple_sessions,
    v_session_token,
    false,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TIMESTAMPTZ;
END;
$$;

CREATE OR REPLACE FUNCTION validate_user_session(
  p_user_id UUID,
  p_session_token UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_sessions us
    INNER JOIN app_users u ON u.id = us.user_id
    WHERE us.user_id = p_user_id
      AND us.session_token = p_session_token
      AND us.is_active = true
      AND u.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION logout_user_session(
  p_user_id UUID,
  p_session_token UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false,
      invalidated_at = now()
  WHERE user_id = p_user_id
    AND session_token = p_session_token
    AND is_active = true;
END;
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
         created_at, updated_at, is_medewerker, allow_multiple_sessions
  FROM app_users
  WHERE id = v_user.id;
END;
$$;

DROP FUNCTION IF EXISTS update_user(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

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
  p_is_medewerker BOOLEAN DEFAULT NULL,
  p_allow_multiple_sessions BOOLEAN DEFAULT NULL
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
    allow_multiple_sessions = COALESCE(p_allow_multiple_sessions, allow_multiple_sessions),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at, is_medewerker, allow_multiple_sessions
  FROM app_users
  WHERE id = p_user_id;
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
         created_at, updated_at, is_medewerker, allow_multiple_sessions
  FROM app_users
  ORDER BY username;
$$;

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
         created_at, updated_at, is_medewerker, allow_multiple_sessions
  FROM app_users
  WHERE id = v_user.id;
END;
$$;

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
         created_at, updated_at, is_medewerker, allow_multiple_sessions
  FROM app_users
  WHERE id = p_id AND is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION login_user(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION validate_user_session(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION logout_user_session(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION update_user(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN) TO anon;

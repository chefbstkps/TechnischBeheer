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

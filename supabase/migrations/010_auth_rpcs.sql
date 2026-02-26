-- Auth RPCs: login (case-insensitive username), get_user_by_id, change_password, page visibility, session timeout, activity log

-- login_user: username case-insensitive, password case-sensitive
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
         created_at, updated_at
  FROM app_users
  WHERE id = v_user.id;
END;
$$;

-- get_user_by_id: return single active user (no password_hash)
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
         created_at, updated_at
  FROM app_users
  WHERE id = p_id AND is_active = true;
END;
$$;

-- change_password: user changes own password
CREATE OR REPLACE FUNCTION change_password(
  p_user_id UUID,
  p_current_password TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT password_hash INTO v_hash FROM app_users WHERE id = p_user_id AND is_active = true;
  IF v_hash IS NULL OR NOT verify_password(p_current_password, v_hash) THEN
    RETURN false;
  END IF;
  UPDATE app_users
  SET password_hash = hash_password(p_new_password),
      must_change_password = false,
      updated_at = now()
  WHERE id = p_user_id;
  RETURN true;
END;
$$;

-- get_user_page_visibility
CREATE OR REPLACE FUNCTION get_user_page_visibility(p_user_id UUID)
RETURNS TABLE(page_key TEXT, visible BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT upv.page_key, upv.visible
  FROM user_page_visibility upv
  WHERE upv.user_id = p_user_id;
$$;

-- set_user_page_visibility
CREATE OR REPLACE FUNCTION set_user_page_visibility(
  p_user_id UUID,
  p_page_key TEXT,
  p_visible BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_page_visibility (user_id, page_key, visible)
  VALUES (p_user_id, p_page_key, p_visible)
  ON CONFLICT (user_id, page_key) DO UPDATE SET visible = p_visible;
END;
$$;

-- set_user_session_timeout
CREATE OR REPLACE FUNCTION set_user_session_timeout(
  p_user_id UUID,
  p_session_timeout_minutes INTEGER,
  p_session_timeout_type TEXT DEFAULT 'since_login'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE app_users
  SET session_timeout_minutes = p_session_timeout_minutes,
      session_timeout_type = COALESCE(NULLIF(p_session_timeout_type, ''), 'since_login'),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- log_activity: for login, logout, password_change, profile_update
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id UUID,
  p_activity_type TEXT,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_activity_logs (user_id, activity_type, success, error_message, ip_address, user_agent)
  VALUES (p_user_id, p_activity_type, p_success, p_error_message, p_ip_address, p_user_agent);
END;
$$;

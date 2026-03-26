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

  INSERT INTO user_page_visibility (user_id, page_key, visible)
  VALUES
    (v_user.id, 'activity_log', false),
    (v_user.id, 'user_management', false),
    (v_user.id, 'users_log', false)
  ON CONFLICT (user_id, page_key) DO UPDATE SET visible = EXCLUDED.visible;

  RETURN QUERY
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at, is_medewerker
  FROM app_users
  WHERE id = v_user.id;
END;
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
  IF EXISTS (
    SELECT 1
    FROM app_users
    WHERE LOWER(username) = LOWER(TRIM(p_username))
  ) THEN
    RAISE EXCEPTION 'Deze gebruikersnaam bestaat al.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app_users
    WHERE LOWER(email) = LOWER(TRIM(p_email))
  ) THEN
    RAISE EXCEPTION 'Dit e-mailadres bestaat al.';
  END IF;

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

  INSERT INTO user_page_visibility (user_id, page_key, visible)
  VALUES
    (v_user.id, 'activity_log', false),
    (v_user.id, 'user_management', false),
    (v_user.id, 'users_log', false)
  ON CONFLICT (user_id, page_key) DO UPDATE SET visible = EXCLUDED.visible;

  RETURN QUERY
  SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active,
         must_change_password, last_login, last_login_ip, last_login_user_agent,
         session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling,
         created_at, updated_at, is_medewerker
  FROM app_users
  WHERE id = v_user.id;
END;
$$;

GRANT EXECUTE ON FUNCTION signup_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon;

NOTIFY pgrst, 'reload schema';

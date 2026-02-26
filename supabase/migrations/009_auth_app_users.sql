-- Auth: app_users table and password functions
-- Usernames are case-insensitive for login; passwords are case-sensitive.

-- digest() for password hashing comes from pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'super_user', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  last_login_ip TEXT,
  last_login_user_agent TEXT,
  session_timeout_minutes INTEGER CHECK (session_timeout_minutes IS NULL OR session_timeout_minutes IN (10, 30, 60)),
  session_timeout_type TEXT CHECK (session_timeout_type IS NULL OR session_timeout_type IN ('since_login', 'inactivity')),
  telefoonnummer TEXT,
  rang TEXT,
  organisatie TEXT,
  structuur TEXT,
  afdeling TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(username),
  UNIQUE(email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_username_lower ON app_users (LOWER(username));

-- Password hashing (SHA256 + salt; consider bcrypt/argon2 for production)
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  RETURN encode(digest(password || 'tb_salt', 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  RETURN hash_password(password) = hash;
END;
$$;

-- user_activity_logs
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('login', 'logout', 'password_change', 'profile_update')),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at);

-- user_page_visibility (page keys for this app)
CREATE TABLE IF NOT EXISTS user_page_visibility (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL CHECK (page_key IN (
    'dashboard', 'organisatie', 'brands', 'automontage', 'werkzaamheden', 'onderdelen'
  )),
  visible BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, page_key)
);

CREATE INDEX IF NOT EXISTS idx_user_page_visibility_user_id ON user_page_visibility(user_id);

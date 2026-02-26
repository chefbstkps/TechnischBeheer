-- ============================================================
-- Technisch Beheer – Auth setup (één keer in Supabase SQL Editor)
-- Kopieer dit hele bestand en voer het uit in:
-- Supabase Dashboard → SQL Editor → New query → plakken → Run
-- ============================================================

-- digest() voor wachtwoord-hashing komt uit de extensie pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Alles in public schema (PostgREST/Supabase API kijkt daar)
-- 1) Tabellen en basis functies (009)
CREATE TABLE IF NOT EXISTS public.app_users (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_username_lower ON public.app_users (LOWER(username));

CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT AS $$ BEGIN RETURN encode(digest(password || 'tb_salt', 'sha256'), 'hex'); END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$ BEGIN RETURN public.hash_password(password) = hash; END; $$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('login', 'logout', 'password_change', 'profile_update')),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs(created_at);

CREATE TABLE IF NOT EXISTS public.user_page_visibility (
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL CHECK (page_key IN ('dashboard', 'organisatie', 'brands', 'automontage', 'werkzaamheden', 'onderdelen')),
  visible BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, page_key)
);
CREATE INDEX IF NOT EXISTS idx_user_page_visibility_user_id ON public.user_page_visibility(user_id);

-- 2) RPCs (010) – expliciet in public
CREATE OR REPLACE FUNCTION public.login_user(p_username TEXT, p_password TEXT, p_ip TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL)
RETURNS SETOF public.app_users LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user public.app_users;
BEGIN
  SELECT * INTO v_user FROM public.app_users WHERE LOWER(username) = LOWER(p_username) AND is_active = true;
  IF v_user.id IS NULL THEN RETURN; END IF;
  IF NOT public.verify_password(p_password, v_user.password_hash) THEN RETURN; END IF;
  UPDATE public.app_users SET last_login = now(), last_login_ip = p_ip, last_login_user_agent = p_user_agent, updated_at = now() WHERE id = v_user.id;
  RETURN QUERY SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active, must_change_password, last_login, last_login_ip, last_login_user_agent, session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling, created_at, updated_at FROM public.app_users WHERE id = v_user.id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_user_by_id(p_id UUID)
RETURNS SETOF public.app_users LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT id, username, email, ''::TEXT AS password_hash, first_name, last_name, role, is_active, must_change_password, last_login, last_login_ip, last_login_user_agent, session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling, created_at, updated_at FROM public.app_users WHERE id = p_id AND is_active = true;
END; $$;

CREATE OR REPLACE FUNCTION public.change_password(p_user_id UUID, p_current_password TEXT, p_new_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hash TEXT;
BEGIN
  SELECT password_hash INTO v_hash FROM public.app_users WHERE id = p_user_id AND is_active = true;
  IF v_hash IS NULL OR NOT public.verify_password(p_current_password, v_hash) THEN RETURN false; END IF;
  UPDATE public.app_users SET password_hash = public.hash_password(p_new_password), must_change_password = false, updated_at = now() WHERE id = p_user_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.get_user_page_visibility(p_user_id UUID)
RETURNS TABLE(page_key TEXT, visible BOOLEAN) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT upv.page_key, upv.visible FROM public.user_page_visibility upv WHERE upv.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.set_user_page_visibility(p_user_id UUID, p_page_key TEXT, p_visible BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO public.user_page_visibility (user_id, page_key, visible) VALUES (p_user_id, p_page_key, p_visible) ON CONFLICT (user_id, page_key) DO UPDATE SET visible = p_visible; END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_session_timeout(p_user_id UUID, p_session_timeout_minutes INTEGER, p_session_timeout_type TEXT DEFAULT 'since_login')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.app_users SET session_timeout_minutes = p_session_timeout_minutes, session_timeout_type = COALESCE(NULLIF(p_session_timeout_type, ''), 'since_login'), updated_at = now() WHERE id = p_user_id; END;
$$;

CREATE OR REPLACE FUNCTION public.log_activity(p_user_id UUID, p_activity_type TEXT, p_success BOOLEAN DEFAULT true, p_error_message TEXT DEFAULT NULL, p_ip_address TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO public.user_activity_logs (user_id, activity_type, success, error_message, ip_address, user_agent) VALUES (p_user_id, p_activity_type, p_success, p_error_message, p_ip_address, p_user_agent); END;
$$;

-- 3) Rechten voor anon (nodig voor PostgREST)
GRANT EXECUTE ON FUNCTION public.login_user(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_by_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.change_password(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_page_visibility(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.set_user_page_visibility(UUID, TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.set_user_session_timeout(UUID, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO anon;

-- 4) Admin-gebruiker (wachtwoord: Admin#123)
INSERT INTO public.app_users (username, email, password_hash, first_name, last_name, role, is_active, must_change_password)
VALUES ('Admin', 'admin@localhost', public.hash_password('Admin#123'), 'Admin', 'Admin', 'admin', true, true)
ON CONFLICT (username) DO NOTHING;

-- 5) Schema-cache van de API verversen (zodat /rpc/login_user zichtbaar wordt)
NOTIFY pgrst, 'reload schema';

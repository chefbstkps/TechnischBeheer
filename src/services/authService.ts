import { getSupabase } from '../lib/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase-config';
import type { AppUser, LoginCredentials, ChangePasswordData, UserPageVisibility, UserPageKey } from '../types/auth';

const STORAGE_KEYS = {
  user: 'tb_user',
  loggedInAt: 'tb_logged_in_at',
  lastActivityAt: 'tb_last_activity_at',
};

function mapRowToAppUser(row: Record<string, unknown>): AppUser {
  return {
    id: row.id as string,
    username: row.username as string,
    email: row.email as string,
    first_name: (row.first_name as string) ?? '',
    last_name: (row.last_name as string) ?? '',
    role: row.role as AppUser['role'],
    is_active: row.is_active as boolean,
    must_change_password: row.must_change_password as boolean,
    last_login: row.last_login as string | undefined,
    last_login_ip: row.last_login_ip as string | null | undefined,
    last_login_user_agent: row.last_login_user_agent as string | null | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    session_timeout_minutes: row.session_timeout_minutes as AppUser['session_timeout_minutes'],
    session_timeout_type: row.session_timeout_type as AppUser['session_timeout_type'],
    telefoonnummer: row.telefoonnummer as string | undefined,
    rang: row.rang as string | undefined,
    organisatie: row.organisatie as string | undefined,
    structuur: row.structuur as string | undefined,
    afdeling: row.afdeling as string | undefined,
  };
}

export const authStorageKeys = STORAGE_KEYS;

/** Login via Edge Function (gebruikt wanneer PostgREST /rpc/login_user 404 geeft) */
async function loginViaEdgeFunction(
  credentials: LoginCredentials,
  ip: string | undefined,
  userAgent: string | undefined
): Promise<AppUser> {
  const url = `${SUPABASE_URL}/functions/v1/auth-login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      username: credentials.username.trim(),
      password: credentials.password,
      ip: ip ?? null,
      user_agent: userAgent ?? null,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = 'Login mislukt';
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  const row = JSON.parse(text) as Record<string, unknown>;
  if (!row?.id) throw new Error('Ongeldige gebruikersnaam of wachtwoord');
  return mapRowToAppUser(row);
}

export async function login(credentials: LoginCredentials): Promise<AppUser> {
  let ip: string | undefined;
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    ip = data?.ip;
  } catch {
    // ignore
  }
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('login_user', {
    p_username: credentials.username.trim(),
    p_password: credentials.password,
    p_ip: ip ?? null,
    p_user_agent: userAgent ?? null,
  });

  if (error) {
    const is404 =
      (error as { code?: string; status?: number }).code === 'PGRST301' ||
      (error as { status?: number }).status === 404 ||
      String((error as { message?: string }).message || '').includes('404');
    if (is404) {
      const user = await loginViaEdgeFunction(credentials, ip, userAgent);
      await logActivity(user.id, 'login', true, undefined, ip, userAgent);
      return user;
    }
    throw new Error(error.message || 'Login mislukt');
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0];
  if (!row) throw new Error('Ongeldige gebruikersnaam of wachtwoord');

  const user = mapRowToAppUser(row);
  await logActivity(user.id, 'login', true, undefined, ip, userAgent);
  return user;
}

export async function logout(userId: string): Promise<void> {
  await logActivity(userId, 'logout', true);
}

export async function getCurrentUser(userId: string): Promise<AppUser | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_user_by_id', { p_id: userId });
  if (error || !data) return null;
  const rows = Array.isArray(data) ? data : [data];
  const row = rows[0];
  if (!row) return null;
  return mapRowToAppUser(row);
}

export async function changePassword(userId: string, data: ChangePasswordData): Promise<void> {
  const supabase = getSupabase();
  const { data: ok, error } = await supabase.rpc('change_password', {
    p_user_id: userId,
    p_current_password: data.current_password,
    p_new_password: data.new_password,
  });
  if (error) throw new Error(error.message || 'Wachtwoord wijzigen mislukt');
  if (ok === false) throw new Error('Huidig wachtwoord is onjuist');
  await logActivity(userId, 'password_change', true);
}

export async function getUserPageVisibility(userId: string): Promise<UserPageVisibility> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_user_page_visibility', { p_user_id: userId });
  if (error) return {} as UserPageVisibility;
  const rows = Array.isArray(data) ? data : [];
  const visibility = {} as UserPageVisibility;
  const keys = ['dashboard', 'organisatie', 'brands', 'automontage', 'werkzaamheden', 'onderdelen'] as const;
  keys.forEach((k) => (visibility[k] = true)); // default visible
  rows.forEach((r: { page_key: string; visible: boolean }) => {
    if (keys.includes(r.page_key as UserPageKey)) visibility[r.page_key as UserPageKey] = r.visible;
  });
  return visibility;
}

export async function setUserPageVisibility(
  userId: string,
  pageKey: UserPageKey,
  visible: boolean
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('set_user_page_visibility', {
    p_user_id: userId,
    p_page_key: pageKey,
    p_visible: visible,
  });
  if (error) throw new Error(error.message || 'Pagina-zichtbaarheid opslaan mislukt');
}

export async function setUserSessionTimeout(
  userId: string,
  minutes: number | null,
  type: 'since_login' | 'inactivity' = 'since_login'
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('set_user_session_timeout', {
    p_user_id: userId,
    p_session_timeout_minutes: minutes,
    p_session_timeout_type: type,
  });
  if (error) throw new Error(error.message || 'Sessie-timeout opslaan mislukt');
}

export async function logActivity(
  userId: string,
  activityType: 'login' | 'logout' | 'password_change' | 'profile_update',
  success: boolean,
  errorMessage?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const supabase = getSupabase();
  await supabase.rpc('log_activity', {
    p_user_id: userId,
    p_activity_type: activityType,
    p_success: success,
    p_error_message: errorMessage ?? null,
    p_ip_address: ipAddress ?? null,
    p_user_agent: userAgent ?? null,
  });
}

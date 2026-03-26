import { getSupabase } from '../lib/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase-config';
import { USER_PAGE_KEYS } from '../types/auth';
import type {
  ActivityType,
  AppUser,
  ChangePasswordData,
  CreateUserData,
  LoginCredentials,
  LoginConflict,
  LoginOptions,
  LoginResult,
  ResetPasswordData,
  SignupData,
  UpdateUserData,
  UserActivityLogEntry,
  UserPageKey,
  UserPageVisibility,
} from '../types/auth';

const STORAGE_KEYS = {
  user: 'tb_user',
  sessionToken: 'tb_session_token',
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
    is_medewerker: row.is_medewerker as boolean | undefined,
    allow_multiple_sessions: row.allow_multiple_sessions as boolean | undefined,
  };
}

function cleanText(value?: string): string | null {
  const next = value?.trim();
  return next ? next : null;
}

export const authStorageKeys = STORAGE_KEYS;

/** Login via Edge Function (gebruikt wanneer PostgREST /rpc/login_user 404 geeft) */
async function loginViaEdgeFunction(
  credentials: LoginCredentials,
  ip: string | undefined,
  userAgent: string | undefined,
  options: LoginOptions = {}
): Promise<LoginResult> {
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
      force_takeover: options.forceTakeover ?? false,
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
  return mapLoginResponse(row);
}

function buildLoginConflict(row: Record<string, unknown>): LoginConflict {
  const createdAt = (row.conflict_created_at as string | null | undefined) ?? null;
  const userAgent = (row.conflict_user_agent as string | null | undefined) ?? null;
  const ipAddress = (row.conflict_ip as string | null | undefined) ?? null;

  return {
    message:
      (row.conflict_message as string | undefined) ??
      'Deze gebruiker is al ingelogd op een ander apparaat.',
    createdAt,
    userAgent,
    ipAddress,
  };
}

function mapLoginResponse(row: Record<string, unknown>): LoginResult {
  if (row.login_conflict === true) {
    return {
      status: 'conflict',
      conflict: buildLoginConflict(row),
    };
  }

  const sessionToken = row.session_token;
  if (typeof sessionToken !== 'string' || !sessionToken) {
    throw new Error('Sessie starten mislukt');
  }

  return {
    status: 'success',
    user: mapRowToAppUser(row),
    sessionToken,
  };
}

export async function login(
  credentials: LoginCredentials,
  options: LoginOptions = {}
): Promise<LoginResult> {
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
    p_force_takeover: options.forceTakeover ?? false,
  });

  if (error) {
    const is404 =
      (error as { code?: string; status?: number }).code === 'PGRST301' ||
      (error as { status?: number }).status === 404 ||
      String((error as { message?: string }).message || '').includes('404');
    if (is404) {
      const result = await loginViaEdgeFunction(credentials, ip, userAgent, options);
      if (result.status === 'success') {
        await logActivity(result.user.id, 'login', true, undefined, ip, userAgent);
      }
      return result;
    }
    throw new Error(error.message || 'Login mislukt');
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0];
  if (!row) throw new Error('Ongeldige gebruikersnaam of wachtwoord');

  const result = mapLoginResponse(row as Record<string, unknown>);
  if (result.status === 'success') {
    await logActivity(result.user.id, 'login', true, undefined, ip, userAgent);
  }
  return result;
}

export async function logout(userId: string, sessionToken?: string | null): Promise<void> {
  if (sessionToken) {
    const supabase = getSupabase();
    await supabase.rpc('logout_user_session', {
      p_user_id: userId,
      p_session_token: sessionToken,
    });
  }
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

export async function validateSession(userId: string, sessionToken: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('validate_user_session', {
    p_user_id: userId,
    p_session_token: sessionToken,
  });
  if (error) return false;
  return data === true;
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

export async function signup(data: SignupData): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('signup_user', {
    p_username: data.username.trim(),
    p_email: data.email.trim(),
    p_first_name: data.first_name.trim(),
    p_last_name: data.last_name.trim(),
    p_password: data.password,
    p_telefoonnummer: cleanText(data.telefoonnummer),
    p_rang: cleanText(data.rang),
    p_organisatie: cleanText(data.organisatie),
    p_structuur: cleanText(data.structuur),
    p_afdeling: cleanText(data.afdeling),
  });

  if (error) throw new Error(error.message || 'Registratie mislukt');
}

export async function checkSignupAvailability(params: {
  username?: string;
  email?: string;
}): Promise<{ usernameExists: boolean; emailExists: boolean }> {
  const username = params.username?.trim() || null;
  const email = params.email?.trim() || null;

  if (!username && !email) {
    return { usernameExists: false, emailExists: false };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('check_signup_availability', {
    p_username: username,
    p_email: email,
  });

  if (error) {
    throw new Error(error.message || 'Beschikbaarheid controleren mislukt');
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as
    | {
        username_exists?: boolean | null;
        email_exists?: boolean | null;
      }
    | undefined;

  return {
    usernameExists: Boolean(row?.username_exists),
    emailExists: Boolean(row?.email_exists),
  };
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { usernameExists } = await checkSignupAvailability({ username });
  return !usernameExists;
}

export async function isEmailAvailable(email: string): Promise<boolean> {
  const { emailExists } = await checkSignupAvailability({ email });
  return !emailExists;
}

export async function getAllUsers(): Promise<AppUser[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_all_users');
  if (error) throw new Error(error.message || 'Gebruikers laden mislukt');
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.map((row) => mapRowToAppUser(row as Record<string, unknown>));
}

export async function createUser(userData: CreateUserData): Promise<AppUser> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('create_user', {
    p_username: userData.username.trim(),
    p_email: userData.email.trim(),
    p_first_name: userData.first_name.trim(),
    p_last_name: userData.last_name.trim(),
    p_password: userData.password,
    p_role: userData.role,
    p_telefoonnummer: cleanText(userData.telefoonnummer),
    p_rang: cleanText(userData.rang),
    p_organisatie: cleanText(userData.organisatie),
    p_structuur: cleanText(userData.structuur),
    p_afdeling: cleanText(userData.afdeling),
    p_is_medewerker: userData.is_medewerker ?? false,
  });

  if (error) throw new Error(error.message || 'Gebruiker aanmaken mislukt');
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('Gebruiker aanmaken mislukt');
  return mapRowToAppUser(row);
}

export async function updateUser(userId: string, userData: UpdateUserData): Promise<AppUser> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('update_user', {
    p_user_id: userId,
    p_first_name: userData.first_name?.trim() ?? null,
    p_last_name: userData.last_name?.trim() ?? null,
    p_email: userData.email?.trim() ?? null,
    p_role: userData.role ?? null,
    p_is_active: userData.is_active ?? null,
    p_session_timeout_minutes: userData.session_timeout_minutes ?? null,
    p_session_timeout_type: userData.session_timeout_type ?? null,
    p_telefoonnummer: cleanText(userData.telefoonnummer),
    p_rang: cleanText(userData.rang),
    p_organisatie: cleanText(userData.organisatie),
    p_structuur: cleanText(userData.structuur),
    p_afdeling: cleanText(userData.afdeling),
    p_is_medewerker: userData.is_medewerker ?? null,
    p_allow_multiple_sessions: userData.allow_multiple_sessions ?? null,
  });

  if (error) throw new Error(error.message || 'Gebruiker bijwerken mislukt');
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('Gebruiker bijwerken mislukt');
  return mapRowToAppUser(row);
}

export async function deleteUser(userId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('delete_user', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message || 'Gebruiker verwijderen mislukt');
}

export async function resetPassword(data: ResetPasswordData): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('reset_password', {
    p_user_id: data.user_id,
    p_new_password: data.new_password,
  });
  if (error) throw new Error(error.message || 'Wachtwoord resetten mislukt');
}

export async function getUserPageVisibility(userId: string): Promise<UserPageVisibility> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_user_page_visibility', { p_user_id: userId });
  if (error) return {} as UserPageVisibility;
  const rows = Array.isArray(data) ? data : [];
  const visibility = {} as UserPageVisibility;
  USER_PAGE_KEYS.forEach((k) => (visibility[k] = true)); // default visible
  rows.forEach((r: { page_key: string; visible: boolean }) => {
    if (USER_PAGE_KEYS.includes(r.page_key as UserPageKey)) visibility[r.page_key as UserPageKey] = r.visible;
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
  activityType: ActivityType,
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

export async function getUserActivityLogs(userId?: string): Promise<UserActivityLogEntry[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('user_activity_logs')
    .select('id,user_id,activity_type,success,error_message,created_at,ip_address,user_agent,app_users(username)')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Activiteitenlog laden mislukt');

  return (data ?? []).map((row) => {
    const userObj = row.app_users as { username?: string } | null;
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      username: userObj?.username ?? 'Onbekend',
      activity_type: row.activity_type as ActivityType,
      success: row.success as boolean,
      error_message: (row.error_message as string | null) ?? null,
      created_at: row.created_at as string,
      ip_address: (row.ip_address as string | null) ?? null,
      user_agent: (row.user_agent as string | null) ?? null,
    };
  });
}

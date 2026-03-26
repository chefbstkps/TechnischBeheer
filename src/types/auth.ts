// Page keys for this app (must match user_page_visibility.page_key in DB)
export const USER_PAGE_KEYS = [
  'dashboard',
  'profile',
  'organisatie',
  'brands',
  'automontage',
  'werkzaamheden',
  'reparaties',
  'medewerkers',
  'activity_log',
  'onderdelen',
  'user_management',
  'users_log',
] as const;

export type UserPageKey = (typeof USER_PAGE_KEYS)[number];
export type UserPageVisibility = Record<UserPageKey, boolean>;

export type SessionTimeoutMinutes = 10 | 30 | 60 | null;
export type SessionTimeoutType = 'since_login' | 'inactivity';

export interface AppUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'super_user' | 'user';
  is_active: boolean;
  must_change_password: boolean;
  last_login?: string;
  last_login_ip?: string | null;
  last_login_user_agent?: string | null;
  created_at: string;
  updated_at: string;
  session_timeout_minutes?: SessionTimeoutMinutes;
  session_timeout_type?: SessionTimeoutType;
  telefoonnummer?: string;
  rang?: string;
  organisatie?: string;
  structuur?: string;
  afdeling?: string;
  is_medewerker?: boolean;
  allow_multiple_sessions?: boolean;
  page_visibility?: UserPageVisibility;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginOptions {
  forceTakeover?: boolean;
}

export interface LoginConflict {
  message: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: string | null;
}

export type LoginResult =
  | {
      status: 'success';
      user: AppUser;
      sessionToken: string;
    }
  | {
      status: 'conflict';
      conflict: LoginConflict;
    };

export interface SignupData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  telefoonnummer?: string;
  rang?: string;
  organisatie?: string;
  structuur?: string;
  afdeling?: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: AppUser['role'];
  telefoonnummer?: string;
  rang?: string;
  organisatie?: string;
  structuur?: string;
  afdeling?: string;
  is_medewerker?: boolean;
}

export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: AppUser['role'];
  is_active?: boolean;
  session_timeout_minutes?: SessionTimeoutMinutes;
  session_timeout_type?: SessionTimeoutType;
  telefoonnummer?: string;
  rang?: string;
  organisatie?: string;
  structuur?: string;
  afdeling?: string;
  is_medewerker?: boolean;
  allow_multiple_sessions?: boolean;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ResetPasswordData {
  user_id: string;
  new_password: string;
}

export type ActivityType = 'login' | 'logout' | 'password_change' | 'profile_update';

export interface UserActivityLogEntry {
  id: string;
  user_id: string;
  username: string;
  activity_type: ActivityType;
  success: boolean;
  error_message: string | null;
  created_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
}

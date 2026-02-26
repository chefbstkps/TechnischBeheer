// Page keys for this app (must match user_page_visibility.page_key in DB)
export const USER_PAGE_KEYS = [
  'dashboard',
  'organisatie',
  'brands',
  'automontage',
  'werkzaamheden',
  'onderdelen',
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
  page_visibility?: UserPageVisibility;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

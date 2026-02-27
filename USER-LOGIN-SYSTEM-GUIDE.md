# User Login System – Reusable Architecture Guide

This document explains how the user login system works in this webapp so you can replicate the same structure in another project.

---

## Overview

The system uses **custom authentication** (not Supabase Auth). It stores users in a PostgreSQL `app_users` table, hashes passwords with database functions, and keeps the session in **localStorage** on the client. Supabase is used only as the database/backend.

### High-Level Flow

1. User submits username + password on the Login page (or registers via Signup with admin approval).
2. `AuthService.login()` calls Supabase RPC `login_user` (credentials checked in DB; IP and user agent recorded).
3. On success, user data (including `session_timeout_minutes`/`session_timeout_type`) is saved in React state and localStorage; page visibility is fetched and merged.
4. `AuthContext` exposes `signIn`, `signOut`, `user`, role helpers, and enforces session timeout (since login or after inactivity).
5. `ProtectedRoute` guards routes and redirects unauthenticated users to `/login`.
6. `PageVisibilityGuard` hides or redirects from pages the user is not allowed to see (admin-configurable per user).

---

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Login Page    │────▶ │   AuthContext   │─────▶│  AuthService    │
│  (username/pwd) │      │ (state, signIn,  │      │ (login, logout, │
└─────────────────┘      │  session timeout)│      │  signup, RPCs)  │
┌─────────────────┐      └────────┬─────────┘      └────────┬────────┘
│   Signup Page   │───────────────┤                         │
│  (register →    │               │                         ▼
│   is_active=0)  │               │                ┌─────────────────┐
└─────────────────┘               │                │    Supabase     │
                                  │                │ login_user,     │
                                  ▼                │ get_user_by_id, │
                        ┌──────────────────┐       │ signup_user,    │
                        │ ProtectedRoute   │       │ page_visibility │
                        │ (guards routes)  │       └─────────────────┘
                        └──────────────────┘
                                  │
                                  ▼
                        ┌───────────────────┐
                        │PageVisibilityGuard│
                        │ (per-page access) │
                        └───────────────────┘
```

---

## 1. Database Schema

### Core Tables

**`app_users`**

| Column                  | Type      | Description                                          |
|-------------------------|-----------|------------------------------------------------------|
| id                      | UUID      | Primary key                                          |
| username                | TEXT      | Unique, used for login                               |
| email                   | TEXT      | Unique                                               |
| password_hash           | TEXT      | Hashed password                                     |
| first_name              | TEXT      |                                                      |
| last_name               | TEXT      |                                                      |
| role                    | TEXT      | `admin`, `super_user`, or `user`                     |
| is_active               | BOOLEAN   | Default `true`; signup users start with `false`      |
| must_change_password    | BOOLEAN   | Default `true`                                       |
| last_login              | TIMESTAMP | Updated on login                                     |
| last_login_ip           | TEXT      | IP at last login (optional, from client)             |
| last_login_user_agent   | TEXT      | Browser/user agent at last login                     |
| session_timeout_minutes | INTEGER   | 10, 30, 60 or NULL (never)                           |
| session_timeout_type    | TEXT      | `since_login` or `inactivity`                        |
| telefoonnummer          | TEXT      | Optional                                             |
| rang                    | TEXT      | Optional                                             |
| organisatie             | TEXT      | Optional (e.g. groep name)                           |
| structuur               | TEXT      | Optional                                             |
| afdeling                | TEXT      | Optional                                             |
| created_at              | TIMESTAMP |                                                      |
| updated_at              | TIMESTAMP |                                                      |

**`user_activity_logs`**

| Column        | Type      | Description                                                       |
|---------------|-----------|-------------------------------------------------------------------|
| id            | UUID      | Primary key                                                       |
| user_id       | UUID      | FK to `app_users`                                                 |
| activity_type | TEXT      | `login`, `logout`, `password_change`, `profile_update`             |
| success       | BOOLEAN   | Whether the activity succeeded                                    |
| error_message | TEXT      | Optional error details                                            |
| ip_address    | TEXT      | Optional; stored for login events                                 |
| user_agent    | TEXT      | Optional; stored for login events                                 |
| created_at    | TIMESTAMP |                                                                   |

**`user_page_visibility`**

| Column   | Type    | Description                                              |
|----------|---------|----------------------------------------------------------|
| user_id  | UUID    | FK to `app_users`, part of PK                            |
| page_key | TEXT    | One of: storingen, installation, issue, accessories, inventory, brands, organizations, radio_archive, radio_history, telefoon, phone_numbers |
| visible  | BOOLEAN | Whether the page is visible in nav and accessible        |

### Password Functions

```sql
-- Hash password (use bcrypt in production; this is SHA256 + salt for simplicity)
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(password || 'salt', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Verify password
CREATE OR REPLACE FUNCTION verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN hash_password(password) = hash;
END;
$$ LANGUAGE plpgsql;
```

> **Security note:** For production, use bcrypt or argon2 instead of SHA256. You’d replace these functions with equivalent bcrypt equivalents.

### Auth RPCs (this app)

- **`login_user(p_username, p_password, p_ip?, p_user_agent?)`** – Validates credentials, updates `last_login` and optional IP/user agent, returns user row (no password_hash). Called by `AuthService.login()`.
- **`get_user_by_id(p_id)`** – Returns one active user by ID (for session restore and admin).
- **`signup_user(p_username, p_email, p_first_name, p_last_name, p_password, p_telefoonnummer?, ...)`** – Public registration; creates user with `is_active = false` and `role = 'user'`. Grant `EXECUTE` to `anon` so unauthenticated users can register.
- **`get_user_page_visibility(p_user_id)`** – Returns one row per page_key with visible (true/false).
- **`set_user_page_visibility(p_user_id, p_page_key, p_visible)`** – Admin sets visibility for one page.
- **`set_user_session_timeout(p_user_id, p_session_timeout_minutes, p_session_timeout_type?)`** – Admin sets 10/30/60 or NULL, and `since_login` or `inactivity`.

See `database/auth-system-simple.sql`, `database/auth-system-rpc-extensions.sql`, `database/add-signup-user.sql`, `database/user-page-visibility.sql`, `database/add-session-timeout.sql`, `database/add-session-timeout-type.sql`, `database/add-user-last-login-ip-browser.sql`, `database/add-activity-log-ip-browser.sql`, and `database/add-user-fields.sql` for the full setup.

---

## 2. TypeScript Types

```typescript
// Page keys that can be shown/hidden per user (must match DB user_page_visibility.page_key)
export const USER_PAGE_KEYS = [
  'storingen', 'installation', 'issue', 'accessories', 'inventory', 'brands',
  'organizations', 'radio_archive', 'radio_history', 'telefoon', 'phone_numbers',
] as const
export type UserPageKey = (typeof USER_PAGE_KEYS)[number]
export type UserPageVisibility = Record<UserPageKey, boolean>

export type SessionTimeoutMinutes = 10 | 30 | 60 | null
export type SessionTimeoutType = 'since_login' | 'inactivity'

export interface AppUser {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'super_user' | 'user'
  is_active: boolean
  must_change_password: boolean
  last_login?: string
  last_login_ip?: string | null
  last_login_user_agent?: string | null
  created_at: string
  updated_at: string
  session_timeout_minutes?: SessionTimeoutMinutes
  session_timeout_type?: SessionTimeoutType
  telefoonnummer?: string
  rang?: string
  organisatie?: string
  structuur?: string
  afdeling?: string
  page_visibility?: UserPageVisibility  // Fetched separately and merged in AuthContext
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface SignupData {
  username: string
  email: string
  first_name: string
  last_name: string
  password: string
  telefoonnummer?: string
  rang?: string
  organisatie?: string
  structuur?: string
  afdeling?: string
}

export interface CreateUserData {
  username: string
  email: string
  first_name: string
  last_name: string
  password: string
  role: 'admin' | 'super_user' | 'user'
  telefoonnummer?: string
  rang?: string
  organisatie?: string
  structuur?: string
  afdeling?: string
}

export interface UpdateUserData {
  first_name?: string
  last_name?: string
  email?: string
  role?: 'admin' | 'super_user' | 'user'
  is_active?: boolean
  session_timeout_minutes?: SessionTimeoutMinutes
  session_timeout_type?: SessionTimeoutType
  telefoonnummer?: string
  rang?: string
  organisatie?: string
  structuur?: string
  afdeling?: string
}

export interface UserActivityLogEntry {
  id: string
  user_id: string
  username: string
  activity_type: 'login' | 'logout' | 'password_change' | 'profile_update'
  success: boolean
  error_message: string | null
  created_at: string
  ip_address?: string | null
  user_agent?: string | null
}
```

---

## 3. AuthService (`src/services/authService.ts`)

Central service for auth operations. Main methods:

| Method | Description |
|--------|-------------|
| `login(credentials)` | Calls RPC `login_user` (with optional IP/user agent), returns `AppUser` or throws |
| `logout(userId)` | Logs logout activity |
| `getCurrentUser(userId)` | Fetches user by ID via RPC `get_user_by_id` |
| `signup(data)` | Public registration via RPC `signup_user`; new user gets `is_active = false` |
| `createUser(userData)` | Creates user (admin) via RPC `create_user` |
| `updateUser(userId, data)` | Updates user (profile and/or admin fields) via RPC `update_user` |
| `changePassword(userId, data)` | User changes own password via RPC `change_password` |
| `resetPassword(data)` | Admin resets user password via RPC `reset_password` |
| `getUserPageVisibility(userId)` | Returns per-page visibility for nav and guards |
| `setUserPageVisibility(userId, pageKey, visible)` | Admin sets one page visibility |
| `setUserSessionTimeout(userId, minutes, type?)` | Admin sets session timeout (10/30/60 or null, since_login/inactivity) |
| `getUserActivityLogs(userId?)` | Fetches activity logs; omit userId for admin (all logs) |
| `logActivity(userId, type, success, error?, ip?, userAgent?)` | Writes to `user_activity_logs` (ip/user_agent optional, used for login) |

### Login Flow (this app)

1. Optionally fetch client IP (e.g. from api.ipify.org) and get `navigator.userAgent`.
2. Call `supabase.rpc('login_user', { p_username, p_password, p_ip, p_user_agent })`.
3. RPC in DB: find user by username (case-insensitive), `is_active = true`, verify password with `verify_password`, update `last_login`, `last_login_ip`, `last_login_user_agent`; return user row (no password_hash).
4. If no row returned, throw (invalid credentials).
5. Map row to `AppUser` (including `session_timeout_minutes`, `session_timeout_type`, `last_login_ip`, `last_login_user_agent`).
6. Call `logActivity(user.id, 'login', true, undefined, ip, userAgent)`.
7. Return user.

---

## 4. AuthContext (`src/contexts/AuthContext.tsx`)

React context that holds auth state and methods.

### State

- `user: AppUser | null` (includes `page_visibility` when loaded)
- `loading: boolean` (initial load from localStorage and re-fetch with page visibility)

### Methods

- `signIn(credentials)` – Calls `AuthService.login`, then `getUserPageVisibility`, merges into user, stores in state and localStorage (and sets `bst_logged_in_at`, `bst_last_activity_at` for session timeout)
- `signOut()` – Calls `AuthService.logout`, clears user and all auth keys from localStorage
- `refreshUser()` – Re-fetches current user and page visibility, updates state and localStorage
- `isAdmin()`, `isSuperUser()`, `isSuperUserOrAdmin()` – Role checks

### Session Storage

- `bst_user` – JSON of `AppUser` (including `page_visibility`).
- `bst_logged_in_at` – Timestamp (ms) when user logged in; used for session timeout type “since login”.
- `bst_last_activity_at` – Timestamp (ms) of last user activity; used for session timeout type “inactivity”.

On init, context reads `bst_user`, then re-fetches user and page visibility via `getCurrentUser` + `getUserPageVisibility` to keep data fresh; if fetch fails or user inactive, session is cleared.

### Session timeout

- If `user.session_timeout_minutes` is set (10, 30, 60), an interval runs every minute to check expiry.
- **since_login:** expiry = `bst_logged_in_at` + minutes; **inactivity:** expiry = `bst_last_activity_at` + minutes.
- On expiry, context clears user and redirects to `/login`.
- For `inactivity`, the context subscribes to `mousedown`, `keydown`, `touchstart`, `scroll` and updates `bst_last_activity_at` on each event.

---

## 5. ProtectedRoute (`src/components/ProtectedRoute.tsx`)

Wraps routes that require authentication.

### Logic

1. Show loading while auth state is initializing.
2. If not authenticated → redirect to `/login`.
3. If `requireAdmin` and user is not admin → redirect (e.g. to `/`).
4. Optional: restrict super users from certain paths.
5. Otherwise render children.

### Usage

```tsx
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />

<Route path="/admin" element={
  <ProtectedRoute requireAdmin>
    <AdminPanel />
  </ProtectedRoute>
} />
```

---

## 5b. PageVisibilityGuard (`src/components/PageVisibilityGuard.tsx`)

Used inside the protected layout to enforce per-user page visibility. Renders `<Outlet />` for child routes; if the current path maps to a `page_key` and the user has `page_visibility[pageKey] === false`, redirects to `/`.

- Maps pathname to `page_key` (e.g. `/radio-history` → `radio_history`, `/storingen` → `storingen`). All keys must match `USER_PAGE_KEYS` and `user_page_visibility.page_key`.
- If `user.page_visibility` is missing, all pages are allowed.
- Typically used as wrapper in the main layout: `<PageVisibilityGuard />` with nested `<Route>` children.

---

## 6. Login Page

Basic structure:

- Form: username + password
- `handleSubmit` → `signIn({ username, password })`
- Show error message on failure
- If already authenticated, redirect to home
- Optional: show/hide password toggle
- Link to Signup page for new users

---

## 6b. Signup Page (`src/pages/Signup.tsx`)

Public registration (no login required). Uses `AuthService.signup(signupData)` which calls RPC `signup_user`. New users are created with `is_active = false` and `role = 'user'`; they can only log in after an admin sets `is_active = true` in User Management.

- Fields: username, email, first name, last name, password (and optionally telefoonnummer, rang, organisatie, structuur, afdeling; this app uses organisatie/structuur/afdeling from an organizations hierarchy).
- Two-step form: step 1 account + optional org fields, step 2 password and organisation dropdowns.
- On success: show message that account is created and awaiting admin approval; link back to Login.
- Route: `/signup` (no `ProtectedRoute`).

---

## 7. My Profile (`src/pages/Profile.tsx`)

Allows authenticated users to view and update their own account information.

### Features

- **Profile Information tab**
  - View username (read-only)
  - View role (read-only)
  - Edit first name, last name, email
  - View last login time (read-only)
  - Submit updates via `AuthService.updateUser(user.id, profileData)`
  - Call `refreshUser()` after successful update to sync AuthContext

- **Change Password tab**
  - Current password (for verification)
  - New password and confirm password
  - Submit via `AuthService.changePassword(user.id, passwordData)`
  - On success, clears form and shows success message

### AuthService Methods Used

- `AuthService.updateUser(userId, updateData)` – Updates first_name, last_name, email
- `AuthService.changePassword(userId, changePasswordData)` – Verifies current password, hashes and saves new one, logs `password_change` activity

### Types

```typescript
export interface UpdateUserData {
  first_name?: string
  last_name?: string
  email?: string
}

export interface ChangePasswordData {
  current_password: string
  new_password: string
  confirm_password: string
}
```

### Access

- Available to all authenticated users (typically under `/profile`)
- Uses `useAuth()` for `user` and `refreshUser`

---

## 8. User Management (`src/pages/UserManagement.tsx`) and User Details (`src/pages/UserDetails.tsx`)

Admin-only area for creating, editing, deleting users, resetting passwords, and configuring per-user page visibility and session timeout.

### UserManagement (list)

- **User list** – Table of all users (username, name, role, status, last login)
- **Create user** – Modal form with username, email, first name, last name, password, role; optional telefoonnummer, rang, organisatie, structuur, afdeling
- **Edit user** – Modal to update first name, last name, email, role, is_active (approve signup users by setting `is_active = true`), and optional org fields
- **Reset password** – Admin sets new password for any user; sets `must_change_password: true`
- **Delete user** – Confirmation dialog; removes user from `app_users`
- Link to **UserDetails** per user (`/user-management/:id`)

### UserDetails (single user, admin only)

- **Page visibility** – Toggles per `USER_PAGE_KEYS` (storingen, installation, issue, accessories, inventory, brands, organizations, radio_archive, radio_history, telefoon, phone_numbers). Saved via `setUserPageVisibility(userId, pageKey, visible)`.
- **Session timeout** – Dropdown for 10 / 30 / 60 minutes or “Nooit” (null); and type: “Verloop ongeacht activiteit” (since_login) or “Verloop na inactiviteit” (inactivity). Saved via `setUserSessionTimeout(userId, minutes, type)`.
- **Profile edit** – Same fields as edit modal (name, email, role, is_active, telefoonnummer, rang, organisatie, structuur, afdeling) via `updateUser(userId, data)`.

### AuthService Methods Used

- `AuthService.getAllUsers()` – Fetch all users
- `AuthService.getCurrentUser(id)` – Fetch one user (UserDetails)
- `AuthService.getUserPageVisibility(userId)` – Page visibility for UserDetails
- `AuthService.setUserPageVisibility(userId, pageKey, visible)` – Save one page visibility
- `AuthService.setUserSessionTimeout(userId, minutes, type)` – Save session timeout
- `AuthService.createUser(createData)` – Creates user with hashed password
- `AuthService.updateUser(userId, editData)` – Updates user fields
- `AuthService.deleteUser(userId)` – Deletes user
- `AuthService.resetPassword({ user_id, new_password })` – Admin resets password

### Access Control

- **Admin only** – Both pages check `isAdmin()`; non-admins see “Geen toegang”

### Routes

- `/user-management` – List; wrap with `ProtectedRoute requireAdmin` or check `isAdmin()` inside
- `/user-management/:id` – User details (same guard)

---

## 9. Users Activity Log (`src/pages/UsersLog.tsx`)

Admin-only page that displays audit logs from `user_activity_logs`.

### Features

- **Activity table** – Time, user, activity type, success/failure, IP address (`ip_address`), user agent (`user_agent`), details (error_message)
- **Filters**
  - Activity type: login, logout, password_change, profile_update
  - Date range: from date, to date
  - Optional: filter by user
- **Stats** – Total logs, successful count, failed count
- **Refresh** – Reload logs from database

### AuthService Method Used

- `AuthService.getUserActivityLogs()` – Fetches all logs with user info joined; no `userId` argument returns all logs (admin view)

```typescript
// Admin view – all logs
const logs = await AuthService.getUserActivityLogs()

// User view – own logs only
const logs = await AuthService.getUserActivityLogs(user.id)
```

### Activity Types

| Type             | Description                        |
|------------------|------------------------------------|
| `login`          | User logged in                     |
| `logout`         | User logged out                    |
| `password_change`| User changed or admin reset password |
| `profile_update` | User updated profile               |

### Access Control

- **Admin only** – Page checks `isAdmin()`; non-admins see "Access Denied"

### Route

- Typically `/users-log`

---

## 10. App Setup

1. Wrap the app in `AuthProvider`:

```tsx
<AuthProvider>
  <Router>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        {/* PageVisibilityGuard inside AppLayout wraps child routes */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/user-management/:id" element={<UserDetails />} />
        {/* ... other routes ... */}
      </Route>
    </Routes>
  </Router>
</AuthProvider>
```

2. In the protected layout (`AppLayout`), render `<PageVisibilityGuard />` so that nested routes are guarded by `user.page_visibility`.

3. Use `useAuth()` in components:

```tsx
const { user, signIn, signOut, isAuthenticated, isAdmin } = useAuth()
```

---

## 11. Checklist for Reuse in Another Webapp

### Database

- [ ] Create `app_users` table (with optional last_login_ip, last_login_user_agent, session_timeout_minutes, session_timeout_type, telefoonnummer, rang, organisatie, structuur, afdeling)
- [ ] Create `user_activity_logs` table (with optional ip_address, user_agent)
- [ ] Create `user_page_visibility` table and RPCs `get_user_page_visibility`, `set_user_page_visibility`
- [ ] Add `hash_password` and `verify_password` functions
- [ ] Add RPCs: `login_user`, `get_user_by_id`, `get_all_users`, `signup_user`, `create_user`, `update_user`, `change_password`, `reset_password`, `delete_user`, `set_user_session_timeout`
- [ ] Insert initial admin user
- [ ] Grant `EXECUTE` on `signup_user` to `anon` if using public signup
- [ ] Adjust RLS policies if needed
- [ ] Consider bcrypt/argon2 for passwords in production

### Frontend

- [ ] Copy `AuthService` and point to your Supabase client
- [ ] Copy `AuthContext` and change storage keys (`bst_user`, `bst_logged_in_at`, `bst_last_activity_at`)
- [ ] Copy `ProtectedRoute` and adjust roles/redirects
- [ ] Copy `PageVisibilityGuard` and align `USER_PAGE_KEYS` / path mapping with your routes
- [ ] Copy or adapt `Login` page
- [ ] Copy or adapt `Signup` page (if using public registration)
- [ ] Copy or adapt `Profile` page (My Profile)
- [ ] Copy or adapt `UserManagement` and `UserDetails` (admin only; page visibility + session timeout)
- [ ] Copy or adapt `UsersLog` page (admin only)
- [ ] Add types for `AppUser`, `LoginCredentials`, `SignupData`, `UserPageVisibility`, `SessionTimeoutMinutes`/`SessionTimeoutType`, etc.
- [ ] Wrap app with `AuthProvider`, add `/signup` route, and use `PageVisibilityGuard` in protected layout

### Customization

- [ ] Change storage keys (`bst_user` → `your_app_user`, etc.)
- [ ] Add/remove roles (`admin`, `super_user`, `user`)
- [ ] Add/remove page keys in `USER_PAGE_KEYS` and `user_page_visibility` CHECK constraint
- [ ] Add or remove device approval (optional)
- [ ] Add `staff_id` or other FK fields if needed

---

## 12. Optional Features (This Project)

- **Public signup:** Users register via `/signup`; new accounts have `is_active = false` until an admin approves in User Management.
- **Page visibility:** Admins configure which nav items/pages each user can see; `PageVisibilityGuard` enforces access; defaults for role `user` can be “all hidden” until explicitly enabled.
- **Session timeout:** Per-user setting (10/30/60 minutes or never), with type “since login” or “after inactivity”; AuthContext clears session and redirects to login when expired; inactivity type updates timestamp on user interaction.
- **Login audit:** IP and user agent sent to `login_user` and stored in `app_users` and `user_activity_logs` for audit.
- **Super user role:** Extra role with limited admin-like access; restricted from some admin-only routes.
- **Organisation fields:** telefoonnummer, rang, organisatie, structuur, afdeling on user (used in signup and UserDetails).

Device approval and staff linking can be added in a similar way; this app does not use them in the current guide.

---

## 13. File Reference

| File | Purpose |
|------|---------|
| `src/services/authService.ts` | Login (RPC login_user), logout, signup, user CRUD, page visibility, session timeout, activity logging |
| `src/contexts/AuthContext.tsx` | Auth state, signIn, signOut, session timeout, page visibility merge, role helpers |
| `src/components/ProtectedRoute.tsx` | Route protection |
| `src/components/PageVisibilityGuard.tsx` | Per-page access based on `user.page_visibility` |
| `src/pages/Login.tsx` | Login form |
| `src/pages/Signup.tsx` | Public registration (is_active=false until admin approval) |
| `src/pages/Profile.tsx` | My Profile – edit profile, change password |
| `src/pages/UserManagement.tsx` | User list, create/edit/delete user, reset password |
| `src/pages/UserDetails.tsx` | Per-user page visibility toggles, session timeout, profile edit |
| `src/pages/UsersLog.tsx` | Users Activity Log – admin audit log (ip_address, user_agent) |
| `src/types/index.ts` | `AppUser`, `LoginCredentials`, `SignupData`, `UserPageVisibility`, `SessionTimeoutMinutes`/`Type`, etc. |
| `database/auth-system-simple.sql` | Base tables and hash/verify_password |
| `database/auth-system-rpc-extensions.sql` | RPCs for login, user CRUD, etc. |
| `database/add-signup-user.sql` | `signup_user` RPC (anon grant) |
| `database/user-page-visibility.sql` | `user_page_visibility` table, get/set RPCs |
| `database/add-session-timeout.sql` | session_timeout_minutes, set_user_session_timeout |
| `database/add-session-timeout-type.sql` | session_timeout_type (since_login / inactivity) |
| `database/add-user-last-login-ip-browser.sql` | last_login_ip, last_login_user_agent, login_user params |
| `database/add-activity-log-ip-browser.sql` | ip_address, user_agent on user_activity_logs |
| `database/add-user-fields.sql` | telefoonnummer, rang, organisatie, structuur, afdeling |

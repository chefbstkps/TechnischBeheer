### Technical Architecture & Core Structure

This document describes the technical architecture, project structure, and core patterns used in this application so you can replicate the same foundation in future projects.

### 1. Technical Architecture Overview

- **Application type**: Single-Page Application (SPA) written in TypeScript/React, bundled with Vite, deployed as static assets.
- **Single codebase**: Frontend and infrastructure configs live in one repository. Backend data/services are provided by Supabase (managed Postgres + Auth + RPC) consumed directly from the client.
- **Key technologies**:
  - **React 18 + TypeScript** for UI and type safety
  - **React Router v6** for client-side routing
  - **@tanstack/react-query v5** for async data fetching/caching
  - **Supabase JS v2** for data and authentication
  - **Vite** for dev server and build pipeline
  - **vite-plugin-pwa** for PWA features (service worker, offline caching, install prompt)
  - **ESLint + @typescript-eslint** for linting
- **Build**: `vite build` (preceded by `tsc` type-check) outputs production assets to `dist/`.
- **Deployment**: Static hosting (e.g., Vercel). `vercel.json` rewrites all non-`/api` routes to `/index.html` for SPA routing. PWA assets are generated/served by Vite PWA plugin.

### 2. Project Structure & File Organization

```
src/
├── components/               # Reusable, mostly presentational or small container components (.tsx + .css)
├── config/                   # Environment/configuration helpers (e.g., Supabase keys)
├── contexts/                 # React Context providers (Auth, Language, Query client, Perf settings)
├── hooks/                    # Reusable hooks (e.g., cached queries helpers)
├── lib/                      # Service clients and typed SDK wrappers (e.g., Supabase client + DB types)
├── pages/                    # Route-level screens (.tsx + .css), wired via React Router
├── services/                 # Business/service layer that talks to Supabase and orchestrates logic
├── types/                    # Global and domain TypeScript types/interfaces
├── utils/                    # Stateless helpers and utilities
├── App.css                   # App-level styles
├── App.tsx                   # App shell: providers + router + layout
├── index.css                 # Global resets/theme vars
├── main.tsx                  # Entry: mounts <App/>, registers PWA, applies persisted theme
└── pwa.ts                    # PWA registration/bootstrap

public/                       # Static assets copied as-is
dist/                         # Build output (generated)
vercel.json                   # SPA rewrites for deployment
vite.config.ts                # Build config (React + PWA plugin)
tsconfig.json                 # TS compiler settings for app
tsconfig.node.json            # TS config for tooling
```

Conventions:

- Each UI file is colocated with its stylesheet: `ComponentName.tsx` + `ComponentName.css`.
- Route pages live under `src/pages/` following the same pairing pattern.
- Cross-cutting concerns live in `contexts/`, `services/`, `lib/`, and `types/`.

### 3. Component Architecture Patterns

- **Organization**:
  - `src/components/` hosts reusable building blocks (navigation, layout elements, controls, guards like `ProtectedRoute`).
  - `src/pages/` contains route-level containers that compose components and connect to data via services/hooks.
- **Naming**:
  - Component files use PascalCase: `Navbar.tsx`, `ProtectedRoute.tsx`.
  - Styles use the same base name: `Navbar.css`, `ProtectedRoute.css`.
  - Class names in CSS are unique per component to avoid conflicts across the app.
- **Importing styles**:

```tsx
// src/components/ExampleCard.tsx
import './ExampleCard.css'

export function ExampleCard() {
  return (
    <div className="example-card">
      <h3 className="example-card-title">Title</h3>
      <p className="example-card-body">Content</p>
    </div>
  )
}
```

- **Composition**:
  - Pages compose multiple components and connect them with data fetched via `react-query` and the `services/` layer.
  - Shared layout (e.g., `Navbar`, `Footer`) is placed in `App.tsx` surrounding the routed `main` content.
  - Route protection is handled by a `ProtectedRoute` component that reads from `AuthContext`.

### 4. Styling Architecture

- **One stylesheet per component/page**: Maintain `Component.tsx` ↔ `Component.css` pairing for cohesion.
- **Class naming methodology**: BEM-like blocks and elements (e.g., `example-card` and `example-card-title`). Keep names unique to each component.
- **Scope management**: No CSS-in-JS or CSS modules; scoping is achieved by unique, component-prefixed class names and avoiding global selectors.
- **Global styles**: `index.css` contains resets, root variables (e.g., theme colors), and app-wide theming toggles; `App.css` hosts shell-level layout classes used by `App.tsx`.
- **Post-processing**: Standard Vite CSS pipeline; no SASS/LESS required. PostCSS defaults used by Vite; add plugins as needed.

### 5. Data Flow & State Management

- **Top-level providers** (see `App.tsx`):
  - `ReactQueryProvider`: Provides a shared `QueryClient` with sensible defaults (stale time, retry/backoff, refetch behaviors).
  - `PerformanceSettingsProvider`: Stores user-tunable performance features (e.g., toggles that may affect refetching or animations).
  - `LanguageProvider`: Manages current language and lookup utilities.
  - `AuthProvider`: Centralizes auth state, login/logout flows, role checks, and redirects.
- **Data fetching and caching**: `@tanstack/react-query` is used for all remote calls. Services expose functions that perform Supabase queries; components/pages call these via hooks and cache with query keys.
- **API integration**: Direct Supabase client (`src/lib/supabase.ts`) created from env vars with a fallback to `src/config/supabase-config.ts`. If credentials are missing, a safe no-op client is provided to avoid runtime crashes and enable local UI work.
- **Business logic layer**: `src/services/` encapsulates domain operations (authentication, members, groups, payments, messaging, etc.), keeping components lean. Contexts call into services; pages/components consume contexts or hooks.

Example pattern combining services + react-query:

```tsx
// src/pages/Members.tsx (excerpt)
import { useQuery } from '@tanstack/react-query'
import { MembersService } from '../services/membersService'

export function Members() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['members', { page: 1 }],
    queryFn: () => MembersService.list({ page: 1 })
  })

  if (isLoading) return <div>Loading…</div>
  if (error) return <div>Failed to load</div>

  return (
    <ul>
      {data?.map(m => (
        <li key={m.id}>{m.first_name} {m.last_name}</li>
      ))}
    </ul>
  )
}
```

### 6. Routing Architecture

- **Client-side routing** via `react-router-dom` in `App.tsx`:
  - Public routes (e.g., `/landing`) and protected routes wrapped by `ProtectedRoute`.
  - Admin-only routes pass `requireAdmin` to `ProtectedRoute` which checks roles via `AuthContext`/`AuthService`.

Example route protection:

```tsx
// src/components/ProtectedRoute.tsx (conceptual)
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requireAdmin }: { children: JSX.Element; requireAdmin?: boolean }) {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/landing" replace />
  if (requireAdmin && !isAdmin()) return <Navigate to="/my-dashboard" replace />
  return children
}
```

### 7. Authentication & Authorization

- **Auth state** is owned by `AuthContext` and exposed via `useAuth()`.
- **AuthService** handles login/logout, session reads, and role checks; `AuthLoggingService` records auth events.
- **Role-based access**: Helpers `isAdmin`, `isSuperUser`, and `canPerformAdminAction` are exposed and used by UI guards.
- **Redirects**: Post-login redirect is decided in `AuthContext` based on role.

### 8. Configuration & Environment

- **Supabase credentials**: Prefer environment variables in `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Fallback values live in `src/config/supabase-config.ts`. The Supabase client (`src/lib/supabase.ts`) validates credentials and logs warnings if missing, substituting a no-op client for local, UI-only work.

### 9. Build, PWA, and Deployment

- **Build**: `npm run build` runs `tsc` for type-checks then `vite build` to emit `dist/`.
- **PWA**: `vite.config.ts` registers `VitePWA` with pre-caching rules, runtime caching for Google Fonts, and a manifest with icons and theme color (Excel green `#217346`). `src/pwa.ts` registers the service worker and `PWAInstallPrompt` surfaces the install UX.
- **SPA rewrites**: `vercel.json` ensures all non-API requests serve `index.html` so client routing works on refresh and deep links.

### 10. Key Technical Decisions

- **Colocation of component + style**: Simplifies maintenance and discoverability. Each component owns its styles.
- **Service layer abstraction**: Keeps UI thin, centralizes business rules, and isolates Supabase specifics.
- **React Query for server state**: Provides cache, retries, background refresh, and mutation handling out of the box.
- **Contexts for cross-cutting state**: Auth, language, performance settings, and query client are provided at the app shell.
- **Direct-to-Supabase architecture**: Reduces moving parts by avoiding a custom backend where feasible; leverage RLS and policies in the database.
- **PWA-first**: Offline caching and installability improve reliability and engagement on mobile/desktop.

### 11. Replication Checklist (Blueprint)

1. Initialize a Vite + React + TS app; add ESLint and `@typescript-eslint`.
2. Add React Router and set up `App.tsx` with a `Router` and route components.
3. Add React Query with a `QueryClientProvider` wrapper component.
4. Create `contexts/` for `AuthContext`, `LanguageContext`, and `PerformanceSettingsContext`.
5. Create `lib/supabase.ts` with env-based client creation and a safe fallback.
6. Create `services/` to encapsulate all domain operations; have pages call services via React Query.
7. Adopt `.tsx` + `.css` pairing; enforce unique, component-scoped class names.
8. Add `vite-plugin-pwa` and configure manifest, caching, and `pwa.ts` registration.
9. Configure deployment rewrites for SPA hosting (e.g., Vercel `vercel.json`).

### 12. Example App Shell

```tsx
// src/App.tsx (excerpt)
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { PerformanceSettingsProvider } from './contexts/PerformanceSettingsContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { ReactQueryProvider } from './contexts/ReactQueryProvider'
import { AuthProvider } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import './App.css'

export default function App() {
  return (
    <ReactQueryProvider>
      <PerformanceSettingsProvider>
        <LanguageProvider>
          <AuthProvider>
            <Router>
              <div className="app">
                <Navbar />
                <main className="main-content">
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </Router>
          </AuthProvider>
        </LanguageProvider>
      </PerformanceSettingsProvider>
    </ReactQueryProvider>
  )
}
```

### 13. Notes on Quality & Linting

- Use TypeScript strict mode. Avoid `any` and unsafe casts.
- Keep components small and focused; move business logic to services.
- Prefer early returns, minimal nesting, and descriptive names.
- Run `npm run lint` during development and CI.

This document focuses exclusively on the technical foundation so it can be used as a repeatable blueprint across projects.
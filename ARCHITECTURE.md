## VX Affiliate Portal — Technical Documentation

This document explains what the application does, how the codebase is organized, how major features work end‑to‑end, and what each exported function is responsible for. It is intended for engineers maintaining or extending the system.

### What the app is
- **Purpose**: A Next.js dashboard for VirtualXposure affiliates to sign in, manage a referral token/link, view summary KPIs and detailed reports, browse marketing assets, and adjust settings. Admins can create approved affiliate users.
- **Data store**: Supabase (Auth + Postgres). The schema and Row Level Security policies are defined in `supabase-schema.sql`.
- **Realtime**: Postgres changes subscriptions for dashboard KPIs.

### Technology stack
- Next.js App Router (TypeScript)
- HeroUI (UI components) + Tailwind CSS
- Supabase JS client (Auth, Database, Realtime)
- Chart.js via react-chartjs-2
- next-themes (theme switching)

### Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key (browser)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (server-only, used by admin API for user creation)
- `NEXT_PUBLIC_SITE_URL`: Base URL for callback redirects (fallbacks to `http://localhost:3000` on SSR)
- `CLARITY_PROJECT_ID`: Optional Microsoft Clarity analytics site ID

### High-level flow
1. User lands on `/auth` and signs in (email/password or Google OAuth). Password reset is supported.
2. After authentication, `handlePostAuth` ensures the user is in `approved_users` (by id, or email cross-ref for SSO). If not approved, access is denied.
3. Approved users are redirected to `/home` which loads KPIs and their referral code. Realtime updates reflect changes in `dashboard_kpis`.
4. Users can view `Reports` (transformed from `dashboard_kpis.user_reports`), `Assets`, `Referrals`, and update `Settings` (profile, password).
5. Admins can create new affiliate users via `/admin` → server-side API seeds all required tables atomically.

---

## Data model (Supabase)
Defined in `supabase-schema.sql`.

- `affiliate_profiles`
  - Per-user profile details and notification preferences.
  - RLS: users can select/insert/update their own records.

- `affiliate_referrers`
  - Stores a unique referral `code` per user; used to build `ref=` links.
  - RLS: users can select/insert their own record.

- `approved_users`
  - Controls who can access the dashboard (`status = 'active'`).
  - RLS: users can view only their own approval row.

- `dashboard_kpis`
  - Stores `user_reports` (JSON) for KPIs, links/sub_ids, traffic sources; updated daily by API or by user actions.
  - RLS: users can select/insert/update their own row.

- `affiliate_assets`
  - Marketing assets (title, url, optional metadata). Readable by all.
  - RLS: open `SELECT` policy.

- `referral_events`
  - Optional event log of referral activity per `referrer_id` (user).
  - RLS: users can select/insert their own rows.

Indexes, `updated_at` triggers, and policies are included for performance and consistency.

---

## Application architecture

### App Router structure
- `app/layout.tsx`
  - Global HTML shell, fonts, theming, and optional Microsoft Clarity script injection using `CLARITY_PROJECT_ID`.
- `app/providers.tsx`
  - Wraps HeroUI, ThemeProvider, and ToastProvider; manages periodic session refresh on focus and every 30 minutes.
- `(auth)` segment
  - `app/(auth)/auth/page.tsx`: Sign-in UI, email/password auth, reset flow entry.
  - `app/(auth)/auth/callback/page.tsx`: OAuth callback approval verification, redirects to `/home` or back to `/auth` with error.
  - `app/(auth)/auth/reset-password/page.tsx`: Resets password via Supabase `updateUser` in recovery flow.
- `(dashboard)` segment
  - `app/(dashboard)/layout.tsx`: Wraps all dashboard pages with `AuthGuard` and `Navbar`.
  - `home/page.tsx`: Referral link + Stats bar. Loads referral code and KPI totals. Subscribes to realtime KPI changes.
  - `assets/page.tsx`: Lists `affiliate_assets` with search.
  - `referrals/page.tsx`: Displays `dashboard_kpis.user_referrals` in a table with CSV export.
  - `reports/page.tsx`: Transforms `user_reports` JSON into chart/table views. Timeframe controls, CSV export.
  - `settings/page.tsx`: Edit profile data (`affiliate_profiles`), change password, debug helpers.
  - `admin/page.tsx`: Admin-only UI to create a new affiliate user via server API.
  - `admin/users/page.tsx`: Admin-only list of approved users enriched with profiles and referral codes.

### API routes
- `app/api/admin/create-user/route.ts`
  - Server route using service role key to:
    1) Create Supabase Auth user (confirmed),
    2) Upsert `approved_users` (active),
    3) Insert `affiliate_profiles` (idempotent),
    4) Insert `affiliate_referrers` with unique code (retry on conflict),
    5) Insert `dashboard_kpis` skeleton.
  - Cleans up on failure to keep data consistent.

- `app/api/admin/update-user-reports/route.ts`
  - Iterates through all `affiliate_referrers` and ensures there is a `user_reports.overview[today]` entry for each user; useful for daily initialization jobs.

---

## Libraries and function reference

### `lib/supabase.ts`
- `supabase`
  - Browser client created via `@supabase/ssr`. Auth persists in localStorage; tokens auto-refresh; cookies support SSR hydration.

- Connection health and caching
  - `ConnectionManager` (singleton, exported as `connectionManager`)
    - Tracks `isHealthy`, latency, consecutive failures; runs periodic health checks (query on `approved_users`).
    - Provides a simple in-session cache (`setCache`, `getCache`, `clearCache`, `clearExpiredCache`).
    - Recovery mechanism after consecutive failures; clears caches and retries.
    - Exposed helpers:
      - `startHealthMonitoring()`, `stopHealthMonitoring()`, `cleanup()`
      - `isConnectionHealthy()`, `getConnectionLatency()`

  - `optimizedQuery(queryFn, timeoutMs?, options?)`
    - Wraps a query with optional cache, health check notice, and retry (non-timeout errors only). Aborts on timeouts.
    - Options: `useCache`, `cacheKey`, `cacheTTL`, `skipHealthCheck`, `maxRetries`.

  - `robustQuery(queryFn, { maxRetries, baseDelay, timeout, useCache, cacheKey, cacheTTL })`
    - Retry with exponential backoff + timeout + optional cache.

  - `withAbort(query, timeoutMs?)`
    - Adds an `AbortController` timeout around a Supabase query; returns the awaited query.

  - `checkDatabaseHealth()` / `monitorDatabaseConnection()`
    - Simple probe helpers returning healthy/connected + latency and error details.

  - `DatabaseMonitor` (separate singleton)
    - Periodic health checks you can start/stop; exposes `getLastHealthCheck()` and `isHealthy()`.

  - Diagnostics helpers
    - `resetConnectionManager()` — stops monitoring, clears caches, restarts monitoring.
    - `getConnectionStats()` — summary for UI/debug (note: some fields are placeholders).

- Types
  - `DashboardKPIs`, `ReferralEvent`, `AffiliateAsset`, `ReportOverview`, `AffiliateProfile`, `AffiliateReferrer` are lightweight shared interfaces for UI.

### `lib/realtime.ts`
- `subscribeToUserKpis(userId, onChange) => unsubscribe`
  - Subscribes to Postgres changes on `dashboard_kpis` rows filtered by `user_id`. Calls `onChange` on any event.

### `lib/utils.ts`
- `cn(...inputs)` — Tailwind class merge helper (clsx + tailwind-merge).

### `lib/auth.ts`
Auth and approval
- `signInWithMagicLink(email)` — Sends magic link OTP email; redirects to `/home` after verification.
- `signInWithGoogle()` — OAuth sign-in; in dev redirects to `/auth/callback` for post-approval checks, prod to `/home`.
- `signInWithGithub()` — OAuth sign-in; redirects to `/home`.
- `signInWithEmail(email, password)` — Email/password sign-in; then `handlePostAuth`. If not approved, signs out and errors.
- `resetPassword(email)` — Sends reset email; the link targets `/auth/reset-password`.
- `signOut()` — Signs out via Supabase; used by Navbar and callback error path.
- `getUser() => Promise<User | null>` — Returns the current authenticated user.

Approval checks and post-auth flow
- `isUserApproved(userId) => Promise<boolean>`
  - Fast check on `approved_users` by `user_id` and `status = 'active'` with an 8s abort.
- `isEmailApproved(email) => Promise<boolean>`
  - Checks `approved_users` by normalized email and `status = 'active'`.
- `handlePostAuth(user) => Promise<boolean>`
  - Primary approval gate used after any sign-in. Attempts `isUserApproved(user.id)`; if not, cross-checks by email, and if approved by email, updates that record with the new `user_id`. Returns final approved status.

Profiles
- `createUserProfile(user)` — Inserts a default profile into `affiliate_profiles` for the user (idempotent on retries via server-side flows; client throws on error).
- `getUserProfile(userId)` — Fetches a single profile or `null`.
- `updateUserProfile(userId, updates)` — Updates profile row for user.

Referral codes
- `createReferralCode(userId)` — Inserts a new code into `affiliate_referrers` for the user using a random token.
- `getReferralCode(userId) => Promise<string | null>`
  - Reads `affiliate_referrers.code` with `optimizedQuery`, 30s timeout, and 10m cache keyed by `userId`.
- `updateReferralCodeForCurrentUser(desiredCode)`
  - Sanitizes the token; checks for conflicts; upserts by `user_id` unique constraint; returns `{ success, code?, error? }`. Updates cache on success.

Assets
- `getAssets() => Promise<Asset[] | null>` — Fetches all `affiliate_assets` ordered by `created_at DESC`.
- `createAsset(assetData)` — Inserts a new asset; returns created row.
- `updateAsset(id, partial)` — Updates an asset; returns updated row.
- `deleteAsset(id)` — Deletes an asset.

Reports and KPIs
- Types
  - `DailyData` — date, earnings, newCustomers, newReferrals, clicksCount
  - `UserReports` — overview totals + `dailyData` and optional chart datasets

- `getUserReports(timeframe = 'Last 30 Days', { force }?)`
  - Loads `dashboard_kpis.user_reports` for the current user using `optimizedQuery` (30s timeout). Caches 5 min unless `force` is true. Transforms to `UserReports` via `transformUserReports`.

- `transformUserReports(userReportsJson, selectedTimeframe?)`
  - Converts the JSON structure into normalized `UserReports` with properly computed date range in MST/MDT (America/Edmonton), ensuring consistent daily or monthly aggregation depending on timeframe.

- `updateUserReports(reports)` — Writes `dashboard_kpis.user_reports` for the current user.
- `updateUserDayData(date, data)` — Reads-modifies-writes `user_reports.overview[date]` for current user.
- `triggerDailyReportsUpdate()` — Calls the admin API route to ensure a fresh entry for today across users.
- `calculateUserReportsTotals({ force }?)`
  - Sums clicks/signups/customers/earnings from the entire `user_reports.overview` JSON for the current user using `optimizedQuery` with caching.

Diagnostics & session utilities
- DB connection tests
  - `testDatabaseConnection()` — Abortable probe on `approved_users`.
  - `testSupabaseConnection()` — Auth + simple table query test.
  - `testSimpleTableQuery()` — Probe `affiliate_profiles`.
  - `testSimpleQuery()` — Abortable `approved_users` probe.
  - `testExactQuery(userId)` — Abortable exact `approved_users` check.
  - `checkSupabaseConfig()` — Validates presence/shape of URL and anon key.

- Schema/setup verifiers
  - `diagnoseProfileUpdate(userId)` — Stepwise end-to-end insert/delete test to validate profile CRUD under current RLS and session.
  - `checkDatabaseTables()` — Verifies that required tables exist and are SELECTable.

- Session helpers (client-only)
  - `debugSession()` — Reads stored Supabase token from localStorage; reports presence and expiry info.
  - `forceSessionRefresh()` — Triggers `supabase.auth.getSession()` to refresh tokens and logs session info.

- Timezone/date utilities
  - `formatDateMDT(date)` / `formatDateDisplayMDT(date)` — Normalize to MDT/MST for consistent display.
  - `getCurrentDateMDT()` — Current date in MDT/MST.
  - `shouldAggregateByMonth(timeframe)` — Indicates if the timeframe should be month-aggregated.
  - `aggregateDataByMonth(dailyData)` — Aggregates daily `DailyData` rows by month.

---

## Components

Auth and layout
- `components/auth-guard.tsx (AuthGuard)`
  - On mount, checks session via `supabase.auth.getUser()`. If missing, redirects to `/auth`.
  - Verifies approval (with timeout and a simple fallback query if needed). On approval, sets user state and proceeds; otherwise redirects with a toast.
  - Background task ensures profile and referral code are created for first-time users.

- `components/navbar.tsx (Navbar)`
  - Displays site navigation, user avatar/email, connection status, and menu actions (Settings, Admin for `@virtualxposure.com`, Sign Out).
  - Listens to auth state changes and updates displayed user.

- `components/layout.tsx (Layout)`
  - An alternate simpler layout with a HeroUI Navbar. Not used by the main dashboard layout.

UI widgets
- `components/stats-bar.tsx (StatsBar)` — Four cards for total clicks, referrals, customers, and earnings.
- `components/referral-card.tsx (ReferralCard)` — Displays the user’s shareable referral URL; includes copy/share and a modal to customize the token via `updateReferralCodeForCurrentUser`.
- `components/data-table.tsx (DataTable)` — Client-side filtering and pagination for referral events; CSV handled by the calling page.
- `components/charts.tsx` — Simple ready-made `LineChart`, `BarChart`, `PieChart` with default behaviors. (Reports page renders its own Chart.js config.)
- `components/connection-status.tsx` — Hook-like component returning status props based on `connectionManager` and `checkDatabaseHealth()`.
- `components/theme-switch.tsx` + `components/icons.tsx` — Theme toggle and minimal icon set.

---

## Page behaviors and how things connect

### Auth pages
- `app/(auth)/auth/page.tsx`
  - Email/password sign-in via `signInWithEmail` (runs `handlePostAuth`).
  - Password reset flow triggers `resetPassword` and redirects.
  - Uses query param `?error=not-approved` to show denial toast.

- `app/(auth)/auth/callback/page.tsx`
  - For OAuth (Google) in development to validate approval by `handlePostAuth`. On failure, signs out and redirects back to `/auth`.

- `app/(auth)/auth/reset-password/page.tsx`
  - Verifies `token` and `type=recovery` or uses existing session from Supabase; updates password via `supabase.auth.updateUser` and signs out.

### Dashboard pages
- `app/(dashboard)/home/page.tsx`
  - Loads referral code (`getReferralCode`) and KPI totals (`calculateUserReportsTotals`).
  - Sets a realtime subscription via `subscribeToUserKpis`; on changes, forces a refresh of `user_reports` and updates KPIs.

- `app/(dashboard)/assets/page.tsx`
  - Loads public `affiliate_assets` via `getAssets`; search filters by title/url/description/category.

- `app/(dashboard)/referrals/page.tsx`
  - Reads `dashboard_kpis.user_referrals` for the current user directly (typed locally) and shows them in `DataTable`. Exports CSV.

- `app/(dashboard)/reports/page.tsx`
  - Loads `getUserReports(timeframe)` and transforms into `DailyData[]`. Renders line chart + table with timeframe controls and CSV export.
  - Uses MDT time zone consistently for labels and aggregation.

- `app/(dashboard)/settings/page.tsx`
  - Loads and edits profile data in `affiliate_profiles`. Updates are upserted/updated based on existence.
  - Offers change password with re-auth verification; includes optional diagnostic helpers (commented or gated in UI).

- `app/(dashboard)/admin/page.tsx`
  - Calls `/api/admin/create-user` (server) with email/password and user metadata. The server route seeds:
    - Auth user (confirmed),
    - `approved_users` (active),
    - `affiliate_profiles`,
    - `affiliate_referrers` (unique code),
    - `dashboard_kpis` (empty JSON structure).

- `app/(dashboard)/admin/users/page.tsx`
  - Aggregates approved users with profile names and referral codes for admin oversight.

---

## Security and access control
- Auth is done client-side using Supabase JS; sessions are persisted (localStorage) and auto-refreshed.
- RLS ensures users can only read/update their own records (except public assets, admin server route, and realtime).
- The admin `create-user` API uses the service role key server-side and enforces cleanup on failures to avoid orphaned rows.
- Admin detection (`isUserAdmin`) is by email domain `@virtualxposure.com`.

---

## Error handling and timeouts
- Most Supabase queries are wrapped with either `withAbort` or `optimizedQuery` to prevent indefinite hangs and to provide retries for transient failures.
- `AuthGuard` has a 30s timeout to avoid blocking UI and to route back to `/auth` on prolonged failures.
- `getUserReports` and referral code lookups use in-session caching for 5–10 minutes to reduce load.

---

## Extending the system
- Adding a new KPI:
  - Extend `dashboard_kpis.user_reports` JSON shape and update `transformUserReports` to compute the new metric.
  - Update `calculateUserReportsTotals` and corresponding UI (StatsBar and/or Reports page dataset mapping).

- Adding a new asset type:
  - Extend `affiliate_assets` schema (if needed) and update `Asset` interface in `lib/auth.ts`.
  - Adjust `Assets` page filters/rendering as necessary.

- Adding an admin-only tool:
  - Create a new page in `(dashboard)/admin/` and gate navigation visibility via `isUserAdmin(user)`.
  - Server-side work should be added as an API route in `app/api/admin/...` using the service role key.

---

## Quick function index (by module)

lib/supabase.ts
- supabase
- connectionManager: getInstance(), startHealthMonitoring(), stopHealthMonitoring(), cleanup(), isConnectionHealthy(), getConnectionLatency(), setCache(), getCache(), clearCache(), clearExpiredCache()
- optimizedQuery(), robustQuery(), withAbort(), checkDatabaseHealth(), monitorDatabaseConnection()
- DatabaseMonitor: getInstance(), startMonitoring(), stopMonitoring(), getLastHealthCheck(), isHealthy()
- resetConnectionManager(), getConnectionStats()
- Types: DashboardKPIs, ReferralEvent, AffiliateAsset, ReportOverview, AffiliateProfile, AffiliateReferrer

lib/realtime.ts
- subscribeToUserKpis(userId, onChange)

lib/utils.ts
- cn(...inputs)

lib/auth.ts
- signInWithMagicLink(), signInWithGoogle(), signInWithGithub(), signInWithEmail(), resetPassword(), signOut(), getUser()
- isUserApproved(), isEmailApproved(), handlePostAuth()
- createUserProfile(), getUserProfile(), updateUserProfile()
- createReferralCode(), getReferralCode(), updateReferralCodeForCurrentUser()
- getAssets(), createAsset(), updateAsset(), deleteAsset()
- getUserReports(), transformUserReports(), updateUserReports(), updateUserDayData(), triggerDailyReportsUpdate(), calculateUserReportsTotals()
- testDatabaseConnection(), testSupabaseConnection(), testSimpleTableQuery(), testSimpleQuery(), testExactQuery(userId), checkSupabaseConfig()
- diagnoseProfileUpdate(userId), checkDatabaseTables()
- debugSession(), forceSessionRefresh()
- formatDateMDT(), formatDateDisplayMDT(), getCurrentDateMDT(), shouldAggregateByMonth(), aggregateDataByMonth()

components
- AuthGuard, Navbar, Layout, StatsBar, ReferralCard, DataTable, Charts (LineChart, BarChart, PieChart), ConnectionStatus, ThemeSwitch

pages
- (auth): auth, callback, reset-password
- (dashboard): home, assets, referrals, reports, settings, admin, admin/users

api routes
- admin/create-user (POST)
- admin/update-user-reports (POST)

---

## Operational notes
- Make sure environment variables are configured in local `.env.local` and production (Vercel/Supabase) before running.
- The first-time empty database can be initialized by running SQL from `supabase-schema.sql` in the Supabase SQL editor.
- Realtime subscriptions require database replication to be enabled for the target table (`dashboard_kpis`).

---

For deeper code references, open the paths mentioned above. Each function’s implementation contains additional guardrails and logging for diagnostics.



# VX Affiliate Portal – API Reference

This file documents all application API routes under `app/api`. All endpoints return JSON unless noted.

## Auth, access and caching
- Sessions: NextAuth (cookie-based). Use NextAuth client methods in the UI (`useSession`, `signIn`, `signOut`).
- Auth required: All `/api/me/*` and `/api/admin/*` endpoints require an authenticated session.
- Admin: `/api/admin/*` additionally requires `session.user.email` to end with `@virtualxposure.com`.
- Caching: User-specific endpoints are dynamic/no-cache to avoid Vercel edge caching stale data.
- Database access: Server routes use a Supabase Service Role client (`supabaseAdmin`) to bypass RLS server-side only.

### External API access (outside the web app)
- All `/api/me/*` and `/api/admin/*` endpoints accept either:
  - Cookie-based NextAuth session (recommended), or
  - `Authorization: Bearer <token>` where `<token>` is a NextAuth session token or a Personal Access Token (PAT).

Examples
- Cookie session
  1) Get CSRF (creates cookie jar):
     ```bash
     csrf=$(curl -sS -c cookie.jar https://<host>/api/auth/csrf | jq -r .csrfToken)
     ```
  2) Sign in (credentials):
     ```bash
     curl -i -b cookie.jar -c cookie.jar \
       -H 'Content-Type: application/x-www-form-urlencoded' \
       -X POST https://<host>/api/auth/callback/credentials \
       --data-urlencode "csrfToken=$csrf" \
       --data-urlencode "email=<email>" \
       --data-urlencode "password=<password>" \
       --data-urlencode "callbackUrl=/"
     ```
  3) Call endpoints with cookie jar:
     ```bash
     curl -i -b cookie.jar https://<host>/api/me/profile
     ```

- Bearer token
  - Using a NextAuth session token (read the `next-auth.session-token` cookie value):
    ```bash
    curl -H "Authorization: Bearer <session-token>" https://<host>/api/me/profile
    ```
  - Using a PAT (see PAT endpoints below):
    ```bash
    curl -H "Authorization: Bearer pat_XXXXXXXX" https://<host>/api/me/profile
    ```

### Environment variables
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AVATARS_BUCKET` (defaults to `avatars`)
- SMTP variables if enabling NextAuth Email provider

### Supabase settings
- Expose the `next_auth` schema in Supabase API settings if querying `next_auth.users`.
- Create a (public) Storage bucket for avatars named by `NEXT_PUBLIC_AVATARS_BUCKET`.

---

## Auth (NextAuth internal)
- `GET|POST /api/auth/[...nextauth]`
  - NextAuth handler (sign-in, callbacks, session, CSRF). Use NextAuth client APIs; do not call directly.

### Password reset (request)
- `POST /api/auth/password-reset/request`
  - Public. Validates the email exists and, if found, asks Supabase Auth to send a reset email.
  - The reset email `redirectTo` is `/auth/reset-password`. That page parses the URL hash `#type=recovery&access_token=...&refresh_token=...` and calls `supabase.auth.setSession()` so the user can update their password.
  - Request body:
    ```json
    { "email": "user@example.com" }
    ```
  - Responses: 200, 400, 404, 500

---

## Me: Approval
- `GET /api/me/approval`
  - 200 `{ "approved": boolean }` | 401 `{ "approved": false }` | 500 `{ "error": string }`

---

## Me: Profile
- `GET /api/me/profile`
  - Returns the profile from `public.affiliate_profiles`. If none, synthesizes from `next_auth.users`.
  - 200 example:
    ```json
    { "profile": { "user_id": "uuid", "user_email": "user@example.com", "first_name": "First", "last_name": "Last", "avatar_url": "https://...", "social_links": {}, "notifications": { "email_reports": true, "sms_alerts": false, "push_notifications": true } } }
    ```
- `PUT /api/me/profile`
  - Upserts by session `user_id`. Server fills `user_id`/`user_email`.
  - Body: `{ first_name, last_name, avatar_url, social_links, notifications }`
  - 200 `{ "profile": ... }`
- `POST /api/me/profile/avatar` (multipart)
  - Field `file` (image). Uploads to Storage `/<user_id>/<timestamp>-<filename>`, updates `avatar_url`.
  - 200 `{ "avatarUrl": "https://..." }`

---

## Me: Password
- `PUT /api/me/password`
  - Body: `{ currentPassword, newPassword }`. 200 `{ "success": true }`

---

## Me: Referral code & token
- `GET /api/me/referrer-code` → 200 `{ "code": string|null }`
- `PUT /api/me/referrer-token`
  - Body: `{ token: "[a-z0-9_-]{3,32}" }`
  - 200 `{ success: true, code }` | 400 | 409 | 500

---

## Me: Reports
- `GET /api/me/reports/totals` → 200 `{ clicks, referrals, customers, earnings }`
- `GET /api/me/reports/raw` → 200 `{ user_reports, user_referrals }`

---

## Me: Assets
- `GET /api/me/assets` → 200 `{ assets: [...] }`

---

## Me: Personal Access Tokens (PAT)
- `GET /api/me/tokens`
  - Auth: cookie or Bearer (session token or PAT)
  - Lists your PAT metadata (tokens are not returned).
  - 200 `{ tokens: [ { id, name, active, expires_at, last_used_at, created_at } ] }`

- `POST /api/me/tokens`
  - Auth: cookie or Bearer
  - Create a new PAT. Returns the plaintext `token` once; store it securely.
  - Request body (optional):
    ```json
    { "name": "Integration Key", "expires_at": "2026-01-01T00:00:00Z" }
    ```
  - 200:
    ```json
    { "token": "pat_...", "key": { "id": "uuid", "name": "Integration Key", "active": true, "expires_at": null, "created_at": "..." } }
    ```

- `DELETE /api/me/tokens/:id`
  - Auth: cookie or Bearer
  - Revokes the specified key.
  - 200 `{ success: true }`

Notes
- PATs are validated by a SHA‑256 hash stored in `public.api_keys`.
- PATs are non-rotating; you can optionally set `expires_at`.
- Keep your PAT secret; if leaked, revoke it with DELETE.

---

## Admin
- `GET /api/admin/users` (Admin only)
  - Joins `approved_users` + `affiliate_profiles` + `affiliate_referrers`.
  - 200 `{ users: [ { id, user_id, user_email, first_name, last_name, status, created_at, referral_code } ] }`
- `POST /api/admin/create-user` (server-side use)
  - Body: `{ email, password, userData }`. Creates user and seeds related tables.
  - 200 `{ user, referralCode, message }`
- `POST /api/admin/update-user-reports` (server-side use)
  - Triggers reports refresh. 200 `{ success: true }`

---

## Error shape
Unless specified, error responses are `{ "error": string }` with an appropriate HTTP status code.

## Example cookie usage (curl)
```bash
# after logging in via the web app
curl -i -b cookie.jar https://<host>/api/me/profile
```

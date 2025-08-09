# VX Affiliate Portal – API Reference

This document lists the app-facing API routes under `app/api`. All requests and responses are JSON unless noted.

## Auth and access
- Session: NextAuth (cookie-based). All `/api/me/*` and `/api/admin/*` routes require an authenticated session.
- Admin access: `/api/admin/*` also requires `session.user.email` to end with `@virtualxposure.com`.
- Caching: Most `/api/me/*` routes are marked dynamic/no-cache to avoid Vercel edge caching.

---

## Auth (NextAuth internal)
- `GET|POST /api/auth/[...nextauth]`
  - NextAuth handler (sign-in, callbacks, session, CSRF). Use the NextAuth client APIs instead of calling this directly.

### Auth: Password reset
- `POST /api/auth/password-reset/request`
  - Public. Validates that the email exists in `next_auth.users` and, if found, sends a Supabase reset email with `redirectTo` = `/auth/reset-password`.
  - Request body:
    ```json
    { "email": "user@example.com" }
    ```
  - Responses:
    - 200 `{ "success": true }`
    - 400 `{ "error": "Email is required" }`
    - 404 `{ "error": "No account found for that email" }`
    - 500 `{ "error": string }`

---

## Me: Approval
- `GET /api/me/approval`
  - Auth: required
  - Response 200: `{ "approved": boolean }`
  - Response 401: `{ "approved": false }`
  - Response 500: `{ "error": string }`

---

## Me: Profile
- `GET /api/me/profile`
  - Auth: required
  - Returns the row from `affiliate_profiles` for the current user. Falls back to `next_auth.users` when no profile exists.
  - Response 200:
    ```json
    {
      "profile": {
        "user_id": "uuid",
        "user_email": "user@example.com",
        "first_name": "First",
        "last_name": "Last",
        "avatar_url": null,
        "social_links": {},
        "notifications": {
          "email_reports": true,
          "sms_alerts": false,
          "push_notifications": true
        }
      }
    }
    ```
  - Errors: 401/500

- `PUT /api/me/profile`
  - Auth: required
  - Upserts `affiliate_profiles` by `user_id` (taken from session).
  - Request body:
    ```json
    {
      "first_name": "string",
      "last_name": "string",
      "avatar_url": "string|null",
      "social_links": { "twitter": "", "facebook": "", "linkedin": "" },
      "notifications": { "email_reports": true, "sms_alerts": false, "push_notifications": true }
    }
    ```
  - Response 200: `{ "profile": <same shape as GET> }`
  - Errors: 401/500

---

## Me: Password
- `PUT /api/me/password`
  - Auth: required
  - Verifies the current password (best-effort) and updates it using Supabase Admin.
  - Request body:
    ```json
    { "currentPassword": "string", "newPassword": "string (>=6 chars)" }
    ```
  - Response 200: `{ "success": true }`
  - Errors: 400/401/500

---

## Me: Referral code & token
- `GET /api/me/referrer-code`
  - Auth: required
  - Response 200: `{ "code": "token-or-null" }`
  - Errors: 500

- `PUT /api/me/referrer-token`
  - Auth: required
  - Validates and upserts `affiliate_referrers` by `user_id`.
  - Request body:
    ```json
    { "token": "[a-z0-9_-]{3,32}" }
    ```
  - Responses:
    - 200 `{ "success": true, "code": "normalized-token" }`
    - 400 `{ "error": "Token must be 3-32 chars (a-z, 0-9, _ or -)" }`
    - 409 `{ "error": "That token is already taken" }`
    - 500 `{ "error": string }`

---

## Me: Reports
- `GET /api/me/reports/totals`
  - Auth: required
  - Computes totals from `dashboard_kpis.user_reports` for the current user.
  - Response 200:
    ```json
    { "clicks": 0, "referrals": 0, "customers": 0, "earnings": 0 }
    ```
  - Errors: 401/500

- `GET /api/me/reports/raw`
  - Auth: required
  - Returns raw `dashboard_kpis.user_reports` and `user_referrals` for the current user.
  - Response 200:
    ```json
    { "user_reports": { }, "user_referrals": [] }
    ```
  - Errors: 401/500

---

## Me: Assets
- `GET /api/me/assets`
  - Auth: required
  - Returns all rows from `affiliate_assets`.
  - Response 200:
    ```json
    { "assets": [ {"id":"uuid","title":"...","url":"https://...","thumb":null,"description":null,"category":null,"created_at":"...","updated_at":null} ] }
    ```
  - Errors: 401/500

---

## Admin: Users
- `GET /api/admin/users`
  - Auth: required; Admin only (email domain check)
  - Joins `approved_users` (active) with `affiliate_profiles` and `affiliate_referrers` to present user records for the admin UI.
  - Response 200:
    ```json
    {
      "users": [
        {
          "id": "approved_row_id",
          "user_id": "uuid",
          "user_email": "user@example.com",
          "first_name": "First|Unknown",
          "last_name": "Last|User",
          "status": "active",
          "created_at": "timestamp",
          "referral_code": "code|null"
        }
      ]
    }
    ```
  - Errors: 403/500

---

## Admin: Create user
- `POST /api/admin/create-user`
  - Auth: server-side usage from the app
  - Creates a Supabase Auth user and seeds:
    - `approved_users`
    - `affiliate_profiles`
    - `affiliate_referrers`
    - `dashboard_kpis`
  - Request body:
    ```json
    {
      "email": "string",
      "password": "string",
      "userData": { "first_name":"", "last_name":"", "full_name":"", "user_aryeo_id":"", "avatar_url":"", "notes":"" }
    }
    ```
  - Response 200:
    ```json
    { "user": { }, "referralCode": "ABC12345", "message": "User created successfully with all required records" }
    ```
  - Errors: 400/409/500

---

## Admin: Update user reports (maintenance)
- `POST /api/admin/update-user-reports`
  - Auth: server-side usage
  - Triggers a user reports refresh (implementation detail).
  - Response 200: `{ "success": true }` (shape may vary)

---

## Error shape
Unless otherwise specified, errors return `{ "error": string }` with an appropriate HTTP status code.

## Example cookie usage (curl)
```bash
# after logging in via the web app
curl -i -b cookie.jar https://<host>/api/me/profile
```

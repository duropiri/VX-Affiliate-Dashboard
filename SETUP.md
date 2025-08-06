# VX Affiliate Portal Setup

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Required for admin user creation
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Supabase Setup

### 1. Create Supabase Project
1. Go to https://supabase.com and create a new project
2. Get your project URL and anon key from the project settings
3. Add the environment variables to your `.env.local` file

### 2. Configure Authentication
1. In your Supabase dashboard, go to Authentication > Settings
2. Configure your site URL (e.g., `http://localhost:3000` for development)
3. Add redirect URLs:
   - `http://localhost:3000/home` (for development)
   - `https://yourdomain.com/home` (for production)

### 3. Enable SSO Providers (Optional)
1. Go to Authentication > Providers
2. Enable Google OAuth:
   - Create a Google OAuth app at https://console.developers.google.com
   - Add your client ID and secret
   - Add authorized redirect URIs
3. Enable GitHub OAuth:
   - Create a GitHub OAuth app at https://github.com/settings/developers
   - Add your client ID and secret
   - Add authorized redirect URIs

### 4. Database Setup
1. Go to your Supabase dashboard > SQL Editor
2. **Option A (Recommended)**: Copy and paste the entire `supabase-schema.sql` file and run it
3. **Option B (Step by step)**: Use `supabase-schema-simple.sql` and run each step individually
4. **Approval System**: Run `supabase-approved-users.sql` to create the approval system
5. This will create:
   - `affiliate_profiles` - User profile information
   - `affiliate_referrers` - Referral codes
   - `referral_events` - Referral tracking
   - `dashboard_kpis` - Performance metrics
   - `affiliate_assets` - Marketing assets
   - `approved_users` - User approval system

**Note**: If you get permission errors, make sure you're running the SQL as the database owner or with appropriate permissions.

### 5. Initial Setup - Create First Admin

**Option A: Using the Setup Page (Recommended)**
1. Go to `http://localhost:3000/setup` in your browser
2. Fill in the admin details (name, email, password)
3. Click "Create First Admin"
4. The system will automatically create and approve the admin user
5. You can now sign in with your admin credentials

**Option B: Manual Database Setup**
1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add User" and create your admin user
3. Run the `setup-first-admin.sql` script in your Supabase SQL Editor
4. Replace `'your-admin-email@example.com'` with your actual email
5. Sign in with your admin credentials

### 6. Admin Access
1. **Admin Panel**: Go to `/admin` in the dashboard to manage users
2. **User Management**: Use the admin panel to approve users and create new affiliates
3. **Email Integration**: Create users with temporary passwords and send emails

## Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Get your project URL and anon key from the project settings
3. Add the environment variables to your `.env.local` file

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Features

- **Authentication**: Google SSO authentication with Supabase
- **User Approval System**: Only approved users can access the dashboard
- **Admin Panel**: Manage user approvals and system settings
- **Layout**: Responsive layout with navigation and user menu
- **Pages**: Home, Referrals, Assets, Reports, Settings, and Admin
- **Auth Guard**: Automatic authentication and approval checking
- **Theme**: Dark/light theme support with HeroUI components

## Project Structure

- `app/` - Next.js app router pages
- `components/` - Reusable React components
- `lib/` - Utility functions and Supabase client
- `utils/supabase/` - Supabase SSR utilities
- `types/` - TypeScript type definitions 
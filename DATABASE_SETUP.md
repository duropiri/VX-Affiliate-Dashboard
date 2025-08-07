# Database Setup Guide

## Quick Fix for Profile Update Issue

The profile update issue is likely caused by missing database tables or incorrect table structure. Follow these steps to fix it:

### 1. Run the Database Schema

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the entire contents of `supabase-schema.sql` into the editor
4. Click "Run" to execute the script

This will create all necessary tables with the correct structure and permissions.

### 2. Verify the Setup

After running the schema, you can verify the setup by:

1. Going to your application settings page
2. Clicking the "Diagnose Profile Issue" button
3. Checking the browser console for detailed diagnostic information

### 3. Test the Profile Update

Once the database is set up correctly:

1. Go to the Settings page
2. Try updating your profile information
3. The update should now work without errors

## Database Tables Created

The schema creates the following tables:

- `affiliate_profiles` - User profile information
- `affiliate_referrers` - Referral codes
- `approved_users` - User approval system
- `dashboard_kpis` - Performance metrics
- `affiliate_assets` - Marketing assets
- `referral_events` - Referral tracking

## Row Level Security (RLS)

The schema includes Row Level Security policies that ensure:

- Users can only access their own data
- Proper authentication is required
- Data is protected at the database level

## Troubleshooting

If you still encounter issues after running the schema:

1. Check the browser console for detailed error messages
2. Use the "Diagnose Profile Issue" button to get detailed diagnostics
3. Verify that your Supabase environment variables are correctly set
4. Ensure your user is properly authenticated

## Environment Variables

Make sure your `.env.local` file contains:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Support

If you continue to have issues, please:

1. Check the browser console for error messages
2. Run the diagnostic function
3. Share the error details for further assistance 
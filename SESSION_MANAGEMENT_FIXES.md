# Session Management Fixes

## Problem: "Minutes-long" Token Expiry

The application was experiencing token expiry after just a few minutes, causing database queries to fail and users to be logged out unexpectedly.

## Root Causes Identified

1. **Session not persisting/refreshing** - Losing refresh_token or never calling refresh API
2. **Multiple Supabase clients** - Re-initializing createClient in several places
3. **Browser throttling** - Background timers being throttled when tab is inactive
4. **No manual refresh triggers** - No fallback when auto-refresh fails

## Solutions Implemented

### 1. **Unified Supabase Client Configuration**

**File**: `lib/supabase.ts`

```typescript
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      // Required for SSR client
      get(name: string) { /* ... */ },
      set(name: string, value: string, options: any) { /* ... */ },
      remove(name: string, options: any) { /* ... */ },
    },
    auth: {
      // Store session in localStorage to persist across reloads
      persistSession: true,
      // Silently refresh access_token every 10 minutes
      autoRefreshToken: true,
      // Disable URL detection since we handle callbacks manually
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'vx-affiliate-portal'
      }
    }
  }
);
```

**Key Features**:
- `persistSession: true` - Ensures tokens survive page reloads
- `autoRefreshToken: true` - Automatic refresh every 10 minutes
- `detectSessionInUrl: false` - Prevents callback parsing issues

### 2. **Session Management Provider**

**File**: `app/providers.tsx`

```typescript
// Session management - refresh tokens on tab focus and periodically
useEffect(() => {
  // Refresh session when tab gains focus (browsers throttle background timers)
  const handleFocus = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    // ... handle session refresh
  };

  // Manual session refresh every 30 minutes as backup
  const handlePeriodicRefresh = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    // ... handle periodic refresh
  };

  // Set up event listeners
  window.addEventListener('focus', handleFocus);
  const interval = setInterval(handlePeriodicRefresh, 30 * 60 * 1000);

  return () => {
    window.removeEventListener('focus', handleFocus);
    clearInterval(interval);
  };
}, []);
```

**Key Features**:
- **Focus Event Handler** - Refreshes session when tab gains focus
- **Periodic Refresh** - Backup refresh every 30 minutes
- **Browser Throttling Protection** - Handles cases where background timers are throttled

### 3. **Session Debugging Utilities**

**File**: `lib/auth.ts`

```typescript
// Debug session tokens in localStorage
export const debugSession = () => {
  // Check localStorage for tokens
  const tokenKey = 'sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '').replace(/\.supabase\.co.*/, '') + '-auth-token';
  const storedToken = localStorage.getItem(tokenKey);
  
  // Log detailed session information
  console.log('🔍 Session Debug Info:');
  console.log('Access Token:', tokenData.access_token ? 'Present' : 'Missing');
  console.log('Refresh Token:', tokenData.refresh_token ? 'Present' : 'Missing');
  console.log('Expires In:', expiresIn > 0 ? `${expiresIn} seconds` : 'Expired');
  
  return {
    hasAccessToken: !!tokenData.access_token,
    hasRefreshToken: !!tokenData.refresh_token,
    expiresIn,
    isExpired: expiresIn <= 0
  };
};

// Force session refresh
export const forceSessionRefresh = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  // ... handle force refresh
};
```

### 4. **Settings Page Debug Tools**

**File**: `app/(dashboard)/settings/page.tsx`

Added three debugging buttons:
- **Debug Session** - Check token status in localStorage
- **Force Session Refresh** - Manually refresh the session
- **Diagnose Profile Issue** - Test database connectivity

## How to Verify the Fix

### 1. **Check Token Storage**

1. Open DevTools → Application → Local Storage
2. Look for key: `sb-[your-project-ref]-auth-token`
3. Verify both `access_token` and `refresh_token` are present
4. Check `expires_at` timestamp

### 2. **Use Debug Tools**

1. Go to Settings page
2. Click "Debug Session" to check token status
3. Click "Force Session Refresh" to manually refresh
4. Check console for detailed session information

### 3. **Monitor Console Logs**

Look for these log messages:
- `🔄 Tab focused - refreshing session...`
- `✅ Session refreshed successfully`
- `🔄 Periodic session refresh...`

### 4. **Test Long Sessions**

1. Sign in to the application
2. Leave the tab inactive for 30+ minutes
3. Return to the tab
4. Verify you're still logged in and can access data

## Expected Results

### ✅ **Before Fix**
- Tokens expire after ~5 minutes
- Users logged out unexpectedly
- Database queries fail with auth errors
- No session persistence across reloads

### ✅ **After Fix**
- Tokens persist for full 1-hour duration
- Automatic refresh every 10 minutes
- Manual refresh on tab focus
- Session survives page reloads
- Users stay logged in for extended periods

## Troubleshooting

### If tokens still expire quickly:

1. **Check localStorage**: Verify both tokens are present
2. **Use debug tools**: Run session debug in Settings
3. **Check console**: Look for refresh error messages
4. **Verify RLS policies**: Ensure authenticated users can access tables

### If auto-refresh isn't working:

1. **Check browser settings**: Ensure background tabs aren't suspended
2. **Use manual refresh**: Click "Force Session Refresh" in Settings
3. **Monitor focus events**: Check if tab focus triggers refresh

## Technical Details

### Token Lifecycle
- **Access Token**: 1 hour duration
- **Refresh Token**: 1 week duration
- **Auto-refresh**: Every 10 minutes
- **Manual refresh**: On tab focus + every 30 minutes

### Storage Location
- **LocalStorage Key**: `sb-[project-ref]-auth-token`
- **Contains**: access_token, refresh_token, expires_at, token_type

### Refresh Triggers
1. **Automatic**: Every 10 minutes (Supabase client)
2. **Tab Focus**: When window regains focus
3. **Periodic**: Every 30 minutes (backup)
4. **Manual**: Via Settings page button

This comprehensive fix should resolve the "minutes-long" token expiry issue and provide reliable, long-lasting sessions. 
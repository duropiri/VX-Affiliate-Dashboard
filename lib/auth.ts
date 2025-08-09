import { supabase, optimizedQuery, withAbort, connectionManager } from './supabase';
import { User } from '@supabase/supabase-js';
import { getSession } from 'next-auth/react';
// import { signIn, signOut } from "next-auth/react";

// Debug flag for verbose logging
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// Debug logging helper
const debugLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(message, ...args);
  }
};

// Keep timezone in one place
const TIMEZONE = 'America/Edmonton';

// Email normalization helper
const normalizedEmail = (email: string | null | undefined): string => {
  return (email ?? '').toLowerCase();
};

// SSR-safe base URL
const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
};

// removed: signInWithMagicLink (NextAuth handles email sign-in)

// removed: signInWithGoogle (NextAuth handles OAuth)

// REMOVED: User credential storage functions
// These were removed for security reasons - storing passwords in localStorage is a security risk.
// Supabase's persistSession and refresh tokens handle session persistence securely.

// Enhanced sign in with email
// removed: signInWithEmail (NextAuth credentials handles this)

// removed: signUpWithEmail (admin flow handled via API)

export const createUserWithPassword = async (email: string, password: string, userData: any) => {
  try {
    // Use server-side API endpoint for secure user creation
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        userData,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create user');
    }

    return result;
  } catch (error) {
    console.error('Error creating user with password:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

export const resetPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getBaseUrl()}/auth/reset-password`,
    });
    
    if (error) {
      throw error; // Throw to trigger retry/timeout logic
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

export const signOut = async () => {
  try {
    debugLog('🔄 Signing out user...');
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out from Supabase:', error);
      throw error; // Throw to trigger retry/timeout logic
    }
    
    debugLog('✅ User signed out successfully');
  } catch (error) {
    console.error('Error in signOut:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

export const getUser = async (): Promise<User | null> => {
  try {
    // Prefer NextAuth session as the source of truth
    const session = await getSession();
    const nextAuthUserId = (session?.user as any)?.id as string | undefined;
    if (nextAuthUserId) {
      return {
        id: nextAuthUserId,
        email: (session?.user as any)?.email || null,
      } as unknown as User;
    }
    // Fallback to Supabase browser session (legacy)
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// REMOVED: waitForSupabaseReady function
// This function was removed as it was causing excessive console logging
// and is not needed for normal operation - Supabase client is ready immediately

// Faster isUserApproved with abortable query and no nested retries
export const isUserApproved = async (userId: string): Promise<boolean> => {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), 8000);
  try {
    debugLog(`Checking isUserApproved for user ID: ${userId}`);
    const { data, error } = await supabase
      .from('approved_users')
      .select('user_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .abortSignal(controller.signal);
    if (error) throw error;
    const result = !!(Array.isArray(data) && data.length > 0);
    debugLog('isUserApproved final result:', result);
    return result;
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Approval check timed out (8s). Try again.');
    }
    throw e;
  } finally {
    clearTimeout(timerId);
  }
};

// Check if an email is approved (for cross-referencing)
export const isEmailApproved = async (email: string): Promise<boolean> => {
  try {
    const normalized = normalizedEmail(email);
    debugLog('Checking isEmailApproved for email:', normalized);
    
    const { data, error } = await supabase
      .from('approved_users')
      .select('user_email')
      .eq('user_email', normalized)
      .eq('status', 'active')
      .maybeSingle();

    debugLog('isEmailApproved result:', { data, error });
    
    if (error) {
      console.error('Error checking email approval:', error);
      throw error; // Throw to trigger retry/timeout logic
    }
    
    return !!data; // false when no row found
  } catch (error) {
    console.error('Error checking email approval:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

// Debug function to check what's in the approved_users table
export const debugApprovedUsers = async () => {
  try {
    debugLog('Debugging approved_users table...');
    
    // Add timeout to prevent hanging
    const { data, error } = await withAbort(
      supabase
        .from('approved_users')
        .select('*'),
      5000
    ) as any;

    debugLog('All approved_users:', { data, error });
    return data;
  } catch (error) {
    console.error('Error debugging approved_users:', error);
    return null;
  }
};

// Handle post-authentication flow for all auth methods
export const handlePostAuth = async (user: User) => {
  try {
    debugLog('Handling post-auth for user:', user.email);
    debugLog('User ID:', user.id);
    
    // First check if user is approved by user ID
    let isApproved = await isUserApproved(user.id);
    debugLog('Initial approval check result:', isApproved);
    
    if (!isApproved) {
      // Check if user is approved by email (cross-reference for OAuth)
      debugLog('User not approved by ID, checking by email:', user.email);
      
      const normalized = normalizedEmail(user.email);
      const { data: approvedUser, error: approvalError } = await supabase
        .from('approved_users')
        .select('*')
        .eq('user_email', normalized)
        .eq('status', 'active')
        .maybeSingle();

      debugLog('Email approval check result:', { approvedUser, approvalError });

      if (approvalError) throw approvalError;
      if (!approvedUser) return false;

      if (approvedUser) {
        debugLog('User approved by email cross-reference, updating user_id');
        
        // Update the approval record with the new user ID
        const { error: updateError } = await supabase
          .from('approved_users')
          .update({
            user_id: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('user_email', normalized)
          .eq('status', 'active');

        if (updateError) {
          console.error('Error updating approval record:', updateError);
          // Even if update fails, user is still approved
          isApproved = true;
        } else {
          debugLog('Successfully updated approval record with new user ID');
          isApproved = true;
        }
      }
    }

    debugLog('handlePostAuth final result:', isApproved);
    return isApproved;
  } catch (error) {
    console.error('Error in post-auth handling:', error);
    return false;
  }
};

// Approve a user (admin function)
export const approveUser = async (userEmail: string, approvedByUserId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('approve_user', { 
        user_email: normalizedEmail(userEmail), 
        approved_by_user_id: approvedByUserId 
      });

    if (error) {
      console.error('Error approving user:', error);
      throw error; // Throw to trigger retry/timeout logic
    }

    return data || false;
  } catch (error) {
    console.error('Error approving user:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

// Admin check function
export const isUserAdmin = (user: User | null): boolean => {
  if (!user || !user.email) {
    return false;
  }
  
  return normalizedEmail(user.email).endsWith('@virtualxposure.com');
};

// User profile management
export interface UserProfile {
  id: string;
  user_id: string;
  user_aryeo_id: string;
  user_email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  social_links?: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
  };
  notifications: {
    email_reports: boolean;
    sms_alerts: boolean;
    push_notifications: boolean;
  };
  created_at: string;
  updated_at: string;
}

export const createUserProfile = async (user: User) => {
  try {
    const { error } = await supabase
      .from('affiliate_profiles')
      .insert({
        user_id: user.id,
        user_aryeo_id: user.id, // Using user.id as aryeo_id for now
        user_email: normalizedEmail(user.email),
        first_name: user.user_metadata?.full_name?.split(' ')[0] || 'User',
        last_name: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 'Name',
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        social_links: {},
        notifications: {
          email_reports: true,
          sms_alerts: false,
          push_notifications: true,
        },
      });

    if (error) {
      console.error('Error creating user profile:', error);
      throw error; // Throw to trigger retry/timeout logic
    }
  } catch (error) {
    console.error('Failed to create user profile:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('affiliate_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      throw error; // Throw to trigger retry/timeout logic
    }

    return data; // null when not found
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
  const { error } = await supabase
    .from('affiliate_profiles')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating user profile:', error);
    throw error; // Throw to trigger retry/timeout logic
  }
};

// Referral code management
export const createReferralCode = async (userId: string) => {
  try {
    const code = generateReferralCode();
    
    const { error } = await supabase
      .from('affiliate_referrers')
      .insert({
        user_id: userId,
        code,
      });

    if (error) {
      console.error('Error creating referral code:', error);
      throw error; // Throw to trigger retry/timeout logic
    }

    return code;
  } catch (error) {
    console.error('Failed to create referral code:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

export const getReferralCode = async (userId: string): Promise<string | null> => {
  try {
    debugLog('🔄 Fetching referral code for user:', userId);
    
    // Use optimized query helper with caching
    const queryResult = await optimizedQuery(async () => {
      const { data, error } = await supabase
        .from('affiliate_referrers')
        .select('code')
        .eq('user_id', userId)
        .single();
      
      // Throw on any Supabase error to trigger retry/timeout logic
      if (error) throw error;
      return data;
    }, 30000, { // 30 second timeout for better reliability
      useCache: true,
      cacheKey: `referral_code_${userId}`,
      cacheTTL: 600000 // 10 minutes cache for referral codes
    });

    // queryResult is now the data directly, or null if no rows found
    const code = queryResult?.code || null;
    debugLog('✅ Referral code loaded:', code);
    return code;
  } catch (error) {
    console.error('Error fetching referral code:', error);
    throw error; // Don't return null, throw the error
  }
};

const generateReferralCode = (): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
};

// Update the current user's referral code (token)
export const updateReferralCodeForCurrentUser = async (
  desiredCode: string
): Promise<{ success: boolean; code?: string; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'No authenticated user' };

    const normalized = (desiredCode || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    if (normalized.length < 3 || normalized.length > 32) {
      return { success: false, error: 'Token must be 3-32 chars (a-z, 0-9, _ or -)' };
    }

    // Optional pre-check for a clearer “taken” message
    const { data: takenBy, error: checkErr } = await withAbort(
      supabase
        .from('affiliate_referrers')
        .select('user_id')
        .eq('code', normalized)
        .maybeSingle(),
      8000
    ) as any;
    if (checkErr) return { success: false, error: checkErr.message };
    if (takenBy && takenBy.user_id !== user.id) {
      return { success: false, error: 'That token is already taken' };
    }

    // Upsert on user_id unique constraint; tolerate 0 rows returned under RLS using maybeSingle
    const { data, error } = await withAbort(
      supabase
        .from('affiliate_referrers')
        .upsert({ user_id: user.id, code: normalized }, { onConflict: 'user_id' })
        .select('code')
        .maybeSingle(),
      8000
    ) as any;

    if (error) {
      // Unique violation from PostgREST/PG
      if (error.code === '23505') {
        return { success: false, error: 'That token is already taken' };
      }
      return { success: false, error: error.message || 'Failed to update token' };
    }

    if (!data) {
      return { success: false, error: 'No row returned (RLS?)' };
    }

    // Update referral code cache to reflect new value immediately
    try {
      const cacheKey = `referral_code_${user.id}`;
      connectionManager.setCache(cacheKey, { code: data?.code }, 600000);
    } catch {}

    return { success: true, code: data?.code };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { success: false, error: 'Update timed out. Try again.' };
    }
    return { success: false, error: e?.message || 'Unknown error' };
  }
};

// Asset management functions
export interface Asset {
  id: string;
  title: string;
  url: string;
  thumb?: string;
  description?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export const getAssets = async (): Promise<Asset[] | null> => {
  try {
    const { data, error } = await supabase
      .from('affiliate_assets')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching assets:', error);
      throw error; // Throw to trigger retry/timeout logic
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching assets:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

export const createAsset = async (assetData: Omit<Asset, 'id' | 'created_at' | 'updated_at'>): Promise<Asset | null> => {
  try {
    const { data, error } = await supabase
      .from('affiliate_assets')
      .insert([assetData])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating asset:', error);
      throw error; // Throw to trigger retry/timeout logic
    }
    
    return data;
  } catch (error) {
    console.error('Error creating asset:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

export const updateAsset = async (id: string, assetData: Partial<Asset>): Promise<Asset | null> => {
  try {
    const { data, error } = await supabase
      .from('affiliate_assets')
      .update({ ...assetData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating asset:', error);
      throw error; // Throw to trigger retry/timeout logic
    }
    
    return data;
  } catch (error) {
    console.error('Error updating asset:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

export const deleteAsset = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('affiliate_assets')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting asset:', error);
      throw error; // Throw to trigger retry/timeout logic
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting asset:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

// Report management functions
export interface DailyData {
  date: string;
  earnings: number;
  newCustomers: number;
  newReferrals: number;
  clicksCount: number;
}

export interface UserReports {
  overview: {
    earnings: number;
    clicks: number;
    signups: number;
    customers: number;
  };
  dailyData: DailyData[];
  charts?: {
    lineChart: Array<{
      id: string;
      title: string;
      value: number;
      change: number;
      period: string;
      category: string;
      changeType: string;
    }>;
    barChart: Array<{
      id: string;
      title: string;
      value: number;
      change: number;
      period: string;
      category: string;
      changeType: string;
    }>;
    pieChart: Array<{
      id: string;
      title: string;
      value: number;
      change: number;
      period: string;
      category: string;
      changeType: string;
    }>;
  };
}

// Enhanced user reports retrieval without fallback data
export const getUserReports = async (
  timeframe: string = "Last 30 Days",
  opts: { force?: boolean } = {}
): Promise<UserReports | null> => {
  try {
    const session = await getSession();
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      console.error('No authenticated user found');
      return null;
    }

    debugLog('🔄 Fetching user reports for:', userId);
    
    // Get the user_reports from dashboard_kpis with optimized query helper and caching
    const queryResult = await optimizedQuery(async () => {
      const { data, error } = await supabase
        .from('dashboard_kpis')
        .select('user_reports')
        .eq('user_id', userId)
        .single();
      
      // Throw on any Supabase error to trigger retry/timeout logic
      if (error) throw error;
      return data;
    }, 30000, {
      useCache: !opts.force,
      cacheKey: `user_reports_${userId}_${timeframe}`,
      cacheTTL: 300000 // 5 minutes cache for user reports
    });
    
    if (queryResult && queryResult.user_reports) {
      debugLog('✅ User reports loaded:', queryResult.user_reports);
      
      // Transform the new structure to the expected format
      const transformedReports = transformUserReports(queryResult.user_reports, timeframe);
      return transformedReports;
    } else {
      debugLog('⚠️ No user reports found in database');
      throw new Error('No user reports found in database');
    }
  } catch (error) {
    console.error('Error fetching user reports:', error);
    throw error; // Don't return fallback data, throw the error
  }
};

// Transform the new user_reports structure to the expected format
export const transformUserReports = (userReports: any, selectedTimeframe: string = "Last 30 Days"): UserReports => {
  try {
    debugLog('🔄 Transforming user reports structure...');
    
    const overview = userReports.overview || {};
    const dailyData: DailyData[] = [];
    
    // Calculate total overview metrics
    let totalEarnings = 0;
    let totalClicks = 0;
    let totalSignups = 0;
    let totalCustomers = 0;
    
    // Get the date range based on timeframe using MDT timezone
    const today = new Date();
    // Convert to MDT timezone
    let mdtToday = new Date(today.toLocaleString("en-US", {timeZone: TIMEZONE}));
    mdtToday.setHours(23, 59, 59, 999);
    
    let startDate = new Date();
    // Convert to MDT timezone
    let mdtStartDate = new Date(startDate.toLocaleString("en-US", {timeZone: TIMEZONE}));
    mdtStartDate.setHours(0, 0, 0, 0);
    
    // Calculate the date range based on selected timeframe
    switch (selectedTimeframe) {
      case "Today":
        mdtStartDate.setTime(mdtToday.getTime());
        mdtStartDate.setHours(0, 0, 0, 0);
        break;
      case "Yesterday":
        mdtStartDate.setTime(mdtToday.getTime());
        mdtStartDate.setDate(mdtToday.getDate() - 1);
        mdtStartDate.setHours(0, 0, 0, 0);
        const endDate = new Date(mdtStartDate);
        endDate.setHours(23, 59, 59, 999);
        mdtToday.setTime(endDate.getTime());
        break;
      case "Last 30 Days":
        mdtStartDate.setDate(mdtToday.getDate() - 30);
        mdtStartDate.setHours(0, 0, 0, 0);
        break;
      case "This Month":
        mdtStartDate = new Date(mdtToday.getFullYear(), mdtToday.getMonth(), 1);
        mdtStartDate.setHours(0, 0, 0, 0);
        break;
      case "Last Month":
        mdtStartDate = new Date(mdtToday.getFullYear(), mdtToday.getMonth() - 1, 1);
        mdtStartDate.setHours(0, 0, 0, 0);
        const lastMonthEnd = new Date(mdtToday.getFullYear(), mdtToday.getMonth(), 0);
        lastMonthEnd.setHours(23, 59, 59, 999);
        mdtToday.setTime(lastMonthEnd.getTime());
        break;
      case "Last 6 Months":
        mdtStartDate.setMonth(mdtToday.getMonth() - 6);
        mdtStartDate.setHours(0, 0, 0, 0);
        break;
      case "This Year": {
        const year = new Date().toLocaleString("en-US", { timeZone: TIMEZONE, year: "numeric" });
        const yearNum = Number(year);
        // Explicitly anchor both bounds to MDT year to avoid cross-TZ drift
        mdtStartDate = new Date(`${yearNum}-01-01T00:00:00`);
        mdtToday = new Date(`${yearNum}-12-31T23:59:59`);
        break;
      }
      case "All Time":
        // For "All Time", we'll use a reasonable default (last 2 years)
        mdtStartDate.setFullYear(mdtToday.getFullYear() - 2);
        mdtStartDate.setHours(0, 0, 0, 0);
        break;
      default:
        mdtStartDate.setDate(mdtToday.getDate() - 30);
        mdtStartDate.setHours(0, 0, 0, 0);
    }
    
    // Generate all dates in the range using MDT timezone
    const allDates: string[] = [];
    let currentDate = new Date(mdtStartDate);
    
    while (currentDate <= mdtToday) {
      // Format date in MDT timezone consistently
      const dateKey = currentDate.toLocaleDateString("en-CA", {timeZone: TIMEZONE}); // YYYY-MM-DD format
      allDates.push(dateKey);
      
      // Create next date in MDT timezone to avoid timezone issues
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      currentDate = nextDate;
    }
    
    // For "All Time", check if we have data beyond the last year
    if (selectedTimeframe === "All Time") {
      const lastYearStart = new Date(mdtToday.getFullYear() - 1, 0, 1);
      
      // Check if we have any data from before last year
      const hasDataBeforeLastYear = Object.keys(overview).some(dateKey => {
        const d = new Date(`${dateKey}T00:00:00`);
        return d < lastYearStart;
      });
      
      // If no data before last year, fallback to "This Year" timeframe
      if (!hasDataBeforeLastYear) {
        debugLog('📊 All Time: No data before last year, falling back to This Year timeframe');
        mdtStartDate = new Date(mdtToday.getFullYear(), 0, 1);
        mdtStartDate.setHours(0, 0, 0, 0);
        
        // Regenerate date range for "This Year"
        allDates.length = 0; // Clear existing dates
        let currentDateThisYear = new Date(mdtStartDate);
        while (currentDateThisYear <= mdtToday) {
          const dateKey = currentDateThisYear.toLocaleDateString("en-CA", {timeZone: TIMEZONE});
          allDates.push(dateKey);
          
          // Create next date in MDT timezone to avoid timezone issues
          const nextDate = new Date(currentDateThisYear);
          nextDate.setDate(nextDate.getDate() + 1);
          currentDateThisYear = nextDate;
        }
      }
    }
    
    // Process each date in the range
    allDates.forEach((dateKey) => {
      const dayData = overview[dateKey];
      
      const dailyItem: DailyData = {
        date: dateKey,
        earnings: dayData?.earnings || 0,
        newCustomers: dayData?.customers || 0,
        newReferrals: dayData?.signups || 0,
        clicksCount: dayData?.clicks || 0,
      };
      
      dailyData.push(dailyItem);
      
      // Accumulate totals
      totalEarnings += dailyItem.earnings;
      totalClicks += dailyItem.clicksCount;
      totalSignups += dailyItem.newReferrals;
      totalCustomers += dailyItem.newCustomers;
    });
    
    // Sort daily data by date
    dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Aggregate by month if needed
    let finalData = dailyData;
    if (shouldAggregateByMonth(selectedTimeframe)) {
      finalData = aggregateDataByMonth(dailyData);
      debugLog('📊 Aggregated data by month for timeframe:', selectedTimeframe);
    }
    
    const transformedReports: UserReports = {
      overview: {
        earnings: totalEarnings,
        clicks: totalClicks,
        signups: totalSignups,
        customers: totalCustomers,
      },
      dailyData: finalData,
    };
    
    debugLog('✅ Transformed reports:', transformedReports);
    return transformedReports;
  } catch (error) {
    console.error('Error transforming user reports:', error);
    return getDefaultUserReports();
  }
};

export const updateUserReports = async (reports: UserReports): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found');
      throw new Error('No authenticated user found');
    }

    debugLog('🔄 Updating user reports for:', user.id);
    
    const { error } = await supabase
      .from('dashboard_kpis')
      .update({ user_reports: reports })
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error updating user reports:', error);
      throw error; // Throw to trigger retry/timeout logic
    }
    
    debugLog('✅ User reports updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating user reports:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

// Update specific day data in user_reports
export const updateUserDayData = async (
  date: string, // YYYY-MM-DD format in MDT timezone
  data: { clicks?: number; signups?: number; earnings?: number; customers?: number }
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found');
      throw new Error('No authenticated user found');
    }

    debugLog(`🔄 Updating data for ${date} for user:`, user.id);
    
    // Get current user_reports
    const { data: kpiData, error: kpiError } = await supabase
      .from('dashboard_kpis')
      .select('user_reports')
      .eq('user_id', user.id)
      .single();
    
    if (kpiError) {
      console.error('Error fetching current user reports:', kpiError);
      throw kpiError; // Throw to trigger retry/timeout logic
    }
    
    let userReports = kpiData?.user_reports || {
      links: {},
      sub_ids: {},
      overview: {},
      traffic_sources: {}
    };
    
    // Ensure overview exists
    if (!userReports.overview) {
      userReports.overview = {};
    }
    
    // Update the specific date's data (date should already be in MDT timezone format)
    if (!userReports.overview[date]) {
      userReports.overview[date] = {
        clicks: 0,
        signups: 0,
        earnings: 0,
        customers: 0
      };
    }
    
    // Merge the new data
    userReports.overview[date] = {
      ...userReports.overview[date],
      ...data
    };
    
    // Update the database
    const { error: updateError } = await supabase
      .from('dashboard_kpis')
      .update({ 
        user_reports: userReports,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);
    
    if (updateError) {
      console.error('Error updating day data:', updateError);
      throw updateError; // Throw to trigger retry/timeout logic
    }
    
    debugLog(`✅ Data for ${date} updated successfully`);
    return true;
  } catch (error) {
    console.error('Error updating day data:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

// Trigger daily user reports update (admin function)
export const triggerDailyReportsUpdate = async (): Promise<boolean> => {
  try {
    debugLog('🔄 Triggering daily reports update...');
    
    const response = await fetch('/api/admin/update-user-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error triggering daily reports update:', result.error);
      throw new Error(result.error || 'Failed to trigger daily reports update');
    }

    debugLog('✅ Daily reports update triggered successfully');
    return true;
  } catch (error) {
    console.error('Error triggering daily reports update:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

const getDefaultUserReports = (): UserReports => {
  // Generate 30 days of sample data
  const dailyData: DailyData[] = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    dailyData.push({
      date: date.toISOString().split('T')[0],
      earnings: 0,
      newCustomers: 0,
      newReferrals: 0,
      clicksCount: 0
    });
  }

  return {
    overview: {
      earnings: 0,
      clicks: 1, // Based on the image showing 1 click
      signups: 0,
      customers: 0,
    },
    dailyData
  };
};

// Utility function to format dates in MDT timezone
export const formatDateMDT = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-CA", {timeZone: TIMEZONE}); // YYYY-MM-DD format
};

// Utility function to format dates for display in MDT timezone
export const formatDateDisplayMDT = (date: Date | string): string => {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // If it's a date string in YYYY-MM-DD format, treat it as MDT date
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Create date in MDT timezone by appending time and timezone
      dateObj = new Date(`${date}T00:00:00`); // Let toLocaleDateString handle timezone
    } else {
      dateObj = new Date(date);
    }
  } else {
    dateObj = date;
  }
  
  return dateObj.toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Utility function to get current date in MDT timezone
export const getCurrentDateMDT = (): Date => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", {timeZone: TIMEZONE}));
};

// Utility function to check if timeframe should be aggregated by month
export const shouldAggregateByMonth = (timeframe: string): boolean => {
  return ["Last 6 Months", "This Year", "All Time"].includes(timeframe);
};

// Utility function to aggregate daily data by month
export const aggregateDataByMonth = (dailyData: DailyData[]): DailyData[] => {
  const monthlyData = new Map<string, DailyData>();
  
  dailyData.forEach(item => {
    // Parse the date string (YYYY-MM-DD format)
    const [year, month] = item.date.split('-');
    const monthKey = `${year}-${month}`;
    
    if (monthlyData.has(monthKey)) {
      const existing = monthlyData.get(monthKey)!;
      existing.earnings += item.earnings;
      existing.newCustomers += item.newCustomers;
      existing.newReferrals += item.newReferrals;
      existing.clicksCount += item.clicksCount;
    } else {
      monthlyData.set(monthKey, {
        date: `${monthKey}-01`, // Use first day of month for display
        earnings: item.earnings,
        newCustomers: item.newCustomers,
        newReferrals: item.newReferrals,
        clicksCount: item.clicksCount,
      });
    }
  });
  
  return Array.from(monthlyData.values()).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

// Enhanced calculate totals without fallback
export const calculateUserReportsTotals = async (
  opts: { force?: boolean } = {}
): Promise<{
  clicks: number;
  referrals: number;
  customers: number;
  earnings: number;
}> => {
  try {
    const session = await getSession();
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      console.error('No authenticated user found');
      throw new Error('No authenticated user found');
    }

    debugLog('🔄 Calculating totals from user_reports for:', userId);
    
    // Get the user_reports from dashboard_kpis with optimized query helper and caching
    const queryResult = await optimizedQuery(async () => {
      const { data, error } = await supabase
        .from('dashboard_kpis')
        .select('user_reports')
        .eq('user_id', userId)
        .single();
      
      // Throw on any Supabase error to trigger retry/timeout logic
      if (error) throw error;
      return data;
    }, 30000, {
      useCache: !opts.force,
      cacheKey: `user_reports_totals_${userId}`,
      cacheTTL: 300000 // 5 minutes cache for user reports totals
    });
    
    if (!queryResult || !queryResult.user_reports || !queryResult.user_reports.overview) {
      debugLog('No user_reports data found in database');
      throw new Error('No user reports data found in database');
    }
    
    const overview = queryResult.user_reports.overview;
    let totalClicks = 0;
    let totalReferrals = 0;
    let totalCustomers = 0;
    let totalEarnings = 0;
    
    // Calculate totals from all dates in user_reports
    Object.values(overview).forEach((dayData: any) => {
      totalClicks += dayData.clicks || 0;
      totalReferrals += dayData.signups || 0; // signups = referrals
      totalCustomers += dayData.customers || 0;
      totalEarnings += dayData.earnings || 0;
    });
    
    debugLog('✅ Calculated totals:', {
      clicks: totalClicks,
      referrals: totalReferrals,
      customers: totalCustomers,
      earnings: totalEarnings
    });
    
    return {
      clicks: totalClicks,
      referrals: totalReferrals,
      customers: totalCustomers,
      earnings: totalEarnings
    };
  } catch (error) {
    console.error('Error calculating user reports totals:', error);
    throw error; // Don't return fallback data, throw the error
  }
};

// Database health check function
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    debugLog('Testing database connection...');
    
    const { data, error } = await withAbort(
      supabase
        .from('approved_users')
        .select('user_id')
        .limit(1),
      3000
    ) as any;

    debugLog('Database health check result:', { data, error });
    
    if (error) {
      console.error('Database health check failed:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        fullError: error
      });
      return false;
    }
    
    debugLog('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database health check error:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Full error object:', error);
    return false;
  }
};

// Simple connection test to diagnose Supabase issues
export const testSupabaseConnection = async (): Promise<{success: boolean, error?: string}> => {
  try {
    debugLog('Testing basic Supabase connection...');
    
    // Test 1: Basic auth connection
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    debugLog('Auth connection test:', { user: !!user, error: authError });
    
    // Test 2: Simple database query
    const { data, error } = await supabase
      .from('approved_users')
      .select('user_id')
      .limit(1);
    
    debugLog('Database connection test:', { data, error });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Simple table test to isolate the issue
export const testSimpleTableQuery = async (): Promise<{success: boolean, error?: string}> => {
  try {
    debugLog('Testing simple table query...');
    
    // Try a simple query on any table
    const { data, error } = await supabase
      .from('affiliate_profiles')
      .select('id')
      .limit(1);
    
    debugLog('Simple table query result:', { data, error });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Simple table query failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Check Supabase configuration
export const checkSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  debugLog('Supabase configuration check:');
  debugLog('URL exists:', !!url);
  debugLog('URL starts with https:', url?.startsWith('https://'));
  debugLog('Anon key exists:', !!anonKey);
  debugLog('Anon key length:', anonKey?.length);
  
  return {
    urlExists: !!url,
    urlValid: url?.startsWith('https://'),
    anonKeyExists: !!anonKey,
    anonKeyLength: anonKey?.length
  };
};

// Simple test to check database connectivity
export const testSimpleQuery = async (): Promise<boolean> => {
  try {
    debugLog('Testing simple database query...');
    
    const { data, error } = await withAbort(
      supabase
        .from('approved_users')
        .select('user_id')
        .limit(1),
      2000
    ) as any;

    debugLog('Simple query result:', { data, error });
    
    if (error) {
      console.error('Simple query failed:', error);
      return false;
    }
    
    debugLog('Simple query successful');
    return true;
  } catch (error) {
    console.error('Simple query error:', error);
    return false;
  }
};

// Test the exact query that's failing
export const testExactQuery = async (userId: string): Promise<boolean> => {
  try {
    debugLog('Testing exact query for user ID:', userId);
    
    debugLog('Starting exact query...');
    const { data, error } = await withAbort(
      supabase
        .from('approved_users')
        .select('user_id, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single(),
      2000
    ) as any;
    
    debugLog('Exact query result:', { data, error });
    
    if (error) {
      console.error('Exact query error:', error);
      return false;
    }
    
    const result = !!data;
    debugLog('Exact query final result:', result);
    return result;
  } catch (error) {
    console.error('Exact query error:', error);
    return false;
  }
};

// Database diagnostic function for profile updates
export const diagnoseProfileUpdate = async (userId: string): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> => {
  try {
    debugLog('🔍 Starting profile update diagnosis for user:', userId);
    
    // Test 1: Basic database connection
    debugLog('🔍 Test 1: Basic database connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('affiliate_profiles')
      .select('id')
      .limit(1);
    
    if (connectionError) {
      console.error('❌ Database connection failed:', connectionError);
      return {
        success: false,
        error: 'Database connection failed',
        details: connectionError
      };
    }
    
    debugLog('✅ Database connection successful');
    
    // Test 2: Table structure
    debugLog('🔍 Test 2: Table structure...');
    const { data: structureTest, error: structureError } = await supabase
      .from('affiliate_profiles')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.error('❌ Table structure error:', structureError);
      return {
        success: false,
        error: 'Table structure error',
        details: structureError
      };
    }
    
    debugLog('✅ Table structure test successful');
    debugLog('📋 Available columns:', structureTest ? Object.keys(structureTest[0] || {}) : 'No data');
    
    // Test 3: User authentication
    debugLog('🔍 Test 3: User authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ User authentication failed:', authError);
      return {
        success: false,
        error: 'User authentication failed',
        details: authError
      };
    }
    
    debugLog('✅ User authentication successful:', user.email);
    
    // Test 4: Check if user profile exists
    debugLog('🔍 Test 4: Check existing profile...');
    const { data: existingProfile, error: profileError } = await supabase
      .from('affiliate_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Profile check error:', profileError);
      return {
        success: false,
        error: 'Profile check failed',
        details: profileError
      };
    }
    
    debugLog('✅ Profile check successful');
    debugLog('📋 Existing profile:', existingProfile ? 'Found' : 'Not found');
    
    // Test 5: Test insert operation
    debugLog('🔍 Test 5: Test insert operation...');
    const testProfileData = {
      user_id: userId,
      user_aryeo_id: userId,
      user_email: user.email || '',
      first_name: 'Test',
      last_name: 'User',
      avatar_url: '',
      social_links: {},
      notifications: {
        email_reports: true,
        sms_alerts: false,
        push_notifications: true,
      },
    };
    
    const { data: insertTest, error: insertError } = await supabase
      .from('affiliate_profiles')
      .insert(testProfileData)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Insert test failed:', insertError);
      return {
        success: false,
        error: 'Insert operation failed',
        details: insertError
      };
    }
    
    debugLog('✅ Insert test successful');
    
    // Clean up test data
    debugLog('🔍 Cleaning up test data...');
    const { error: cleanupError } = await supabase
      .from('affiliate_profiles')
      .delete()
      .eq('user_id', userId)
      .eq('first_name', 'Test');
    
    if (cleanupError) {
      console.warn('⚠️ Cleanup failed:', cleanupError);
    } else {
      debugLog('✅ Test data cleaned up');
    }
    
    return {
      success: true,
      details: {
        connectionTest,
        structureTest,
        user: user.email,
        existingProfile: !!existingProfile,
        insertTest
      }
    };
    
  } catch (error) {
    console.error('💥 Diagnosis failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    };
  }
};

// Check if required database tables exist
export const checkDatabaseTables = async (): Promise<{
  success: boolean;
  missingTables?: string[];
  error?: string;
}> => {
  try {
    debugLog('🔍 Checking if required database tables exist...');
    
    const requiredTables = [
      'affiliate_profiles',
      'affiliate_referrers', 
      'approved_users',
      'dashboard_kpis',
      'affiliate_assets',
      'referral_events'
    ];
    
    const missingTables: string[] = [];
    
    for (const tableName of requiredTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.error(`❌ Table ${tableName} check failed:`, error);
          missingTables.push(tableName);
        } else {
          debugLog(`✅ Table ${tableName} exists`);
        }
      } catch (error) {
        console.error(`❌ Error checking table ${tableName}:`, error);
        missingTables.push(tableName);
      }
    }
    
    if (missingTables.length > 0) {
      console.error('❌ Missing tables:', missingTables);
      return {
        success: false,
        missingTables,
        error: `Missing required tables: ${missingTables.join(', ')}`
      };
    }
    
    debugLog('✅ All required tables exist');
    return { success: true };
    
  } catch (error) {
    console.error('💥 Error checking database tables:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Session debugging utilities
export const debugSession = () => {
  try {
    if (typeof window === 'undefined') {
      return { hasAccessToken: false, hasRefreshToken: false, expiresIn: 0, isExpired: true };
    }
    // Check localStorage for tokens
    const tokenKey = 'sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '').replace(/\.supabase\.co.*/, '') + '-auth-token';
    const storedToken = localStorage.getItem(tokenKey);
    
    if (storedToken) {
      const tokenData = JSON.parse(storedToken);
      debugLog('🔍 Session Debug Info:');
      debugLog('Token Key:', tokenKey);
      debugLog('Access Token:', tokenData.access_token ? 'Present' : 'Missing');
      debugLog('Refresh Token:', tokenData.refresh_token ? 'Present' : 'Missing');
      debugLog('Expires At:', new Date(tokenData.expires_at * 1000).toLocaleString());
      debugLog('Token Type:', tokenData.token_type);
      
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = tokenData.expires_at - now;
      debugLog('Expires In:', expiresIn > 0 ? `${expiresIn} seconds` : 'Expired');
      
      return {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn,
        isExpired: expiresIn <= 0
      };
    } else {
      debugLog('❌ No session token found in localStorage');
      return {
        hasAccessToken: false,
        hasRefreshToken: false,
        expiresIn: 0,
        isExpired: true
      };
    }
  } catch (error) {
    console.error('Error debugging session:', error);
    return {
      hasAccessToken: false,
      hasRefreshToken: false,
      expiresIn: 0,
      isExpired: true
    };
  }
};

// Force session refresh
export const forceSessionRefresh = async () => {
  try {
    debugLog('🔄 Forcing session refresh...');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Force refresh error:', error);
      return false;
    }
    
    if (session) {
      debugLog('✅ Session refreshed successfully');
      debugSession(); // Log the updated session info
      return true;
    } else {
      debugLog('ℹ️ No active session to refresh');
      return false;
    }
  } catch (error) {
    console.error('Force refresh failed:', error);
    return false;
  }
};
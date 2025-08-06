import { supabase, optimizedQuery } from './supabase';
import { User } from '@supabase/supabase-js';

export const signInWithMagicLink = async (email: string) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/home`,
    },
  });
  
  if (error) {
    throw error;
  }
};

export const signInWithGoogle = async () => {
  // Use callback for local development, direct redirect for production
  const redirectTo = process.env.NODE_ENV === 'development' 
    ? `${window.location.origin}/auth/callback`
    : `${window.location.origin}/home`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw error;
};

export const signInWithGithub = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/home`,
    },
  });
  
  if (error) {
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    throw error;
  }

  // Check approval status
  const approved = await handlePostAuth(data.user);
  if (!approved) {
    await supabase.auth.signOut();
    throw new Error('Account not approved');
  }

  return data;
};

export const signUpWithEmail = async (
  email: string,
  password: string,
  userData: Record<string, any>
) => {
  // Call our admin endpoint
  const res = await fetch('/api/admin/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, userData }),
  });
  
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Sign-up failed');
  return json;
};

export const createUserWithPassword = async (email: string, password: string, userData: any) => {
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
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  
  if (error) {
    throw error;
  }
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};

export const getUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Wait for Supabase client to be ready
const waitForSupabaseReady = async (maxWait = 5000): Promise<boolean> => {
  console.log('Starting Supabase client readiness check...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    try {
      console.log('Testing Supabase client connection...');
      // Test a simple query to see if client is ready
      const { data, error } = await supabase
        .from('approved_users')
        .select('count')
        .limit(1);
      
      console.log('Readiness test result:', { data, error });
      
      if (!error) {
        console.log('Supabase client is ready');
        return true;
      } else {
        console.log('Supabase client not ready yet, error:', error);
      }
    } catch (error) {
      console.log('Supabase client readiness test failed:', error);
      // Client not ready yet
    }
    
    // Wait 100ms before next attempt
    console.log('Waiting 100ms before next readiness test...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.warn('Supabase client not ready after timeout');
  return false;
};

// Check if user is approved to access the affiliate portal
export const isUserApproved = async (userId: string): Promise<boolean> => {
  const maxRetries = 3;
  const baseDelay = 1000; // Increased to 1 second base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Checking isUserApproved for user ID: ${userId} (attempt ${attempt}/${maxRetries})`);
      
      // Simple delay to let OAuth flow complete
      if (attempt === 1) {
        console.log('Waiting 2 seconds for OAuth flow to complete...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Use optimized query helper for production
      const queryResult = await optimizedQuery(async () => {
        return supabase
          .from('approved_users')
          .select('user_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1);
      }, 10000); // 10 second timeout
      
      console.log('isUserApproved query result:', queryResult);

      if (queryResult.error) {
        if (queryResult.error.code === 'PGRST116') {
          // No rows found - user not approved
          console.log('User not found in approved_users table');
          return false;
        } else {
          console.error('Error checking user approval:', queryResult.error);
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          return false;
        }
      }

      const result = !!(queryResult.data && queryResult.data.length > 0);
      console.log('isUserApproved final result:', result);
      return result;
    } catch (error) {
      console.error(`Error checking user approval (attempt ${attempt}):`, error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      return false;
    }
  }
  
  return false;
};

// Check if an email is approved (for cross-referencing)
export const isEmailApproved = async (email: string): Promise<boolean> => {
  try {
    console.log('Checking isEmailApproved for email:', email);
    const { data, error } = await supabase
      .from('approved_users')
      .select('user_email')
      .eq('user_email', email)
      .eq('status', 'active')
      .single();

    console.log('isEmailApproved result:', { data, error });

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking email approval:', error);
      return false;
    }

    const result = !!data;
    console.log('isEmailApproved final result:', result);
    return result;
  } catch (error) {
    console.error('Error checking email approval:', error);
    return false;
  }
};

// Debug function to check what's in the approved_users table
export const debugApprovedUsers = async () => {
  try {
    console.log('Debugging approved_users table...');
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Debug query timeout')), 5000);
    });
    
    const queryPromise = supabase
      .from('approved_users')
      .select('*');

    const { data, error } = await Promise.race([
      queryPromise,
      timeoutPromise
    ]) as any;

    console.log('All approved_users:', { data, error });
    return data;
  } catch (error) {
    console.error('Error debugging approved_users:', error);
    return null;
  }
};

// Handle post-authentication flow for all auth methods
export const handlePostAuth = async (user: User) => {
  try {
    console.log('Handling post-auth for user:', user.email);
    console.log('User ID:', user.id);
    console.log('User metadata:', user.user_metadata);
    
    // First check if user is approved by user ID
    let isApproved = await isUserApproved(user.id);
    console.log('Initial approval check result:', isApproved);
    
    if (!isApproved) {
      // Check if user is approved by email (cross-reference for OAuth)
      console.log('User not approved by ID, checking by email:', user.email);
      
      const { data: approvedUser, error: approvalError } = await supabase
        .from('approved_users')
        .select('*')
        .eq('user_email', user.email)
        .eq('status', 'active')
        .single();

      console.log('Email approval check result:', { approvedUser, approvalError });

      if (approvalError) {
        if (approvalError.code === 'PGRST116') {
          // No approved user found with this email
          console.log('No approved user found with this email');
          return false;
        } else {
          console.error('Error checking approval by email:', approvalError);
          return false;
        }
      }

      if (approvedUser) {
        console.log('User approved by email cross-reference, updating user_id');
        
        // Update the approval record with the new user ID
        const { error: updateError } = await supabase
          .from('approved_users')
          .update({
            user_id: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('user_email', user.email);

        if (updateError) {
          console.error('Error updating approval record:', updateError);
          // Even if update fails, user is still approved
          isApproved = true;
        } else {
          console.log('Successfully updated approval record with new user ID');
          isApproved = true;
        }
      }
    }

    console.log('handlePostAuth final result:', isApproved);
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
        user_email: userEmail, 
        approved_by_user_id: approvedByUserId 
      });

    if (error) {
      console.error('Error approving user:', error);
      return false;
    }

    return data || false;
  } catch (error) {
    console.error('Error approving user:', error);
    return false;
  }
};

// Admin check function
export const isUserAdmin = (user: User | null): boolean => {
  if (!user || !user.email) {
    return false;
  }
  
  return user.email.endsWith('@virtualxposure.com');
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
        user_email: user.email || '',
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
      throw error;
    }
  } catch (error) {
    console.error('Failed to create user profile:', error);
    throw error;
  }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('affiliate_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // If no rows found, return null instead of throwing
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
  const { error } = await supabase
    .from('affiliate_profiles')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    throw error;
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
      throw error;
    }

    return code;
  } catch (error) {
    console.error('Failed to create referral code:', error);
    throw error;
  }
};

export const getReferralCode = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('affiliate_referrers')
    .select('code')
    .eq('user_id', userId)
    .single();

  if (error) {
    // If no rows found, return null instead of throwing
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data?.code || null;
};

const generateReferralCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching assets:', error);
    return null;
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
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error creating asset:', error);
    return null;
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
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error updating asset:', error);
    return null;
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
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting asset:', error);
    return false;
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

export const getUserReports = async (timeframe: string = "Last 30 Days"): Promise<UserReports | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found');
      return null;
    }

    console.log('🔄 Fetching user reports for:', user.id);
    
    // Get the user_reports from dashboard_kpis
    const { data, error } = await supabase
      .from('dashboard_kpis')
      .select('user_reports')
      .eq('user_id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching user reports:', error);
      return getDefaultUserReports();
    }
    
    if (data && data.user_reports) {
      console.log('✅ User reports loaded:', data.user_reports);
      
      // Transform the new structure to the expected format
      const transformedReports = transformUserReports(data.user_reports, timeframe);
      return transformedReports;
    } else {
      console.log('⚠️ No user reports found, using default data');
      return getDefaultUserReports();
    }
  } catch (error) {
    console.error('Error fetching user reports:', error);
    return getDefaultUserReports();
  }
};

// Transform the new user_reports structure to the expected format
export const transformUserReports = (userReports: any, selectedTimeframe: string = "Last 30 Days"): UserReports => {
  try {
    console.log('🔄 Transforming user reports structure...');
    
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
    let mdtToday = new Date(today.toLocaleString("en-US", {timeZone: "America/Denver"}));
    mdtToday.setHours(23, 59, 59, 999);
    
    let startDate = new Date();
    // Convert to MDT timezone
    let mdtStartDate = new Date(startDate.toLocaleString("en-US", {timeZone: "America/Denver"}));
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
      case "This Year":
        mdtStartDate = new Date(mdtToday.getFullYear(), 0, 1);
        mdtStartDate.setHours(0, 0, 0, 0);
        // Set end date to December 31st of current year
        mdtToday = new Date(mdtToday.getFullYear(), 11, 31);
        mdtToday.setHours(23, 59, 59, 999);
        break;
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
      const dateKey = currentDate.toLocaleDateString("en-CA", {timeZone: "America/Denver"}); // YYYY-MM-DD format
      allDates.push(dateKey);
      
      // Create next date in MDT timezone to avoid timezone issues
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      currentDate = nextDate;
    }
    
    // For "All Time", check if we have data beyond the last year
    if (selectedTimeframe === "All Time") {
      const lastYearStart = new Date(mdtToday.getFullYear() - 1, 0, 1);
      const lastYearStartKey = lastYearStart.toLocaleDateString("en-CA", {timeZone: "America/Denver"});
      
      // Check if we have any data from before last year
      const hasDataBeforeLastYear = Object.keys(overview).some(dateKey => {
        const date = new Date(dateKey);
        return date < lastYearStart;
      });
      
      // If no data before last year, fallback to "This Year" timeframe
      if (!hasDataBeforeLastYear) {
        console.log('📊 All Time: No data before last year, falling back to This Year timeframe');
        mdtStartDate = new Date(mdtToday.getFullYear(), 0, 1);
        mdtStartDate.setHours(0, 0, 0, 0);
        
        // Regenerate date range for "This Year"
        allDates.length = 0; // Clear existing dates
        let currentDateThisYear = new Date(mdtStartDate);
        while (currentDateThisYear <= mdtToday) {
          const dateKey = currentDateThisYear.toLocaleDateString("en-CA", {timeZone: "America/Denver"});
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
      console.log('📊 Aggregated data by month for timeframe:', selectedTimeframe);
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
    
    console.log('✅ Transformed reports:', transformedReports);
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
      return false;
    }

    console.log('🔄 Updating user reports for:', user.id);
    
    const { error } = await supabase
      .from('dashboard_kpis')
      .update({ user_reports: reports })
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error updating user reports:', error);
      return false;
    }
    
    console.log('✅ User reports updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating user reports:', error);
    return false;
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
      return false;
    }

    console.log(`🔄 Updating data for ${date} for user:`, user.id);
    
    // Get current user_reports
    const { data: kpiData, error: kpiError } = await supabase
      .from('dashboard_kpis')
      .select('user_reports')
      .eq('user_id', user.id)
      .single();
    
    if (kpiError) {
      console.error('Error fetching current user reports:', kpiError);
      return false;
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
      return false;
    }
    
    console.log(`✅ Data for ${date} updated successfully`);
    return true;
  } catch (error) {
    console.error('Error updating day data:', error);
    return false;
  }
};

// Trigger daily user reports update (admin function)
export const triggerDailyReportsUpdate = async (): Promise<boolean> => {
  try {
    console.log('🔄 Triggering daily reports update...');
    
    const response = await fetch('/api/admin/update-user-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error triggering daily reports update:', result.error);
      return false;
    }

    console.log('✅ Daily reports update triggered successfully');
    return true;
  } catch (error) {
    console.error('Error triggering daily reports update:', error);
    return false;
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
  return dateObj.toLocaleDateString("en-CA", {timeZone: "America/Denver"}); // YYYY-MM-DD format
};

// Utility function to format dates for display in MDT timezone
export const formatDateDisplayMDT = (date: Date | string): string => {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // If it's a date string in YYYY-MM-DD format, treat it as MDT date
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Create date in MDT timezone by appending time and timezone
      dateObj = new Date(`${date}T00:00:00-06:00`); // MDT is UTC-6
    } else {
      dateObj = new Date(date);
    }
  } else {
    dateObj = date;
  }
  
  return dateObj.toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Utility function to get current date in MDT timezone
export const getCurrentDateMDT = (): Date => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", {timeZone: "America/Denver"}));
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

// Calculate totals from user_reports data
export const calculateUserReportsTotals = async (): Promise<{
  clicks: number;
  referrals: number;
  customers: number;
  earnings: number;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found');
      return { clicks: 0, referrals: 0, customers: 0, earnings: 0 };
    }

    console.log('🔄 Calculating totals from user_reports for:', user.id);
    
    // Get the user_reports from dashboard_kpis
    const { data, error } = await supabase
      .from('dashboard_kpis')
      .select('user_reports')
      .eq('user_id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching user reports for totals:', error);
      return { clicks: 0, referrals: 0, customers: 0, earnings: 0 };
    }
    
    if (!data || !data.user_reports || !data.user_reports.overview) {
      console.log('No user_reports data found, returning zeros');
      return { clicks: 0, referrals: 0, customers: 0, earnings: 0 };
    }
    
    const overview = data.user_reports.overview;
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
    
    console.log('✅ Calculated totals:', {
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
    return { clicks: 0, referrals: 0, customers: 0, earnings: 0 };
  }
};

// Database health check function
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    console.log('Testing database connection...');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database health check timeout')), 3000);
    });
    
    const queryPromise = supabase
      .from('approved_users')
      .select('count')
      .limit(1);

    const { data, error } = await Promise.race([
      queryPromise,
      timeoutPromise
    ]) as any;

    console.log('Database health check result:', { data, error });
    
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
    
    console.log('Database connection successful');
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
    console.log('Testing basic Supabase connection...');
    
    // Test 1: Basic auth connection
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth connection test:', { user: !!user, error: authError });
    
    // Test 2: Simple database query
    const { data, error } = await supabase
      .from('approved_users')
      .select('count')
      .limit(1);
    
    console.log('Database connection test:', { data, error });
    
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
    console.log('Testing simple table query...');
    
    // Try a simple query on any table
    const { data, error } = await supabase
      .from('affiliate_profiles')
      .select('count')
      .limit(1);
    
    console.log('Simple table query result:', { data, error });
    
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
  
  console.log('Supabase configuration check:');
  console.log('URL exists:', !!url);
  console.log('URL starts with https:', url?.startsWith('https://'));
  console.log('Anon key exists:', !!anonKey);
  console.log('Anon key length:', anonKey?.length);
  
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
    console.log('Testing simple database query...');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Simple query timeout')), 2000);
    });
    
    const queryPromise = supabase
      .from('approved_users')
      .select('count')
      .limit(1);

    const { data, error } = await Promise.race([
      queryPromise,
      timeoutPromise
    ]) as any;

    console.log('Simple query result:', { data, error });
    
    if (error) {
      console.error('Simple query failed:', error);
      return false;
    }
    
    console.log('Simple query successful');
    return true;
  } catch (error) {
    console.error('Simple query error:', error);
    return false;
  }
};

// Test the exact query that's failing
export const testExactQuery = async (userId: string): Promise<boolean> => {
  try {
    console.log('Testing exact query for user ID:', userId);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Exact query timeout')), 2000);
    });
    
    const queryPromise = supabase
      .from('approved_users')
      .select('user_id, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    console.log('Starting exact query...');
    const { data, error } = await Promise.race([
      queryPromise,
      timeoutPromise
    ]) as any;
    
    console.log('Exact query result:', { data, error });
    
    if (error) {
      console.error('Exact query error:', error);
      return false;
    }
    
    const result = !!data;
    console.log('Exact query final result:', result);
    return result;
  } catch (error) {
    console.error('Exact query error:', error);
    return false;
  }
};
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Production-optimized query helper
export const optimizedQuery = async (queryFn: () => Promise<any>, timeoutMs: number = 8000) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
  });

  try {
    const result = await Promise.race([queryFn(), timeoutPromise]);
    return result;
  } catch (error) {
    console.error('Optimized query failed:', error);
    throw error;
  }
};

// Types for our database
export interface DashboardKPIs {
  clicks: number;
  referrals: number;
  customers: number;
}

export interface ReferralEvent {
  id: string;
  agent: string;
  email: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  referrer_id: string;
}

export interface AffiliateAsset {
  id: string;
  title: string;
  url: string;
  thumb: string;
}

export interface ReportOverview {
  earnings: number;
  clicks: number;
  signups: number;
  customers: number;
}

export interface AffiliateProfile {
  id: string;
  user_id: string;
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
}

export interface AffiliateReferrer {
  id: string;
  user_id: string;
  code: string;
}
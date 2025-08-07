import { createBrowserClient } from '@supabase/ssr';

// Enhanced Supabase client with default configuration for SSR
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Production-optimized query helper with enhanced error handling and longer timeouts
export const optimizedQuery = async (queryFn: () => Promise<any>, timeoutMs: number = 15000) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
  });

  try {
    console.log(`🔄 Executing query with ${timeoutMs}ms timeout...`);
    const result = await Promise.race([queryFn(), timeoutPromise]);
    console.log('✅ Query executed successfully');
    return result;
  } catch (error) {
    console.error('❌ Optimized query failed:', error);
    throw error;
  }
};

// Enhanced database health check with better error handling
export const checkDatabaseHealth = async (): Promise<{
  healthy: boolean;
  error?: string;
  details?: any;
}> => {
  try {
    console.log('🔍 Checking database health...');
    
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('approved_users')
      .select('count')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      console.error('Database health check failed:', error);
      return {
        healthy: false,
        error: error.message,
        details: {
          code: error.code,
          details: error.details,
          hint: error.hint,
          responseTime
        }
      };
    }
    
    console.log(`✅ Database health check passed (${responseTime}ms)`);
    return {
      healthy: true,
      details: { responseTime }
    };
  } catch (error) {
    console.error('Database health check error:', error);
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: { error }
    };
  }
};

// Enhanced connection monitoring with better error handling
export const monitorDatabaseConnection = async (): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> => {
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('approved_users')
      .select('count')
      .limit(1);
    
    const latency = Date.now() - startTime;
    
    if (error) {
      return {
        connected: false,
        error: error.message,
        latency
      };
    }
    
    return {
      connected: true,
      latency
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Enhanced retry mechanism with exponential backoff and longer timeouts
export const retryDatabaseOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Database operation attempt ${attempt}/${maxRetries}`);
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Database operation attempt ${attempt} failed:`, lastError);
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};

// Enhanced query with automatic retry and longer timeouts
export const robustQuery = async <T>(
  queryFn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    timeout?: number;
  } = {}
): Promise<T> => {
  const { maxRetries = 3, baseDelay = 2000, timeout = 20000 } = options;
  
  return retryDatabaseOperation(async () => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), timeout);
    });
    
    return Promise.race([queryFn(), timeoutPromise]) as Promise<T>;
  }, maxRetries, baseDelay);
};

// Database connection status monitoring with enhanced error handling
export class DatabaseMonitor {
  private static instance: DatabaseMonitor;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: { healthy: boolean; timestamp: number } | null = null;
  
  private constructor() {}
  
  static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor();
    }
    return DatabaseMonitor.instance;
  }
  
  async startMonitoring(intervalMs: number = 30000): Promise<void> {
    if (this.healthCheckInterval) {
      this.stopMonitoring();
    }
    
    console.log('🔍 Starting database monitoring...');
    
    // Initial health check
    await this.performHealthCheck();
    
    // Set up periodic health checks
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);
  }
  
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('🛑 Stopped database monitoring');
    }
  }
  
  private async performHealthCheck(): Promise<void> {
    try {
      const health = await checkDatabaseHealth();
      this.lastHealthCheck = {
        healthy: health.healthy,
        timestamp: Date.now()
      };
      
      if (!health.healthy) {
        console.warn('⚠️ Database health check failed:', health.error);
      } else {
        console.log('✅ Database health check passed');
      }
    } catch (error) {
      console.error('❌ Database health check error:', error);
      this.lastHealthCheck = {
        healthy: false,
        timestamp: Date.now()
      };
    }
  }
  
  getLastHealthCheck(): { healthy: boolean; timestamp: number } | null {
    return this.lastHealthCheck;
  }
  
  isHealthy(): boolean {
    return this.lastHealthCheck?.healthy ?? false;
  }
}

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
}

export interface AffiliateReferrer {
  id: string;
  user_id: string;
  code: string;
}
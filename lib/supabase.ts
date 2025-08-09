import { createBrowserClient } from '@supabase/ssr';

// Debug flag for verbose logging
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// Debug logging helper
const debugLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(message, ...args);
  }
};

// Enhanced Supabase client with proper session persistence and auto-refresh
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    cookies: {
      // Required for SSR client - check if we're in browser environment
      get(name: string) {
        if (typeof document === 'undefined') {
          return undefined;
        }
        return document.cookie
          .split('; ')
          .find((row) => row.startsWith(`${name}=`))
          ?.split('=')[1];
      },
      set(name: string, value: string, options: any) {
        if (typeof document === 'undefined') {
          return;
        }
        document.cookie = `${name}=${value}; path=/; max-age=${options?.maxAge || 31536000}`;
      },
      remove(name: string, options: any) {
        if (typeof document === 'undefined') {
          return;
        }
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      },
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

// Connection state management
interface ConnectionState {
  isHealthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  latency: number;
  isRecovering: boolean;
}

class ConnectionManager {
  private static instance: ConnectionManager;
  private state: ConnectionState = {
    isHealthy: true,
    lastCheck: 0,
    consecutiveFailures: 0,
    latency: 0,
    isRecovering: false
  };
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private sessionCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private recoveryTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  private constructor() {
    // Only start health monitoring in browser environment
    if (typeof window !== 'undefined') {
      this.startHealthMonitoring();
      // Clean up on page unload
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  private async performHealthCheck(): Promise<void> {
    if (this.isShuttingDown || typeof window === 'undefined') return;
    
    try {
      const startTime = Date.now();
      const { data, error } = await supabase
        .from('approved_users')
        .select('count')
        .limit(1);
      
      const latency = Date.now() - startTime;
      
      if (error) {
        this.state.consecutiveFailures++;
        this.state.isHealthy = false;
        console.warn(`⚠️ Database health check failed (attempt ${this.state.consecutiveFailures}):`, error);
        
        // Start recovery process if we have too many failures
        if (this.state.consecutiveFailures >= 3 && !this.state.isRecovering) {
          this.startRecovery();
        }
      } else {
        this.state.consecutiveFailures = 0;
        this.state.isHealthy = true;
        this.state.latency = latency;
        this.state.isRecovering = false;
        debugLog(`✅ Database healthy (${latency}ms latency)`);
      }
      
      this.state.lastCheck = Date.now();
    } catch (error) {
      this.state.consecutiveFailures++;
      this.state.isHealthy = false;
      console.error('❌ Database health check error:', error);
      this.state.lastCheck = Date.now();
      
      // Start recovery process
      if (this.state.consecutiveFailures >= 3 && !this.state.isRecovering) {
        this.startRecovery();
      }
    }
  }

  private startRecovery(): void {
    if (this.state.isRecovering || typeof window === 'undefined') return;
    
    debugLog('🔄 Starting connection recovery...');
    this.state.isRecovering = true;
    
    // Clear cache to force fresh data
    this.clearCache();
    
    // Try to reconnect after a delay
    this.recoveryTimeout = setTimeout(async () => {
      if (this.isShuttingDown || typeof window === 'undefined') return;
      
      debugLog('🔄 Attempting connection recovery...');
      await this.performHealthCheck();
      
      if (this.state.isHealthy) {
        debugLog('✅ Connection recovered successfully');
      } else {
        console.warn('⚠️ Connection recovery failed, will retry...');
        // Schedule another recovery attempt
        setTimeout(() => {
          if (!this.isShuttingDown && typeof window !== 'undefined') {
            this.startRecovery();
          }
        }, 10000); // 10 seconds
      }
    }, 5000); // 5 second delay before recovery attempt
  }

  startHealthMonitoring(): void {
    // Only start monitoring in browser environment
    if (typeof window === 'undefined') return;
    
    // Perform initial health check
    this.performHealthCheck();
    
    // Set up periodic health checks every 60 seconds (reduced frequency)
    this.healthCheckInterval = setInterval(() => {
      if (!this.isShuttingDown && typeof window !== 'undefined') {
        this.performHealthCheck();
      }
    }, 60000); // Increased to 60 seconds to reduce load
  }

  cleanup(): void {
    debugLog('🧹 Cleaning up connection manager...');
    this.isShuttingDown = true;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = null;
    }
    
    this.clearCache();
  }

  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  isConnectionHealthy(): boolean {
    // Return true during SSR to avoid blocking
    if (typeof window === 'undefined') return true;
    
    // Consider unhealthy if we've had 3+ consecutive failures or last check was more than 5 minutes ago
    const timeSinceLastCheck = Date.now() - this.state.lastCheck;
    return this.state.isHealthy && 
           this.state.consecutiveFailures < 3 && 
           timeSinceLastCheck < 300000; // Increased to 5 minutes
  }

  getConnectionLatency(): number {
    return this.state.latency;
  }

  // Session-based caching with automatic cleanup
  setCache(key: string, data: any, ttl: number = 300000): void { // 5 minutes default TTL
    // Clean expired cache entries first
    this.clearExpiredCache();
    
    this.sessionCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  getCache(key: string): any | null {
    const cached = this.sessionCache.get(key);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.sessionCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  clearCache(): void {
    this.sessionCache.clear();
  }

  clearExpiredCache(): void {
    const now = Date.now();
    const entries = Array.from(this.sessionCache.entries());
    for (const [key, cached] of entries) {
      if (now - cached.timestamp > cached.ttl) {
        this.sessionCache.delete(key);
      }
    }
  }
}

// Global connection manager instance
const connectionManager = ConnectionManager.getInstance();

// Enhanced query with connection health checks and caching
export const optimizedQuery = async (
  queryFn: () => Promise<any>, 
  timeoutMs: number = 30000, // Increased to 30 seconds default
  options: {
    useCache?: boolean;
    cacheKey?: string;
    cacheTTL?: number;
    skipHealthCheck?: boolean;
    maxRetries?: number;
  } = {}
): Promise<any> => {
  const { 
    useCache = false, 
    cacheKey, 
    cacheTTL = 300000, 
    skipHealthCheck = false,
    maxRetries = 2
  } = options;

  // Skip caching and health checks during SSR
  if (typeof window === 'undefined') {
    return await queryFn();
  }

  // Check cache first if enabled
  if (useCache && cacheKey) {
    const cached = connectionManager.getCache(cacheKey);
    if (cached) {
      debugLog('📋 Returning cached result');
      return cached;
    }
  }

  // Check connection health unless skipped
  if (!skipHealthCheck && !connectionManager.isConnectionHealthy()) {
    console.warn('⚠️ Database connection unhealthy, attempting query anyway...');
  }

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      debugLog(`🔄 Executing query (attempt ${attempt}/${maxRetries + 1}) with ${timeoutMs}ms timeout...`);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs);
      });

      const startTime = Date.now();
      const result = await Promise.race([queryFn(), timeoutPromise]);
      const duration = Date.now() - startTime;
      
      debugLog(`✅ Query executed successfully (${duration}ms)`);
      
      // Cache result if enabled
      if (useCache && cacheKey) {
        connectionManager.setCache(cacheKey, result, cacheTTL);
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Query attempt ${attempt} failed:`, lastError);
      const name = (lastError as any)?.name || '';
      const message = lastError.message || '';
      const isAbort = name === 'AbortError' || /abort/i.test(message);
      const isTimeout = /timeout/i.test(message);
      // Do not retry on timeouts/aborts
      if (isAbort || isTimeout) {
        throw lastError;
      }
      
      if (attempt <= maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
        debugLog(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`❌ All ${maxRetries + 1} query attempts failed`);
  throw lastError || new Error('Query failed after all retries');
};

// Enhanced database health check with better error handling
export const checkDatabaseHealth = async (): Promise<{
  healthy: boolean;
  error?: string;
  details?: any;
}> => {
  try {
    debugLog('🔍 Checking database health...');
    
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
    
    debugLog(`✅ Database health check passed (${responseTime}ms)`);
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
  baseDelay: number = 3000 // Increased to 3 seconds base delay
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      debugLog(`🔄 Database operation attempt ${attempt}/${maxRetries}`);
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Database operation attempt ${attempt} failed:`, lastError);
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        debugLog(`⏳ Retrying in ${delay}ms...`);
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
    useCache?: boolean;
    cacheKey?: string;
    cacheTTL?: number;
  } = {}
): Promise<T> => {
  const { 
    maxRetries = 3, 
    baseDelay = 3000, 
    timeout = 30000, // Increased to 30 seconds
    useCache = false,
    cacheKey,
    cacheTTL = 300000
  } = options;
  
  return retryDatabaseOperation(async () => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), timeout);
    });
    
    const result = await Promise.race([queryFn(), timeoutPromise]) as Promise<T>;
    
    // Cache result if enabled
    if (useCache && cacheKey) {
      connectionManager.setCache(cacheKey, result, cacheTTL);
    }
    
    return result;
  }, maxRetries, baseDelay);
};

// Abortable timeout wrapper for Supabase queries (cancels the underlying request)
export const withAbort = async <T>(query: any, timeoutMs: number = 3000): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const runner = query.abortSignal?.(controller.signal) ?? query;
    return await runner;
  } finally {
    clearTimeout(timeoutId);
  }
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
    
    debugLog('🔍 Starting database monitoring...');
    
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
      debugLog('🛑 Stopped database monitoring');
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
        debugLog('✅ Database health check passed');
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

// Export connection manager for use in other modules
export { connectionManager };

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

// Reset connection manager (useful for troubleshooting)
export const resetConnectionManager = (): void => {
  debugLog('🔄 Resetting connection manager...');
  
  // Stop current monitoring
  connectionManager.stopHealthMonitoring();
  
  // Clear all caches
  connectionManager.clearCache();
  
  // Restart monitoring
  connectionManager.startHealthMonitoring();
  
  debugLog('✅ Connection manager reset complete');
};

// Get connection statistics for debugging
export const getConnectionStats = (): {
  isHealthy: boolean;
  latency: number;
  lastCheck: number;
  consecutiveFailures: number;
  cacheSize: number;
} => {
  return {
    isHealthy: connectionManager.isConnectionHealthy(),
    latency: connectionManager.getConnectionLatency(),
    lastCheck: Date.now(),
    consecutiveFailures: 0, // This would need to be exposed from the manager
    cacheSize: 0 // This would need to be exposed from the manager
  };
};
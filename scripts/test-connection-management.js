require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Connection state management
class ConnectionManager {
  constructor() {
    this.state = {
      isHealthy: true,
      lastCheck: 0,
      consecutiveFailures: 0,
      latency: 0
    };
    this.sessionCache = new Map();
  }

  async performHealthCheck() {
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
      } else {
        this.state.consecutiveFailures = 0;
        this.state.isHealthy = true;
        this.state.latency = latency;
        console.log(`✅ Database healthy (${latency}ms latency)`);
      }
      
      this.state.lastCheck = Date.now();
    } catch (error) {
      this.state.consecutiveFailures++;
      this.state.isHealthy = false;
      console.error('❌ Database health check error:', error);
      this.state.lastCheck = Date.now();
    }
  }

  isConnectionHealthy() {
    const timeSinceLastCheck = Date.now() - this.state.lastCheck;
    return this.state.isHealthy && 
           this.state.consecutiveFailures < 3 && 
           timeSinceLastCheck < 120000;
  }

  getConnectionLatency() {
    return this.state.latency;
  }

  // Session-based caching
  setCache(key, data, ttl = 300000) {
    this.sessionCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  getCache(key) {
    const cached = this.sessionCache.get(key);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.sessionCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  clearCache() {
    this.sessionCache.clear();
  }
}

// Enhanced query with connection health checks and caching
async function optimizedQuery(queryFn, timeoutMs = 30000, options = {}) {
  const { useCache = false, cacheKey, cacheTTL = 300000, skipHealthCheck = false } = options;
  const connectionManager = new ConnectionManager();

  // Check cache first if enabled
  if (useCache && cacheKey) {
    const cached = connectionManager.getCache(cacheKey);
    if (cached) {
      console.log('📋 Returning cached result');
      return cached;
    }
  }

  // Check connection health unless skipped
  if (!skipHealthCheck) {
    await connectionManager.performHealthCheck();
    if (!connectionManager.isConnectionHealthy()) {
      console.warn('⚠️ Database connection unhealthy, attempting query anyway...');
    }
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
  });

  try {
    console.log(`🔄 Executing query with ${timeoutMs}ms timeout...`);
    const startTime = Date.now();
    const result = await Promise.race([queryFn(), timeoutPromise]);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Query executed successfully (${duration}ms)`);
    
    // Cache result if enabled
    if (useCache && cacheKey) {
      connectionManager.setCache(cacheKey, result, cacheTTL);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Optimized query failed:', error);
    throw error;
  }
}

// Test functions
async function testConnectionHealth() {
  console.log('\n🔍 Testing connection health...');
  
  const connectionManager = new ConnectionManager();
  await connectionManager.performHealthCheck();
  
  console.log('Connection healthy:', connectionManager.isConnectionHealthy());
  console.log('Connection latency:', connectionManager.getConnectionLatency());
  console.log('Consecutive failures:', connectionManager.state.consecutiveFailures);
}

async function testCaching() {
  console.log('\n📋 Testing caching system...');
  
  const connectionManager = new ConnectionManager();
  
  // Test cache set/get
  connectionManager.setCache('test_key', { data: 'test_value' }, 5000);
  const cached = connectionManager.getCache('test_key');
  console.log('Cached value:', cached);
  
  // Test cache expiration
  connectionManager.setCache('expired_key', { data: 'expired_value' }, 1);
  await new Promise(resolve => setTimeout(resolve, 10));
  const expired = connectionManager.getCache('expired_key');
  console.log('Expired value:', expired);
}

async function testOptimizedQuery() {
  console.log('\n🔄 Testing optimized query...');
  
  try {
    const result = await optimizedQuery(async () => {
      return supabase
        .from('approved_users')
        .select('count')
        .limit(1);
    }, 30000, {
      useCache: true,
      cacheKey: 'test_query',
      cacheTTL: 60000
    });
    
    console.log('Query result:', result);
  } catch (error) {
    console.error('Query failed:', error);
  }
}

async function testRepeatedQueries() {
  console.log('\n🔄 Testing repeated queries with caching...');
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- Query ${i} ---`);
    try {
      const result = await optimizedQuery(async () => {
        return supabase
          .from('approved_users')
          .select('count')
          .limit(1);
      }, 30000, {
        useCache: true,
        cacheKey: 'repeated_query',
        cacheTTL: 30000
      });
      
      console.log('Query result:', result);
    } catch (error) {
      console.error('Query failed:', error);
    }
    
    // Wait between queries
    if (i < 3) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function testTimeoutHandling() {
  console.log('\n⏰ Testing timeout handling...');
  
  try {
    const result = await optimizedQuery(async () => {
      // Simulate a slow query
      await new Promise(resolve => setTimeout(resolve, 5000));
      return supabase
        .from('approved_users')
        .select('count')
        .limit(1);
    }, 2000); // Short timeout to trigger timeout error
    
    console.log('Query result:', result);
  } catch (error) {
    console.log('Expected timeout error:', error.message);
  }
}

async function testUserApprovalQuery() {
  console.log('\n👤 Testing user approval query...');
  
  try {
    const result = await optimizedQuery(async () => {
      return supabase
        .from('approved_users')
        .select('user_id')
        .eq('user_id', 'test-user-id')
        .eq('status', 'active')
        .limit(1);
    }, 30000, {
      useCache: true,
      cacheKey: 'user_approved_test-user-id',
      cacheTTL: 60000
    });
    
    console.log('User approval result:', result);
  } catch (error) {
    console.error('User approval query failed:', error);
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Testing Connection Management System');
  console.log('=====================================');
  
  try {
    await testConnectionHealth();
    await testCaching();
    await testOptimizedQuery();
    await testRepeatedQueries();
    await testTimeoutHandling();
    await testUserApprovalQuery();
    
    console.log('\n✅ All tests completed');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  ConnectionManager,
  optimizedQuery,
  runTests
}; 
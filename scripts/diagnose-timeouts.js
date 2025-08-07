#!/usr/bin/env node

/**
 * Database Timeout Diagnostic Script
 * 
 * This script helps diagnose and fix database timeout issues by testing
 * different configurations and identifying the optimal settings.
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test different timeout configurations
const timeoutConfigs = [
  { name: 'Very Short (3s)', timeout: 3000 },
  { name: 'Short (5s)', timeout: 5000 },
  { name: 'Medium (8s)', timeout: 8000 },
  { name: 'Long (15s)', timeout: 15000 },
  { name: 'Very Long (20s)', timeout: 20000 },
  { name: 'Extra Long (30s)', timeout: 30000 }
];

// Test different query types
const queryTests = [
  {
    name: 'Simple Count Query',
    query: () => supabase.from('approved_users').select('count').limit(1)
  },
  {
    name: 'Single Row Query',
    query: () => supabase.from('approved_users').select('*').limit(1).single()
  },
  {
    name: 'Complex Query with Conditions',
    query: () => supabase.from('approved_users').select('user_id, status').eq('status', 'active').limit(1)
  },
  {
    name: 'Dashboard KPIs Query',
    query: () => supabase.from('dashboard_kpis').select('user_reports').limit(1)
  }
];

async function testTimeoutConfig(config, queryTest) {
  console.log(`\n🔍 Testing ${queryTest.name} with ${config.name} timeout...`);
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Query timeout after ${config.timeout}ms`)), config.timeout);
  });

  try {
    const startTime = Date.now();
    const result = await Promise.race([queryTest.query(), timeoutPromise]);
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ ${queryTest.name} succeeded in ${responseTime}ms`);
    return {
      success: true,
      responseTime,
      timeout: config.timeout
    };
  } catch (error) {
    console.log(`❌ ${queryTest.name} failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      timeout: config.timeout
    };
  }
}

async function testConnectionHealth() {
  console.log('🔍 Testing basic connection health...');
  
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('approved_users')
      .select('count')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      console.error('❌ Connection health check failed:', error);
      return false;
    }
    
    console.log(`✅ Connection health check passed (${responseTime}ms)`);
    return true;
  } catch (error) {
    console.error('❌ Connection health check error:', error);
    return false;
  }
}

async function testNetworkLatency() {
  console.log('🔍 Testing network latency...');
  
  const latencies = [];
  
  for (let i = 0; i < 5; i++) {
    try {
      const startTime = Date.now();
      const { data, error } = await supabase
        .from('approved_users')
        .select('count')
        .limit(1);
      
      const latency = Date.now() - startTime;
      latencies.push(latency);
      
      if (error) {
        console.error(`❌ Latency test ${i + 1} failed:`, error);
      } else {
        console.log(`✅ Latency test ${i + 1}: ${latency}ms`);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Latency test ${i + 1} error:`, error);
    }
  }
  
  if (latencies.length > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    
    console.log(`\n📊 Latency Statistics:`);
    console.log(`  Average: ${avgLatency.toFixed(0)}ms`);
    console.log(`  Minimum: ${minLatency}ms`);
    console.log(`  Maximum: ${maxLatency}ms`);
    
    return {
      average: avgLatency,
      minimum: minLatency,
      maximum: maxLatency
    };
  }
  
  return null;
}

async function runDiagnostics() {
  console.log('🚀 Starting database timeout diagnostics...\n');
  
  // Test 1: Connection Health
  const connectionHealthy = await testConnectionHealth();
  if (!connectionHealthy) {
    console.error('❌ Connection health check failed. Stopping diagnostics.');
    return;
  }
  
  // Test 2: Network Latency
  const latencyStats = await testNetworkLatency();
  
  // Test 3: Timeout Configurations
  console.log('\n🔍 Testing timeout configurations...');
  
  const results = [];
  
  for (const config of timeoutConfigs) {
    for (const queryTest of queryTests) {
      const result = await testTimeoutConfig(config, queryTest);
      results.push({
        config: config.name,
        query: queryTest.name,
        ...result
      });
    }
  }
  
  // Analyze results
  console.log('\n📊 Analysis Results:');
  
  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  
  console.log(`✅ Successful queries: ${successfulResults.length}`);
  console.log(`❌ Failed queries: ${failedResults.length}`);
  
  if (successfulResults.length > 0) {
    const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length;
    console.log(`📈 Average response time: ${avgResponseTime.toFixed(0)}ms`);
    
    // Find optimal timeout
    const optimalTimeout = Math.max(...successfulResults.map(r => r.timeout));
    console.log(`🎯 Recommended timeout: ${optimalTimeout}ms`);
  }
  
  if (failedResults.length > 0) {
    console.log('\n❌ Failed queries:');
    failedResults.forEach(result => {
      console.log(`  - ${result.query} with ${result.config}: ${result.error}`);
    });
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (latencyStats) {
    const recommendedTimeout = Math.max(latencyStats.average * 3, 10000);
    console.log(`  - Set timeout to at least ${recommendedTimeout}ms (3x average latency)`);
  }
  
  if (successfulResults.length > 0) {
    const minWorkingTimeout = Math.min(...successfulResults.map(r => r.timeout));
    console.log(`  - Minimum working timeout: ${minWorkingTimeout}ms`);
  }
  
  console.log('  - Consider implementing retry logic with exponential backoff');
  console.log('  - Monitor connection health regularly');
  console.log('  - Use connection pooling if available');
  
  return {
    connectionHealthy,
    latencyStats,
    results,
    recommendations: {
      optimalTimeout: successfulResults.length > 0 ? Math.max(...successfulResults.map(r => r.timeout)) : null,
      minWorkingTimeout: successfulResults.length > 0 ? Math.min(...successfulResults.map(r => r.timeout)) : null
    }
  };
}

// Run the diagnostics
if (require.main === module) {
  runDiagnostics()
    .then((results) => {
      if (results && results.connectionHealthy) {
        console.log('\n🎉 Diagnostics completed successfully!');
        process.exit(0);
      } else {
        console.log('\n⚠️ Diagnostics completed with issues.');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Diagnostics failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runDiagnostics,
  testTimeoutConfig,
  testConnectionHealth,
  testNetworkLatency
}; 
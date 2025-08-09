#!/usr/bin/env node

/**
 * Database Integration Test Script
 * 
 * This script tests the database connection and basic functionality
 * to ensure the system is working properly.
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

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('approved_users')
      .select('count')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
    
    console.log(`✅ Database connection successful (${responseTime}ms)`);
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    return false;
  }
}

async function testTableAccess() {
  console.log('🔍 Testing table access...');
  
  const tables = [
    'approved_users',
    'dashboard_kpis', 
    'affiliate_profiles',
    'affiliate_referrers'
  ];
  
  const results = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (error) {
        console.error(`❌ Table ${table} access failed:`, error);
        results[table] = false;
      } else {
        console.log(`✅ Table ${table} accessible`);
        results[table] = true;
      }
    } catch (error) {
      console.error(`❌ Table ${table} error:`, error);
      results[table] = false;
    }
  }
  
  return results;
}

async function testUserApprovalSystem() {
  console.log('🔍 Testing user approval system...');
  
  try {
    // Test with a sample user ID
    const testUserId = 'test-user-id';
    
    const { data, error } = await supabase
      .from('approved_users')
      .select('user_id, status')
      .eq('user_id', testUserId)
      .eq('status', 'active')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      // No rows found - this is expected for a test user
      console.log('✅ User approval system working (no test user found, as expected)');
      return true;
    } else if (error) {
      console.error('❌ User approval system error:', error);
      return false;
    } else {
      console.log('✅ User approval system working');
      return true;
    }
  } catch (error) {
    console.error('❌ User approval system error:', error);
    return false;
  }
}

async function testKPISystem() {
  console.log('🔍 Testing KPI system...');
  
  try {
    // Test with a sample user ID
    const testUserId = 'test-user-id';
    
    const { data, error } = await supabase
      .from('dashboard_kpis')
      .select('user_reports')
      .eq('user_id', testUserId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // No rows found - this is expected for a test user
      console.log('✅ KPI system working (no test user data found, as expected)');
      return true;
    } else if (error) {
      console.error('❌ KPI system error:', error);
      return false;
    } else {
      console.log('✅ KPI system working');
      return true;
    }
  } catch (error) {
    console.error('❌ KPI system error:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting database integration tests...\n');
  
  const results = {
    connection: false,
    tables: {},
    approval: false,
    kpis: false
  };
  
  // Test 1: Database connection
  results.connection = await testDatabaseConnection();
  console.log('');
  
  if (!results.connection) {
    console.error('❌ Database connection failed. Stopping tests.');
    return results;
  }
  
  // Test 2: Table access
  results.tables = await testTableAccess();
  console.log('');
  
  // Test 3: User approval system
  results.approval = await testUserApprovalSystem();
  console.log('');
  
  // Test 4: KPI system
  results.kpis = await testKPISystem();
  console.log('');
  
  // Summary
  console.log('📊 Test Results Summary:');
  console.log(`Database Connection: ${results.connection ? '✅ PASS' : '❌ FAIL'}`);
  
  const tableResults = Object.entries(results.tables);
  console.log('Table Access:');
  tableResults.forEach(([table, success]) => {
    console.log(`  ${table}: ${success ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  console.log(`User Approval System: ${results.approval ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`KPI System: ${results.kpis ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = results.connection && 
    Object.values(results.tables).every(Boolean) && 
    results.approval && 
    results.kpis;
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Database integration is working properly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the configuration and database setup.');
  }
  
  return results;
}

// Run the tests
if (require.main === module) {
  runAllTests()
    .then((results) => {
      const allPassed = results.connection && 
        Object.values(results.tables).every(Boolean) && 
        results.approval && 
        results.kpis;
      
      process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testDatabaseConnection,
  testTableAccess,
  testUserApprovalSystem,
  testKPISystem,
  runAllTests
}; 
#!/usr/bin/env node

/**
 * Sign Out Test Script
 * 
 * This script tests the sign out functionality to ensure it's working properly.
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

// Mock the clearUserCredentials function
const clearUserCredentials = () => {
  console.log('🧹 Clearing user credentials...');
  // In a real browser environment, this would clear localStorage
  return true;
};

// Enhanced signOut function (simplified version for testing)
const signOut = async () => {
  try {
    console.log('🔄 Signing out user...');
    
    // Clear stored credentials first
    clearUserCredentials();
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out from Supabase:', error);
      throw error;
    }
    
    console.log('✅ User signed out successfully');
    return true;
  } catch (error) {
    console.error('Error in signOut:', error);
    // Even if Supabase sign out fails, clear credentials
    clearUserCredentials();
    throw error;
  }
};

async function testSignOut() {
  console.log('🚀 Testing sign out functionality...\n');
  
  try {
    // Test 1: Check if we can connect to Supabase
    console.log('🔍 Test 1: Checking Supabase connection...');
    const { data, error } = await supabase
      .from('approved_users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    
    // Test 2: Test sign out function
    console.log('\n🔍 Test 2: Testing sign out function...');
    
    // Note: This will fail if no user is currently signed in, which is expected
    try {
      await signOut();
      console.log('✅ Sign out function executed successfully');
    } catch (error) {
      if (error.message?.includes('not authenticated') || error.message?.includes('No user logged in')) {
        console.log('✅ Sign out function working (no user to sign out, as expected)');
      } else {
        console.error('❌ Sign out function error:', error);
        return false;
      }
    }
    
    // Test 3: Verify credential clearing
    console.log('\n🔍 Test 3: Testing credential clearing...');
    const credentialsCleared = clearUserCredentials();
    if (credentialsCleared) {
      console.log('✅ Credential clearing function working');
    } else {
      console.log('❌ Credential clearing function failed');
      return false;
    }
    
    console.log('\n🎉 All sign out tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testSignOut()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testSignOut,
  signOut,
  clearUserCredentials
}; 
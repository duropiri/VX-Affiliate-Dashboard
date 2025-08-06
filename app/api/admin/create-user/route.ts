import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, password, userData } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser.users?.some(user => user.email === email);
    
    if (userExists) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Create user with admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userData,
    });

    if (error) {
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const userId = data.user.id;
    const firstName = userData?.first_name || userData?.full_name?.split(' ')[0] || 'User';
    const lastName = userData?.last_name || userData?.full_name?.split(' ').slice(1).join(' ') || 'Name';

    // Generate referral code
    const referralCode = generateReferralCode();

    try {
      // 1. Create approved_users record
      const { error: approveError } = await supabaseAdmin
        .from('approved_users')
        .insert({
          user_id: userId,
          user_email: email,
          approved_by: 'admin', // You can change this to the actual admin user ID
          status: 'active',
          notes: 'Created via admin interface',
        });

      if (approveError) {
        console.error('Error creating approved_users record:', approveError);
        // Clean up the created user if approval fails
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: 'Failed to approve user' },
          { status: 500 }
        );
      }

      // 2. Create affiliate_profiles record
      const { error: profileError } = await supabaseAdmin
        .from('affiliate_profiles')
        .insert({
          user_id: userId,
          user_aryeo_id: userId, // Using user ID as aryeo_id for now
          user_email: email,
          first_name: firstName,
          last_name: lastName,
          avatar_url: userData?.avatar_url || userData?.picture,
          social_links: {},
          notifications: {
            email_reports: true,
            sms_alerts: false,
            push_notifications: true,
          },
        });

      if (profileError) {
        console.error('Error creating affiliate_profiles record:', profileError);
        // Clean up
        await supabaseAdmin.auth.admin.deleteUser(userId);
        await supabaseAdmin.from('approved_users').delete().eq('user_id', userId);
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        );
      }

      // 3. Create affiliate_referrers record
      const { error: referralError } = await supabaseAdmin
        .from('affiliate_referrers')
        .insert({
          user_id: userId,
          code: referralCode,
        });

      if (referralError) {
        console.error('Error creating affiliate_referrers record:', referralError);
        // Clean up
        await supabaseAdmin.auth.admin.deleteUser(userId);
        await supabaseAdmin.from('approved_users').delete().eq('user_id', userId);
        await supabaseAdmin.from('affiliate_profiles').delete().eq('user_id', userId);
        return NextResponse.json(
          { error: 'Failed to create referral code' },
          { status: 500 }
        );
      }

      // 4. Create dashboard_kpis record
      const { error: kpiError } = await supabaseAdmin
        .from('dashboard_kpis')
        .insert({
          user_id: userId,
          user_referrals: {},
          user_reports: {
            overview: {},
            links: {},
            sub_ids: {},
            traffic_sources: {}
          },
        });

      if (kpiError) {
        console.error('Error creating dashboard_kpis record:', kpiError);
        // Clean up
        await supabaseAdmin.auth.admin.deleteUser(userId);
        await supabaseAdmin.from('approved_users').delete().eq('user_id', userId);
        await supabaseAdmin.from('affiliate_profiles').delete().eq('user_id', userId);
        await supabaseAdmin.from('affiliate_referrers').delete().eq('user_id', userId);
        return NextResponse.json(
          { error: 'Failed to create dashboard KPIs' },
          { status: 500 }
        );
      }

      console.log('Successfully created user with all required records:', {
        userId,
        email,
        referralCode
      });

      return NextResponse.json({ 
        user: data.user,
        referralCode,
        message: 'User created successfully with all required records'
      });

    } catch (error) {
      console.error('Error in database operations:', error);
      // Clean up the created user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'Failed to create user records' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Error in create-user API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to generate referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
} 
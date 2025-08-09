import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveExternalUser } from '@/app/api/utils/resolve-user';
import { supabaseAdminNextAuth } from '@/lib/supabase-admin';

type UserData = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  user_aryeo_id?: string;
  avatar_url?: string;
  picture?: string;
  notes?: string;
  // keep accepting any extra props you’ve been sending historically
  [k: string]: any;
};

// --- helpers ---------------------------------------------------------------

function parseNames(ud?: UserData): { firstName: string; lastName: string } {
  const full = (ud?.full_name || '').trim();
  const first = (ud?.first_name || '').trim();
  const last = (ud?.last_name || '').trim();

  if (first && last) return { firstName: first, lastName: last };
  if (first && !last) {
    // pull a last name from full_name if we can
    if (full.includes(' ')) {
      const parts = full.split(/\s+/);
      return { firstName: first, lastName: parts.slice(1).join(' ') || 'Name' };
    }
    return { firstName: first, lastName: 'Name' };
  }
  if (!first && full) {
    const parts = full.split(/\s+/);
    return {
      firstName: parts[0] || 'User',
      lastName: parts.slice(1).join(' ') || 'Name',
    };
  }
  // ultimate fallback
  return { firstName: 'User', lastName: 'Name' };
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// Create Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // Admin auth: require a signed-in admin via cookie session or PAT
    const ext = await resolveExternalUser(request);
    if (!ext?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine requester email for admin domain check
    let requesterEmail = ext.email?.toLowerCase() || '';
    if (!requesterEmail) {
      const { data: nu } = await supabaseAdminNextAuth
        .from('users')
        .select('email')
        .eq('id', ext.id)
        .maybeSingle();
      requesterEmail = nu?.email?.toLowerCase() || '';
    }
    if (!requesterEmail.endsWith('@virtualxposure.com')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, password, userData } = (await request.json()) as {
      email: string;
      password: string;
      userData?: UserData;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Keep the existing pre-check to avoid breaking old clients (lightly optimized)
    // If rate/volume grows, you can remove this and rely on createUser error handling.
    const { data: existingUserList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200
    });
    if (!listErr) {
      const userExists = existingUserList.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
      if (userExists) {
        return NextResponse.json({ error: 'User already exists' }, { status: 409 });
      }
    }

    // Create auth user (same as before)
    const names = parseNames(userData);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...userData,
        // ensure metadata also has the normalized names
        first_name: names.firstName,
        last_name: names.lastName,
      },
    });

    if (error) {
      // If this throws “user already registered”, surface same 409 you used before
      if ((error as any)?.message?.toLowerCase?.().includes('already registered')) {
        return NextResponse.json({ error: 'User already exists' }, { status: 409 });
      }
      console.error('Error creating user:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const userId = data.user.id;
    const firstName = names.firstName;
    const lastName = names.lastName;

    // IMPORTANT: allow aryeo id from payload; fallback to previous behavior (userId) to avoid breaking old flows
    const userAryeoId = userData?.user_aryeo_id ?? userId;

    // Generate referral code (same logic as before)
    const referralCode = generateReferralCode();

    // ---- DB writes (idempotent-ish) --------------------------------------

    // 1) approved_users: activate or insert
    {
      const { error: approveError } = await supabaseAdmin
        .from('approved_users')
        .upsert(
          {
            user_id: userId,
            user_email: email.toLowerCase(),
            approved_by: 'admin',
            status: 'active',
            notes: userData?.notes ?? 'Created via admin interface',
          },
          { onConflict: 'user_id' }
        );

      if (approveError) {
        console.error('Error upserting approved_users record:', approveError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 });
      }
    }

    // 2) affiliate_profiles: insert or ignore if exists (keep original semantics)
    {
      const { error: profileError } = await supabaseAdmin
        .from('affiliate_profiles')
        .insert({
          user_id: userId,
          user_aryeo_id: userAryeoId, // now honoring payload value
          user_email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          avatar_url: userData?.avatar_url || userData?.picture || null,
          social_links: {},
          notifications: {
            email_reports: true,
            sms_alerts: false,
            push_notifications: true,
          },
        })
        .select('id')
        .maybeSingle(); // tolerate existing

      // If it already exists due to a retry, we don’t treat as fatal
      if (profileError && profileError.code !== '23505') {
        console.error('Error creating affiliate_profiles record:', profileError);
        // Clean up
        await supabaseAdmin.auth.admin.deleteUser(userId);
        await supabaseAdmin.from('approved_users').delete().eq('user_id', userId);
        return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
      }
    }

    // 3) affiliate_referrers: insert unique code; if unique conflict, try a couple times
    {
      let created = false;
      let attempts = 0;
      let lastErr: any = null;

      while (!created && attempts < 3) {
        attempts += 1;
        const code = attempts === 1 ? referralCode : generateReferralCode();
        const { error: referralError } = await supabaseAdmin
          .from('affiliate_referrers')
          .insert({ user_id: userId, code });

        if (!referralError) {
          created = true;
        } else if (referralError.code === '23505') {
          // unique violation -> try again with a new code
          lastErr = referralError;
          continue;
        } else {
          lastErr = referralError;
          break;
        }
      }

      if (!created) {
        console.error('Error creating affiliate_referrers record:', lastErr);
        // Clean up
        await supabaseAdmin.auth.admin.deleteUser(userId);
        await supabaseAdmin.from('approved_users').delete().eq('user_id', userId);
        await supabaseAdmin.from('affiliate_profiles').delete().eq('user_id', userId);
        return NextResponse.json({ error: 'Failed to create referral code' }, { status: 500 });
      }
    }

    // 4) dashboard_kpis: insert or ignore if exists
    {
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
        })
        .select('user_id')
        .maybeSingle(); // tolerate existing

      if (kpiError && kpiError.code !== '23505') {
        console.error('Error creating dashboard_kpis record:', kpiError);
        // Clean up
        await supabaseAdmin.auth.admin.deleteUser(userId);
        await supabaseAdmin.from('approved_users').delete().eq('user_id', userId);
        await supabaseAdmin.from('affiliate_profiles').delete().eq('user_id', userId);
        await supabaseAdmin.from('affiliate_referrers').delete().eq('user_id', userId);
        return NextResponse.json({ error: 'Failed to create dashboard KPIs' }, { status: 500 });
      }
    }

    // success (response shape unchanged)
    console.log('Successfully created user with all required records:', {
      userId,
      email,
    });

    return NextResponse.json({
      user: data.user,
      referralCode, // original variable (note: actual stored code may differ if we retried)
      message: 'User created successfully with all required records',
    });
  } catch (error: any) {
    console.error('Error in create-user API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
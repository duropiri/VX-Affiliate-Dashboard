import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try affiliate_profiles first
  const { data: profile, error } = await supabaseAdmin
    .from("affiliate_profiles")
    .select("user_id, user_email, first_name, last_name, avatar_url, social_links, notifications")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (profile) {
    return NextResponse.json({ profile });
  }

  // Fallback to next_auth.users for a basic name/email
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("next_auth.users")
    .select("name, email")
    .eq("id", userId)
    .maybeSingle();

  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  const fullName = userRow?.name || (userRow?.email || "").split("@")[0];
  const firstName = fullName?.split(" ")?.[0] || "User";
  const lastName = fullName?.split(" ")?.slice(1).join(" ") || "Name";

  return NextResponse.json({
    profile: {
      user_id: userId,
      user_email: (userRow?.email || "").toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      avatar_url: null,
      social_links: {},
      notifications: {
        email_reports: true,
        sms_alerts: false,
        push_notifications: true,
      },
    },
  });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();

  const payload = {
    user_id: userId,
    user_aryeo_id: body.user_aryeo_id || userId,
    user_email: (body.user_email || (session?.user as any)?.email || "").toLowerCase(),
    first_name: body.first_name,
    last_name: body.last_name,
    avatar_url: body.avatar_url || null,
    social_links: body.social_links || {},
    notifications: body.notifications || {
      email_reports: true,
      sms_alerts: false,
      push_notifications: true,
    },
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("affiliate_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id, user_email, first_name, last_name, avatar_url, social_links, notifications")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}



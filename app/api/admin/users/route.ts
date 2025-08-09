import { NextResponse } from "next/server";
import { resolveExternalUser } from "@/app/api/utils/resolve-user";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const ext = await resolveExternalUser(request);
  const email = ext?.email?.toLowerCase() || "";
  // Basic admin guard (adjust as needed)
  if (!email.endsWith("@virtualxposure.com")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1) Load approved users
  const { data: approved, error: approvedErr } = await supabaseAdmin
    .from("approved_users")
    .select("id, user_id, user_email, status, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (approvedErr) {
    return NextResponse.json({ error: approvedErr.message }, { status: 500 });
  }
  if (!approved || approved.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const userIds = approved.map((u) => u.user_id);

  // 2) Load profiles
  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from("affiliate_profiles")
    .select("user_id, first_name, last_name")
    .in("user_id", userIds);
  if (profilesErr) {
    return NextResponse.json({ error: profilesErr.message }, { status: 500 });
  }

  // 3) Load referral codes
  const { data: referrers, error: refErr } = await supabaseAdmin
    .from("affiliate_referrers")
    .select("user_id, code")
    .in("user_id", userIds);
  if (refErr) {
    return NextResponse.json({ error: refErr.message }, { status: 500 });
  }

  const profilesMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  const refMap = new Map((referrers || []).map((r: any) => [r.user_id, r]));

  const users = approved.map((u: any) => {
    const p = profilesMap.get(u.user_id);
    const r = refMap.get(u.user_id);
    return {
      id: u.id,
      user_id: u.user_id,
      user_email: u.user_email,
      first_name: p?.first_name || "Unknown",
      last_name: p?.last_name || "User",
      status: u.status,
      created_at: u.created_at,
      referral_code: r?.code || null,
    };
  });

  return NextResponse.json({ users });
}



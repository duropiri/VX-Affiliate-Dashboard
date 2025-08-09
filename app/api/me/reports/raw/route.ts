import { NextResponse } from "next/server";
import { resolveExternalUser } from "@/app/api/utils/resolve-user";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const ext = await resolveExternalUser(request);
  const userId = ext?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("dashboard_kpis")
    .select("user_reports, user_referrals")
    .eq("user_id", userId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    user_reports: data?.user_reports ?? null,
    user_referrals: data?.user_referrals ?? null,
  });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";



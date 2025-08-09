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

  const { data, error } = await supabaseAdmin
    .from("dashboard_kpis")
    .select("user_reports")
    .eq("user_id", userId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const overview = data?.user_reports?.overview || {};
  let clicks = 0;
  let referrals = 0;
  let customers = 0;
  let earnings = 0;

  Object.values(overview).forEach((dayData: any) => {
    clicks += dayData?.clicks || 0;
    referrals += dayData?.signups || 0;
    customers += dayData?.customers || 0;
    earnings += dayData?.earnings || 0;
  });

  return NextResponse.json({ clicks, referrals, customers, earnings });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";



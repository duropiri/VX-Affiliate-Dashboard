import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ code: null });
  const { data, error } = await supabaseAdmin
    .from("affiliate_referrers")
    .select("code")
    .eq("user_id", userId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ code: data?.code || null });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";



import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const email = (session?.user as any)?.email as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const desired = (body?.token || "") as string;
  const normalized = desired
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  if (!normalized || normalized.length < 3 || normalized.length > 32) {
    return NextResponse.json({ error: "Token must be 3-32 chars (a-z, 0-9, _ or -)" }, { status: 400 });
  }

  // Check if taken
  const { data: takenBy, error: checkErr } = await supabaseAdmin
    .from("affiliate_referrers")
    .select("user_id")
    .eq("code", normalized)
    .maybeSingle();
  if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 });
  if (takenBy && takenBy.user_id !== userId) {
    return NextResponse.json({ error: "That token is already taken" }, { status: 409 });
  }

  // Upsert
  const { data, error } = await supabaseAdmin
    .from("affiliate_referrers")
    .upsert({ user_id: userId, code: normalized }, { onConflict: "user_id" })
    .select("code")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, code: data?.code || normalized });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";



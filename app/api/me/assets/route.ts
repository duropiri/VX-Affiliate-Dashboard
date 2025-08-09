import { NextResponse } from "next/server";
import { resolveExternalUser } from "@/app/api/utils/resolve-user";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const ext = await resolveExternalUser(request);
  if (!ext?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("affiliate_assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assets: data || [] });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";



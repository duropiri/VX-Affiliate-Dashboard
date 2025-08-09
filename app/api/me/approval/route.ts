import { NextResponse } from "next/server";
import { resolveExternalUser } from "@/app/api/utils/resolve-user";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const ext = await resolveExternalUser(request);
  const userId = ext?.id as string | undefined;
  if (!userId) return NextResponse.json({ approved: false }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("approved_users")
    .select("user_id, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ approved: !!data });
}



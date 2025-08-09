import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveExternalUser } from "@/app/api/utils/resolve-user";

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const ext = await resolveExternalUser(request);
  if (!ext?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = context.params.id;
  const { error } = await supabaseAdmin
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("user_id", ext.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";



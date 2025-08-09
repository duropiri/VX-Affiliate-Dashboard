import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveExternalUser } from "@/app/api/utils/resolve-user";
import { generatePersonalAccessToken, hashPersonalAccessToken } from "@/lib/token";

// Create table (SQL reference):
// create table if not exists public.api_keys (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid not null references next_auth.users(id) on delete cascade,
//   name text not null,
//   token_hash text not null unique,
//   active boolean not null default true,
//   expires_at timestamptz null,
//   last_used_at timestamptz null,
//   created_at timestamptz not null default now()
// );
// create index if not exists idx_api_keys_user on public.api_keys(user_id);

export async function GET(request: Request) {
  const ext = await resolveExternalUser(request);
  if (!ext?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, name, active, expires_at, last_used_at, created_at")
    .eq("user_id", ext.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tokens: data || [] });
}

export async function POST(request: Request) {
  const ext = await resolveExternalUser(request);
  if (!ext?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({} as any));
  const name = (body?.name as string) || "Personal Access Token";
  const expiresAt = body?.expires_at ? new Date(body.expires_at) : null;

  const token = generatePersonalAccessToken();
  const tokenHash = hashPersonalAccessToken(token);

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({ user_id: ext.id, name, token_hash: tokenHash, active: true, expires_at: expiresAt })
    .select("id, name, active, expires_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // return plaintext token ONCE; clients must store it securely
  return NextResponse.json({ token, key: data });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";



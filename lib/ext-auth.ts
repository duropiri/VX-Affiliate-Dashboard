import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashPersonalAccessToken } from "@/lib/token";

export interface ExtAuthUser {
  id: string;
  email?: string | null;
}

/**
 * Resolve authenticated user for external API routes.
 * - Prefers NextAuth server session (cookies)
 * - Falls back to Authorization: Bearer <next-auth session token>
 */
export async function resolveUser(req: Request): Promise<ExtAuthUser | null> {
  // Try cookie-based session first
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as any)?.id as string | undefined;
    if (sessionUserId) {
      return { id: sessionUserId, email: (session?.user as any)?.email ?? null };
    }
  } catch {}

  // Try Bearer token (NextAuth JWT) in Authorization header
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    // 2a) If it looks like a PAT, validate against api_keys
    if (bearer.startsWith("pat_")) {
      const hash = hashPersonalAccessToken(bearer);
      const { data, error } = await supabaseAdmin
        .from("api_keys")
        .select("user_id, active, expires_at")
        .eq("token_hash", hash)
        .maybeSingle();
      if (!error && data && data.active !== false && (!data.expires_at || new Date(data.expires_at) > new Date())) {
        return { id: data.user_id, email: null };
      }
    }
    // 2b) Otherwise treat it as a NextAuth JWT
    const nextReq = new NextRequest(req.url, { headers: req.headers });
    const token = await getToken({ req: nextReq, secret: process.env.NEXTAUTH_SECRET });
    const userId = token?.sub as string | undefined;
    if (userId) {
      return { id: userId, email: (token?.email as string | undefined) ?? null };
    }
  }

  return null;
}



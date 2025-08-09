import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function getBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json().catch(() => ({ email: undefined }));
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalized = email.trim().toLowerCase();

    // Verify that the user exists in NextAuth users table (to avoid sending for unknown emails)
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("next_auth.users")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (userErr) {
      console.error("Password reset lookup error:", userErr);
      return NextResponse.json(
        { error: userErr.message || "Lookup failed" },
        { status: 500 }
      );
    }

    if (!userRow) {
      // Email not found — report 404 so client can show an appropriate message
      return NextResponse.json(
        { error: "No account found for that email" },
        { status: 404 }
      );
    }

    const redirectTo = `${getBaseUrl()}/auth/reset-password`;
    const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(
      normalized,
      { redirectTo }
    );

    if (resetErr) {
      console.error("Password reset send error:", resetErr);
      return NextResponse.json(
        { error: resetErr.message || "Failed to send reset email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Password reset request error:", e);
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";



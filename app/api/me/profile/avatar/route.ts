import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = process.env.NEXT_PUBLIC_AVATARS_BUCKET || "avatars";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const email = (session?.user as any)?.email as string | undefined;

  if (!userId || !email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file") as unknown as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const originalName = (file as any).name || "avatar.png";
    const extFromName = originalName.includes(".") ? originalName.split(".").pop() : undefined;
    const extension = extFromName || (file.type?.split("/")[1] ?? "png");
    const fileName = `${Date.now()}-${sanitizeFileName(originalName)}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage using service role
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type || `image/${extension}`,
        upsert: true,
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get a public URL (assumes bucket is public); if not public, this still returns a signed-like URL
    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
    const avatarUrl = publicUrlData.publicUrl;

    // Update profile avatar_url
    const { data: existing, error: findErr } = await supabaseAdmin
      .from("affiliate_profiles")
      .select("id, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (findErr) {
      console.error("Profile lookup error:", findErr);
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }

    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from("affiliate_profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (updateErr) {
        console.error("Profile avatar update error:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      // Create minimal profile row with required fields
      const fullName = (session?.user as any)?.name || "User Name";
      const [firstName, ...rest] = fullName.split(" ");
      const lastName = rest.join(" ") || "User";
      const { error: insertErr } = await supabaseAdmin.from("affiliate_profiles").insert({
        user_id: userId,
        user_aryeo_id: userId,
        user_email: email,
        first_name: firstName || "User",
        last_name: lastName || "Name",
        avatar_url: avatarUrl,
        social_links: {},
        notifications: { email_reports: true, sms_alerts: false, push_notifications: true },
      });
      if (insertErr) {
        console.error("Profile insert (avatar) error:", insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ avatarUrl });
  } catch (e: any) {
    console.error("Avatar upload handler error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";



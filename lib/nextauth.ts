import type { AuthOptions, Session } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import type { JWT } from "next-auth/jwt";
import { createClient } from "@supabase/supabase-js";

export const authOptions: AuthOptions = {
  adapter: SupabaseAdapter({
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY || "", // server-only
  }),
  providers: [
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password || "";

        if (!email || !password) return null;

        // Verify credentials against Supabase Auth
        const supabase = createClient(
          process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          process.env.SUPABASE_ANON_KEY || ""
        );

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data?.user) {
          return null;
        }

        // Check approval in application DB (server key)
        const admin = createClient(
          process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          process.env.SUPABASE_SERVICE_ROLE_KEY || ""
        );
        const { data: approvedRow, error: approvedErr } = await admin
          .from("approved_users")
          .select("user_id,status")
          .eq("user_id", data.user.id)
          .eq("status", "active")
          .maybeSingle();
        if (approvedErr || !approvedRow) {
          // Deny login if not approved
          return null;
        }

        // Return user object for JWT session
        return {
          id: data.user.id,
          email: data.user.email || email,
          name: (data.user.user_metadata as any)?.full_name || email.split("@")[0],
          image:
            (data.user.user_metadata as any)?.avatar_url ||
            (data.user.user_metadata as any)?.picture ||
            null,
        } as any;
      },
    }),
    EmailProvider({
      server:
        process.env.EMAIL_SERVER ||
        ({
          host: process.env.EMAIL_SERVER_HOST,
          port: process.env.EMAIL_SERVER_PORT
            ? Number(process.env.EMAIL_SERVER_PORT)
            : 587,
          secure: process.env.EMAIL_SERVER_SECURE === "true",
          auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          },
        } as any),
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as any).id = token.sub ?? undefined;
      }
      return session;
    },
  },
  logger: {
    error: (...args: unknown[]) => console.error("[NextAuth Error]", ...args),
    warn: (...args: unknown[]) => console.warn("[NextAuth Warn]", ...args),
    debug: (...args: unknown[]) => console.log("[NextAuth Debug]", ...args),
  },
};



"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  createUserProfile,
  createReferralCode,
  getUserProfile,
  isUserApproved,
  handlePostAuth,
} from "@/lib/auth";
import { addToast, Spinner } from "@heroui/react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState<boolean>(false);
  const router = useRouter();

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("AuthGuard loading timeout - redirecting to auth");
        console.warn(
          "Timeout details - loading:",
          loading,
          "user:",
          !!user,
          "approved:",
          approved
        );
        setLoading(false);
        router.push("/auth");
      }
    }, 30000); // Increased to 30 second timeout for production

    return () => clearTimeout(timeout);
  }, [loading, router]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth");
          return;
        }

        // Check if user is approved (simplified for speed)
        console.log("Checking user approval for:", user.email, "ID:", user.id);

        // Check user approval with increased timeout for production
        let isApproved = false;
        try {
          const approvalPromise = isUserApproved(user.id);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Approval check timeout")),
              15000
            ); // Increased to 15 seconds
          });

          isApproved = (await Promise.race([
            approvalPromise,
            timeoutPromise,
          ])) as boolean;
          console.log("User approval result:", isApproved);
        } catch (error) {
          console.error("Approval check error:", error);
          // Don't immediately redirect on timeout, try a simpler check
          try {
            // Try a simpler query as fallback
            const { data, error } = await supabase
              .from("approved_users")
              .select("user_id")
              .eq("user_id", user.id)
              .eq("status", "active")
              .limit(1);

            isApproved = !error && data && data.length > 0;
            console.log("Fallback approval check result:", isApproved);
          } catch (fallbackError) {
            console.error("Fallback approval check failed:", fallbackError);
            isApproved = false;
          }
        }

        if (!isApproved) {
          console.log("❌ User not approved, redirecting to auth");
          setUser(null);
          setLoading(false);
          router.push("/auth");
          addToast({
            title: "User not approved",
            color: "danger",
          });
          return;
        }

        console.log("✅ User is approved, proceeding to dashboard");

        // Set user and approval status immediately
        setUser(user);
        setApproved(true);
        setLoading(false);

        // Try to set up user profile in background (non-blocking)
        setTimeout(async () => {
          try {
            const profile = await getUserProfile(user.id);
            if (!profile) {
              console.log("Creating user profile...");
              await createUserProfile(user);
              await createReferralCode(user.id);
              console.log("User profile created successfully");
            }
          } catch (error) {
            console.error(
              "Error setting up user profile (non-critical):",
              error
            );
            // Don't block the user from accessing the app if profile creation fails
          }
        }, 1000); // Delay profile creation to not block rendering
      } catch (error) {
        console.error("Error checking user:", error);
        router.push("/auth");
      }
    };

    checkUser();
  }, [router]);

  // Listen for auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session?.user?.email);

      if (event === "SIGNED_IN" && session?.user) {
        console.log(
          "Auth state change - checking user approval for:",
          session.user.email,
          "ID:",
          session.user.id
        );

        try {
          // Handle post-auth processing
          const approved = await handlePostAuth(session.user);
          console.log(
            "Auth state change - Final user approval status:",
            approved
          );

          if (approved) {
            console.log(
              "About to check if user is approved from auth state change. isApproved =",
              approved
            );
            setUser(session.user);
            setApproved(true);
            setLoading(false);
            console.log(
              "✅ User is approved from auth state change, proceeding to dashboard"
            );
            // Force a router push to ensure navigation
            router.push("/home");
          } else {
            console.log(
              "❌ User not approved from auth state change, redirecting to auth"
            );
            setUser(null);
            setLoading(false);
            router.push("/auth");
          }
        } catch (error) {
          console.error("Auth state change - Approval check error:", error);

          // Try email cross-reference for Google SSO
          if (session.user.app_metadata?.provider === "google") {
            console.log("Auth state change - User provider: google");
            try {
              const { data, error } = await supabase
                .from("approved_users")
                .select("*")
                .eq("user_email", session.user.email)
                .eq("status", "active")
                .single();

              console.log("Email approval check result:", {
                approvedUser: data,
                approvalError: error,
              });

              if (error && error.code !== "PGRST116") {
                console.error("Error checking approval by email:", error);
              } else if (data) {
                console.log(
                  "User approved by email cross-reference, updating user_id"
                );

                // Update the approval record with the new user ID
                const { error: updateError } = await supabase
                  .from("approved_users")
                  .update({ user_id: session.user.id })
                  .eq("user_email", session.user.email);

                if (updateError) {
                  console.error("Error updating approval record:", updateError);
                } else {
                  console.log(
                    "Successfully updated approval record with new user ID"
                  );
                }

                setUser(session.user);
                setApproved(true);
                setLoading(false);
                console.log("✅ User approved by email cross-reference");
                router.push("/home");
                return;
              }
            } catch (emailError) {
              console.error(
                "Auth state change - Email approval check error:",
                emailError
              );
            }
          }

          console.log(
            "❌ User not approved from auth state change, redirecting to auth"
          );
          setUser(null);
          setLoading(false);
          router.push("/auth");
        }
      } else if (event === "SIGNED_OUT") {
        console.log("User signed out");
        setUser(null);
        setApproved(false);
        setLoading(false);
        router.push("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  console.log(
    "AuthGuard render - loading:",
    loading,
    "user:",
    !!user,
    "approved:",
    approved
  );

  if (loading) {
    console.log("AuthGuard showing loading spinner");
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          classNames={{ label: "text-foreground mt-4" }}
          variant="default"
          size="lg"
          color="primary"
        />
        {/* <p className="mt-4 text-gray-600">Loading...</p> */}
      </div>
    );
  }

  if (!user || !approved) {
    console.log(
      "AuthGuard returning null - user:",
      !!user,
      "approved:",
      approved
    );
    return null;
  }

  console.log("AuthGuard rendering children");
  return <>{children}</>;
}

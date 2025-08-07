"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { handlePostAuth, signOut } from "@/lib/auth";
import { Spinner } from "@heroui/react";

export default function Callback() {
  const router = useRouter();
  const [status, setStatus] = useState<
    "loading" | "checking" | "approved" | "error"
  >("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const checkApproval = async () => {
      try {
        setStatus("checking");
        console.log("Checking user session...");

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error);
          setError(error.message);
          setStatus("error");
          return;
        }

        if (!session?.user) {
          console.error("No session found");
          setError("No session found");
          setStatus("error");
          return;
        }

        console.log(
          "Session found, checking approval for:",
          session.user.email
        );

        // Run our DB-approval logic
        const approved = await handlePostAuth(session.user);

        if (!approved) {
          console.log("User not approved, signing out");
          await signOut();
          setStatus("error");
          setError("User not approved");
          // Redirect to auth page with error
          setTimeout(() => {
            router.push("/auth?error=not-approved");
          }, 2000);
          return;
        }

        console.log("User approved, redirecting to dashboard");
        setStatus("approved");
        // Approved → send to dashboard
        router.push("/home");
      } catch (error) {
        console.error("Callback error:", error);
        setError(error instanceof Error ? error.message : "Unknown error");
        setStatus("error");
      }
    };

    checkApproval();
  }, [router]);

  if (status === "loading") {
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

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          classNames={{ label: "text-foreground mt-4" }}
          variant="default"
          size="lg"
          color="warning"
        />
        {/* <p className="mt-4 text-gray-600">Checking user approval...</p> */}
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          classNames={{ label: "text-foreground mt-4" }}
          variant="default"
          size="lg"
          color="success"
        />
        {/* <p className="mt-4 text-gray-600">Redirecting to dashboard...</p> */}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Redirecting to sign-in page...
          </p>
        </div>
      </div>
    );
  }

  return null;
}

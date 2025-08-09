"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addToast, Spinner } from "@heroui/react";
import { useSession } from "next-auth/react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [approved, setApproved] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Global timeout safety
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status !== "authenticated") {
        router.replace("/auth");
      }
    }, 30000);
    return () => clearTimeout(timeout);
  }, [status, router]);

  // Redirect unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      router.replace("/auth");
    }
  }, [status, router]);

  // Check approval when authenticated
  useEffect(() => {
    const checkApproval = async () => {
      if (status !== "authenticated") return;
      try {
        const res = await fetch("/api/me/approval", { cache: "no-store" });
        if (!res.ok) throw new Error("Approval check failed");
        const json = await res.json();
        if (!json.approved) {
          addToast({
            title: "Access Denied",
            description: "Your account is not approved. Please contact an administrator.",
            color: "danger",
          });
          router.replace("/auth");
          setApproved(false);
        } else {
          setApproved(true);
        }
      } catch (e) {
        router.replace("/auth");
      } finally {
        setLoading(false);
      }
    };
    checkApproval();
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          classNames={{ label: "text-foreground mt-4" }}
          variant="default"
          size="lg"
          color="primary"
        />
      </div>
    );
  }

  if (!session || !approved) {
    return null;
  }

  return <>{children}</>;
}

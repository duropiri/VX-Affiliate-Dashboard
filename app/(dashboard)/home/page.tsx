"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ReferralCard } from "@/components/referral-card";
import { StatsBar } from "@/components/stats-bar";
import { Card, CardBody, CardHeader, Link, Spinner, Button } from "@heroui/react";
import { CheckCircle, Circle, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getUserProfile, getReferralCode, calculateUserReportsTotals, getUserReports, getUser } from "@/lib/auth";
import { subscribeToUserKpis } from "@/lib/realtime";
import { addToast } from "@heroui/toast";

export default function HomePage() {
  const pathname = usePathname();
  const [referralCode, setReferralCode] = useState<string>("");
  const [kpis, setKpis] = useState({
    clicks: 0,
    referrals: 0,
    customers: 0,
    earnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Reset loading state on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
  }, []);

  const loadData = async (force: boolean = false) => {
    try {
      console.log("🔄 Loading dashboard data...");
      setLoading(true);
      setError(null);

      console.log("🔍 Getting user from Supabase...");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("👤 User:", user?.email, "ID:", user?.id);

      if (!user) {
        throw new Error("No authenticated user found");
      }

      console.log("✅ User found, loading data...");

      // Load data in parallel
      console.log("📊 Starting data queries...");

      const [referralCodeResult, kpiResult] = await Promise.allSettled([
        getReferralCode(user.id),
        calculateUserReportsTotals({ force }),
      ]);

      console.log("📈 Query results:", { referralCodeResult, kpiResult });

      // Handle referral code
      if (referralCodeResult.status === "fulfilled") {
        const code = referralCodeResult.value;
        if (code) {
          setReferralCode(code);
          console.log("🎯 Referral code:", code);
        } else {
          // No referral code found - this is a valid state
          setReferralCode("");
          console.log("No referral code found for user");
        }
      } else {
        console.error("❌ Error loading referral code:", referralCodeResult.reason);
        throw new Error(`Failed to load referral code: ${referralCodeResult.reason}`);
      }

      // Handle KPIs from user_reports totals
      if (kpiResult.status === "fulfilled") {
        setKpis(kpiResult.value);
        console.log("📊 KPIs loaded from user_reports:", kpiResult.value);
      } else {
        console.error("❌ Error loading KPIs from user_reports:", kpiResult.reason);
        throw new Error(`Failed to load user reports: ${kpiResult.reason}`);
      }
    } catch (error) {
      console.error("💥 Error loading dashboard data:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setError(errorMessage);
      addToast({
        title: "Error Loading Data",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("🚀 Starting loadData function");
    loadData(true);
  }, []);

  // Option B: re-fetch on navigation/focus/online, bypassing cache
  useEffect(() => {
    const revalidate = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // Force-refresh key dashboard data derived from user_reports
        await getUserReports("Last 30 Days", { force: true } as any);
        // Then reload the lightweight aggregates displayed here
        await loadData(true);
      } catch (e) {
        console.warn("Revalidate failed", e);
      }
    };

    // Route change revalidate (app router: usePathname changes)
    revalidate();

    const onVisibility = () => {
      if (!document.hidden) revalidate();
    };
    const onOnline = () => revalidate();

    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [pathname]);

  // Realtime subscription for dashboard KPIs
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const user = await getUser();
      if (!user) return;
      // Initial forced refresh
      await getUserReports("Last 30 Days", { force: true } as any);
      await loadData(true);
      unsub = subscribeToUserKpis(user.id, async () => {
        await getUserReports("Last 30 Days", { force: true } as any);
        await loadData(true);
      });
    })();
    return () => { unsub?.(); };
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    await loadData(true);
    setRetrying(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          classNames={{ label: "text-foreground mt-4" }}
          variant="default"
          size="lg"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <div className="text-gray-500 mb-6">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Error Loading Dashboard Data
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button
              color="primary"
              variant="flat"
              startContent={<RefreshCw size={16} />}
              onPress={handleRetry}
              isLoading={retrying}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ReferralCard referralCode={referralCode} />
      <StatsBar
        clicks={kpis.clicks}
        referrals={kpis.referrals}
        customers={kpis.customers}
        earnings={kpis.earnings}
      />
      <div className="affiliate-panel rounded-xl mx-auto relative overflow-hidden w-full">
        <div className="px-4 sm:px-6 pt-4 pb-1">
          <div className="flex justify-between items-center flex-wrap sm:flex-nowrap">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                START HERE (IMPORTANT):
              </h3>
            </div>
          </div>
        </div>
        <div className="text-sm px-4 sm:px-6 pb-2">
          <div className="fr-view ql-editor pb-2">
            <p>
              <strong>Top Leaderboard:</strong>
            </p>
            <p>
              - The top affiliates will be posted here &amp; updated weekly to
              see where you&nbsp;rank:
            </p>
            <p>
              <span className="text-nowrap">
                -{" "}
                <Link
                  href="https://try.virtualxposure.com/pages/affiliate/leaderboard"
                  underline="hover"
                  color="primary" 
                  className="text-wrap"
                >
                  https://try.virtualxposure.com/pages/affiliate/leaderboard
                </Link>
              </span>
              <br />
              <br />
              To see all <strong>prizes</strong>, go here:
              <br />
              <span className="text-nowrap">
                -{" "}
                <Link
                  href="https://try.virtualxposure.com/pages/affiliate-program"
                  underline="hover"
                  color="primary"
                  className="text-wrap"
                >
                  https://try.virtualxposure.com/pages/affiliate-program
                </Link>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

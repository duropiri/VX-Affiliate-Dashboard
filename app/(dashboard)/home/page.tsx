"use client";

import { useEffect, useState } from "react";
import { ReferralCard } from "@/components/referral-card";
import { StatsBar } from "@/components/stats-bar";
import { Card, CardBody, CardHeader, Link, Spinner, Button } from "@heroui/react";
import { CheckCircle, Circle, RefreshCw } from "lucide-react";
import { supabase, optimizedQuery } from "@/lib/supabase";
import {
  getUserProfile,
  getReferralCode,
  calculateUserReportsTotals,
  refreshUserData,
} from "@/lib/auth";

export default function HomePage() {
  const [referralCode, setReferralCode] = useState<string>("");
  const [kpis, setKpis] = useState({
    clicks: 0,
    referrals: 0,
    customers: 0,
    earnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Reset loading state on mount
  useEffect(() => {
    setLoading(true);
  }, []);

  const loadData = async (forceRefresh = false) => {
    try {
      console.log("🔄 Loading dashboard data...", forceRefresh ? "(forced refresh)" : "");
      setLoading(true);

      console.log("🔍 Getting user from Supabase...");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("👤 User:", user?.email, "ID:", user?.id);

      if (!user) {
        console.log("❌ No user found");
        return;
      }

      console.log("✅ User found, loading data...");

      // Force refresh data if requested
      if (forceRefresh) {
        console.log("🔄 Forcing data refresh...");
        await refreshUserData(user.id);
      }

      // Load data in parallel with optimized queries
      console.log("📊 Starting optimized data queries...");

      // Use optimized queries for better production performance
      const [referralCodeResult, kpiResult] = await Promise.allSettled([
        optimizedQuery(async () => getReferralCode(user.id), 15000), // 15 second timeout
        optimizedQuery(async () => calculateUserReportsTotals(), 15000), // 15 second timeout
      ]);

      console.log("📈 Query results:", { referralCodeResult, kpiResult });

      // Handle referral code
      if (referralCodeResult.status === "fulfilled") {
        setReferralCode(referralCodeResult.value || "");
        console.log("🎯 Referral code:", referralCodeResult.value);
      } else {
        console.error(
          "❌ Error loading referral code:",
          referralCodeResult.reason
        );
        // Set a default referral code if none exists
        setReferralCode("VX-" + user.id.slice(0, 8).toUpperCase());
      }

      // Handle KPIs from user_reports totals
      if (kpiResult.status === "fulfilled") {
        setKpis(kpiResult.value);
        console.log("📊 KPIs loaded from user_reports:", kpiResult.value);
      } else {
        console.error(
          "❌ Error loading KPIs from user_reports:",
          kpiResult.status === "rejected" ? kpiResult.reason : "No data"
        );
        // Set default KPIs if none exist
        setKpis({ clicks: 0, referrals: 0, customers: 0, earnings: 0 });
      }
    } catch (error) {
      console.error("💥 Error loading dashboard data:", error);
      // Set default values on error
      setReferralCode("VX-DEFAULT");
      setKpis({ clicks: 0, referrals: 0, customers: 0, earnings: 0 });
    } finally {
      console.log("🏁 Setting loading to false");
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true); // Force refresh
    setRefreshing(false);
  };

  useEffect(() => {
    console.log("🚀 HomePage useEffect triggered");
    let isMounted = true;

    console.log("🚀 Starting loadData function");

    // Add a longer timeout for production
    const timeoutId = setTimeout(() => {
      console.log("⏰ Loading timeout reached - forcing completion");
      if (isMounted) {
        setLoading(false);
        setReferralCode("VX-TIMEOUT");
        setKpis({ clicks: 0, referrals: 0, customers: 0, earnings: 0 });
      }
    }, 20000); // Increased to 20 second timeout for production

    loadData().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      console.log("🧹 HomePage useEffect cleanup");
      clearTimeout(timeoutId);
      isMounted = false;
    };
  }, []);

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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button
          color="primary"
          variant="flat"
          size="sm"
          onPress={handleRefresh}
          isLoading={refreshing}
          startContent={<RefreshCw size={16} />}
        >
          Refresh Data
        </Button>
      </div>
      
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
                  href="https://affiliate.virtualxposure.com/pages/leaderboard"
                  underline="hover"
                  color="primary"
                  className="text-wrap"
                >
                  https://affiliate.virtualxposure.com/pages/leaderboard
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

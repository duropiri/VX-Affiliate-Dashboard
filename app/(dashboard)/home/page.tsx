"use client";

import { useEffect, useState } from "react";
import { ReferralCard } from "@/components/referral-card";
import { StatsBar } from "@/components/stats-bar";
import { Card, CardBody, CardHeader, Link, Spinner } from "@heroui/react";
import { CheckCircle, Circle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getUserProfile,
  getReferralCode,
  calculateUserReportsTotals,
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

  // Reset loading state on mount
  useEffect(() => {
    setLoading(true);
  }, []);

  useEffect(() => {
    console.log("🚀 HomePage useEffect triggered");
    let isMounted = true;

    const loadData = async () => {
      try {
        console.log("🔄 Loading dashboard data...");
        setLoading(true);

        console.log("🔍 Getting user from Supabase...");
        const {
          data: { user },
        } = await supabase.auth.getUser();
        console.log("👤 User:", user?.email, "ID:", user?.id);

        if (!isMounted) {
          console.log("❌ Component unmounted, stopping");
          return;
        }

        if (user) {
          console.log("✅ User found, loading data...");

          // Load data in parallel without timeout
          console.log("📊 Starting data queries...");

          // Test database connection first
          console.log("🔍 Testing database connection...");

          // Test 1: Check if tables exist
          console.log("🔍 Test 1: Checking affiliate_referrers table...");
          const { data: testData1, error: testError1 } = await supabase
            .from("affiliate_referrers")
            .select("count")
            .limit(1);

          console.log("🔍 affiliate_referrers test:", {
            testData1,
            testError1,
          });

          // Test 2: Check if user has any data
          console.log("🔍 Test 2: Checking user referral data...");
          const { data: testData2, error: testError2 } = await supabase
            .from("affiliate_referrers")
            .select("*")
            .eq("user_id", user.id);

          console.log("🔍 User referral data test:", { testData2, testError2 });

          // Test 3: Check dashboard_kpis
          console.log("🔍 Test 3: Checking user KPIs...");
          const { data: testData3, error: testError3 } = await supabase
            .from("dashboard_kpis")
            .select("*")
            .eq("user_id", user.id);

          console.log("🔍 User KPIs test:", { testData3, testError3 });

          console.log("🔍 Starting main data queries...");
          const [referralCodeResult, kpiResult] = await Promise.allSettled([
            getReferralCode(user.id),
            calculateUserReportsTotals(),
          ]);

          if (!isMounted) {
            console.log("❌ Component unmounted during queries, stopping");
            return;
          }

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
        } else {
          console.log("❌ No user found");
        }
      } catch (error) {
        console.error("💥 Error loading dashboard data:", error);
        if (isMounted) {
          // Set default values on error
          setReferralCode("VX-DEFAULT");
          setKpis({ clicks: 0, referrals: 0, customers: 0, earnings: 0 });
        }
      } finally {
        if (isMounted) {
          console.log("🏁 Setting loading to false");
          setLoading(false);
        }
      }
    };

    console.log("🚀 Starting loadData function");

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log("⏰ Loading timeout reached - forcing completion");
      if (isMounted) {
        setLoading(false);
        setReferralCode("VX-TIMEOUT");
        setKpis({ clicks: 0, referrals: 0, customers: 0, earnings: 0 });
      }
    }, 10000); // 10 second timeout

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

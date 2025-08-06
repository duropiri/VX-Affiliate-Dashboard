"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table";
import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { DownloadIcon, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addToast } from "@heroui/toast";

// Define the referral data structure
interface ReferralData {
  id: string;
  referral_email: string;
  referral_name: string;
  status: "pending" | "approved" | "rejected";
  referral_date: string;
  commission_earned?: number;
  notes?: string;
}

// Convert JSON data to ReferralEvent format for DataTable
const convertReferralData = (referralsJson: ReferralData[]): any[] => {
  return referralsJson.map((referral) => ({
    id: referral.id,
    agent: referral.referral_name,
    email: referral.referral_email,
    date: new Date(referral.referral_date).toLocaleDateString(),
    status: referral.status,
    referrer_id: "current-user", // This will be the current user's ID
    commission: referral.commission_earned || 0,
    notes: referral.notes || "",
  }));
};

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🚀 ReferralsPage useEffect triggered");
    let isMounted = true;

    const loadReferrals = async () => {
      try {
        console.log("🔄 Loading referrals data...");
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
          console.log("✅ User found, loading referrals...");

          // Test database connection first
          console.log("🔍 Testing database connection...");
          const { data: testData, error: testError } = await supabase
            .from("dashboard_kpis")
            .select("count")
            .limit(1);

          console.log("🔍 dashboard_kpis test:", { testData, testError });

          // Load referrals from dashboard_kpis.user_referrals
          console.log("🔍 Loading referrals from dashboard_kpis...");
          const { data, error } = await supabase
            .from("dashboard_kpis")
            .select("user_referrals")
            .eq("user_id", user.id)
            .single();

          console.log("🔍 Referrals query result:", { data, error });

          if (!isMounted) {
            console.log(
              "❌ Component unmounted during referrals load, stopping"
            );
            return;
          }

          if (data && data.user_referrals) {
            console.log("✅ Referrals data found:", data.user_referrals);

            // Handle the data - it might be a string or already an object
            let referralsData: ReferralData[];
            try {
              if (typeof data.user_referrals === "string") {
                // If it's a string, parse it
                referralsData = JSON.parse(
                  data.user_referrals
                ) as ReferralData[];
              } else {
                // If it's already an object, use it directly
                referralsData = data.user_referrals as ReferralData[];
              }
              console.log("✅ Processed referrals data:", referralsData);
            } catch (parseError) {
              console.error("❌ Error processing referrals data:", parseError);
              referralsData = [];
            }

            if (referralsData && referralsData.length > 0) {
              const convertedReferrals = convertReferralData(referralsData);
              setReferrals(convertedReferrals);
            } else {
              console.log("⚠️ No referrals found in data");
              setReferrals([]);
            }
          } else {
            console.log("⚠️ No referrals data found, using empty array");
            setReferrals([]);
          }
        } else {
          console.log("❌ No user found");
        }
      } catch (error) {
        console.error("💥 Error loading referrals data:", error);
        if (isMounted) {
          addToast({
            title: "Error loading referrals!",
            color: "danger",
          });
        }
      } finally {
        if (isMounted) {
          console.log("🏁 Setting loading to false");
          setLoading(false);
        }
      }
    };

    console.log("🚀 Starting loadReferrals function");

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log("⏰ Loading timeout reached - forcing completion");
      if (isMounted) {
        setLoading(false);
        setReferrals([]);
      }
    }, 10000); // 10 second timeout

    loadReferrals().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      console.log("🧹 ReferralsPage useEffect cleanup");
      clearTimeout(timeoutId);
      isMounted = false;
    };
  }, []);

  const downloadCSV = () => {
    const headers = ["Agent", "Email", "Date", "Status"];
    const csvContent = [
      headers.join(","),
      ...referrals.map((row) =>
        [row.agent, row.email, row.date, row.status].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "referrals.csv";
    a.click();
    URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Referrals</h1>
          <Button
            isIconOnly
            variant="light"
            className="text-gray-600"
            onPress={downloadCSV}
          >
            <DownloadIcon size={20} />
          </Button>
        </div>
        <DataTable data={referrals} />
      </div>
    </div>
  );
}

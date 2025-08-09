"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table";
import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { DownloadIcon, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
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
        const res = await fetch("/api/me/reports/raw", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const userReports = json?.user_reports;
        const userReferrals = json?.user_referrals;

        if (!isMounted) {
          console.log("❌ Component unmounted, stopping");
          return;
        }

        if (userReferrals || (userReports && userReports.links)) {
          const raw = userReferrals || userReports.links || [];
          let referralsData: ReferralData[] = [];
          try {
            if (Array.isArray(raw)) {
              referralsData = raw as ReferralData[];
            } else if (typeof raw === "string") {
              referralsData = JSON.parse(raw) as ReferralData[];
            } else if (typeof raw === "object") {
              referralsData = Object.values(raw) as any;
            }
          } catch (e) {
            referralsData = [];
          }

          if (referralsData.length > 0) {
            const converted = convertReferralData(referralsData);
            setReferrals(converted);
          } else {
            setReferrals([]);
          }
        } else {
          setReferrals([]);
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

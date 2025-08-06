"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Avatar,
  Switch,
  Divider,
  Spinner,
} from "@heroui/react";
import { Settings, User, Bell, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addToast } from "@heroui/toast";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    avatarUrl: "",
    socialLinks: {
      twitter: "",
      facebook: "",
      linkedin: "",
    },
    notifications: {
      emailReports: true,
      smsAlerts: false,
      pushNotifications: true,
    },
  });

  useEffect(() => {
    console.log("🚀 SettingsPage useEffect triggered");
    let isMounted = true;

    const loadProfile = async () => {
      try {
        console.log("🔄 Loading profile data...");
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
          console.log("✅ User found, loading profile...");

          // Test database connection first
          console.log("🔍 Testing database connection...");
          const { data: testData, error: testError } = await supabase
            .from("affiliate_profiles")
            .select("count")
            .limit(1);

          console.log("🔍 affiliate_profiles test:", { testData, testError });

          // Load user profile
          console.log("🔍 Loading user profile...");
          const { data, error } = await supabase
            .from("affiliate_profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();

          console.log("🔍 Profile query result:", { data, error });

          if (!isMounted) {
            console.log("❌ Component unmounted during profile load, stopping");
            return;
          }

          if (data) {
            console.log("✅ Profile data found:", data);
            setProfile({
              firstName: data.first_name || "",
              lastName: data.last_name || "",
              avatarUrl: data.avatar_url || "",
              socialLinks: data.social_links || {
                twitter: "",
                facebook: "",
                linkedin: "",
              },
              notifications: data.notifications || {
                emailReports: true,
                smsAlerts: false,
                pushNotifications: true,
              },
            });
          } else {
            console.log("⚠️ No profile data found, using defaults");
            // Set default values if no profile exists
            setProfile({
              firstName: user.user_metadata?.full_name?.split(" ")[0] || "User",
              lastName:
                user.user_metadata?.full_name?.split(" ").slice(1).join(" ") ||
                "Name",
              avatarUrl: user.user_metadata?.avatar_url || "",
              socialLinks: {
                twitter: "",
                facebook: "",
                linkedin: "",
              },
              notifications: {
                emailReports: true,
                smsAlerts: false,
                pushNotifications: true,
              },
            });
          }
        } else {
          console.log("❌ No user found");
        }
      } catch (error) {
        console.error("💥 Error loading profile data:", error);
        if (isMounted) {
          addToast({
            title: "Error loading profile!",
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

    console.log("🚀 Starting loadProfile function");

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log("⏰ Loading timeout reached - forcing completion");
      if (isMounted) {
        setLoading(false);
        // Set default values on timeout
        setProfile({
          firstName: "User",
          lastName: "Name",
          avatarUrl: "",
          socialLinks: {
            twitter: "",
            facebook: "",
            linkedin: "",
          },
          notifications: {
            emailReports: true,
            smsAlerts: false,
            pushNotifications: true,
          },
        });
      }
    }, 10000); // 10 second timeout

    loadProfile().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      console.log("🧹 SettingsPage useEffect cleanup");
      clearTimeout(timeoutId);
      isMounted = false;
    };
  }, []);

  const handleSaveProfile = async () => {
    console.log("💾 Starting profile save...");
    setLoading(true);

    try {
      console.log("🔍 Getting user from Supabase...");
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log("❌ No user found for profile save");
        addToast({
          title: "No user found",
          color: "danger",
        });
        return;
      }

      console.log("✅ User found, updating profile...");
      console.log("📝 Profile data to save:", {
        user_id: user.id,
        first_name: profile.firstName,
        last_name: profile.lastName,
        avatar_url: profile.avatarUrl,
        social_links: profile.socialLinks,
        notifications: profile.notifications,
      });

      const { data, error } = await supabase
        .from("affiliate_profiles")
        .upsert({
          user_id: user.id,
          user_aryeo_id: user.id, // Required field
          user_email: user.email || "",
          first_name: profile.firstName,
          last_name: profile.lastName,
          avatar_url: profile.avatarUrl,
          social_links: profile.socialLinks,
          notifications: profile.notifications,
        })
        .select()
        .single();

      console.log("🔍 Profile save result:", { data, error });

      if (error) {
        console.error("❌ Error saving profile:", error);
        addToast({
          title: "Failed to update profile",
          color: "danger",
        });
        return;
      }

      console.log("✅ Profile saved successfully:", data);
      addToast({
        title: "Profile updated successfully!",
        color: "success",
      });
    } catch (error) {
      console.error("💥 Error in handleSaveProfile:", error);
      addToast({
        title: "Failed to update profile",
        color: "danger",
      });
    } finally {
      console.log("🏁 Setting loading to false");
      setLoading(false);
    }
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
        {/* Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User size={20} />
                Profile Settings
              </h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar
                  src={profile?.avatarUrl || ""}
                  name={`${profile?.firstName} ${profile?.lastName}`}
                  size="lg"
                  className="w-16 h-16"
                />
                <Button
                  color="primary"
                  variant="bordered"
                  startContent={<Upload size={16} />}
                  size="sm"
                >
                  Upload Photo
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={profile.firstName}
                  onValueChange={(value) =>
                    setProfile((prev) => ({ ...prev, firstName: value }))
                  }
                  variant="bordered"
                />
                <Input
                  label="Last Name"
                  value={profile.lastName}
                  onValueChange={(value) =>
                    setProfile((prev) => ({ ...prev, lastName: value }))
                  }
                  variant="bordered"
                />
              </div>

              <Divider className="my-4" />

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Social Links</h4>
                <Input
                  label="Twitter"
                  placeholder="https://twitter.com/username"
                  value={profile.socialLinks?.twitter || ""}
                  onValueChange={(value) =>
                    setProfile((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, twitter: value },
                    }))
                  }
                  variant="bordered"
                />
                <Input
                  label="Facebook"
                  placeholder="https://facebook.com/username"
                  value={profile.socialLinks?.facebook || ""}
                  onValueChange={(value) =>
                    setProfile((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, facebook: value },
                    }))
                  }
                  variant="bordered"
                />
                <Input
                  label="LinkedIn"
                  placeholder="https://linkedin.com/in/username"
                  value={profile.socialLinks?.linkedin || ""}
                  onValueChange={(value) =>
                    setProfile((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, linkedin: value },
                    }))
                  }
                  variant="bordered"
                />
              </div>

              <Button
                color="primary"
                className="w-full"
                onPress={handleSaveProfile}
                isLoading={loading}
              >
                Save Profile
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bell size={20} />
                Notification Settings
              </h3>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">Email Reports</p>
                  <p className="text-sm text-gray-500">
                    Receive weekly performance reports
                  </p>
                </div>
                <Switch
                  isDisabled
                  isSelected={profile.notifications.emailReports}
                  onValueChange={(value) =>
                    setProfile((prev) => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        emailReports: value,
                      },
                    }))
                  }
                  color="primary"
                />
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">SMS Alerts</p>
                  <p className="text-sm text-gray-500">
                    Get notified of important updates
                  </p>
                </div>
                <Switch
                  isDisabled
                  isSelected={profile.notifications.smsAlerts}
                  onValueChange={(value) =>
                    setProfile((prev) => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        smsAlerts: value,
                      },
                    }))
                  }
                  color="primary"
                />
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">
                    Push Notifications
                  </p>
                  <p className="text-sm text-gray-500">
                    Browser notifications for real-time updates
                  </p>
                </div>
                <Switch
                  isDisabled
                  isSelected={profile.notifications.pushNotifications}
                  onValueChange={(value) =>
                    setProfile((prev) => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        pushNotifications: value,
                      },
                    }))
                  }
                  color="primary"
                />
              </div>

              <Button
                color="primary"
                className="w-full"
                onPress={handleSaveProfile}
                isLoading={loading}
              >
                Save Preferences
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

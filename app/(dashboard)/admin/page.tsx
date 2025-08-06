"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Textarea,
  Spinner,
} from "@heroui/react";
import { supabase } from "@/lib/supabase";
import { approveUser, createUserWithPassword, isUserAdmin, triggerDailyReportsUpdate } from "@/lib/auth";
import { addToast } from "@heroui/toast";
import { User } from "@supabase/supabase-js";

interface PendingUser {
  id: string;
  email: string;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // All hooks must be called at the top level, before any conditional returns
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvingEmail, setApprovingEmail] = useState("");
  const [approving, setApproving] = useState(false);

  // Manual user creation
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserAryeoId, setNewUserAryeoId] = useState("");
  const [newUserTempPassword, setNewUserTempPassword] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState(`Hi there!

I'm excited to let you know that your affiliate account has been approved! 🎉

Here are your login credentials:
Email: {email}
Temporary Password: {password}

Please sign in at our affiliate portal and change your password immediately for security.

Welcome to the team!
Best regards,
The VX Team`);

  // Daily reports update
  const [updatingReports, setUpdatingReports] = useState(false);

  // All useEffect hooks must be at the top level
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);

        if (!user) {
          router.push("/auth");
          return;
        }

        const adminStatus = isUserAdmin(user);
        setIsAdmin(adminStatus);

        if (!adminStatus) {
          addToast({
            title: "Access Denied",
            description:
              "You do not have permission to access the admin panel.",
            color: "danger",
          });
          router.push("/home");
          return;
        }
      } catch (error) {
        console.error("Error checking admin access:", error);
        router.push("/auth");
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  // Second useEffect for loading pending users
  useEffect(() => {
    if (isAdmin && !loading) {
      loadPendingUsers();
    }
  }, [isAdmin, loading]);

  // Show loading state
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

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-4">
            You do not have permission to access the admin panel.
          </p>
          <Button color="primary" onPress={() => router.push("/home")}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const loadPendingUsers = async () => {
    try {
      // Get all users who have signed up but aren't approved yet
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get users who exist in auth.users but not in approved_users
      const { data, error } = await supabase
        .from("auth.users")
        .select("id, email, created_at")
        .not("id", "in", `(SELECT user_id FROM approved_users)`);

      if (error) {
        console.error("Error loading pending users:", error);
        addToast({
          title: "Failed to load pending users",
          color: "danger",
        });
      } else {
        setPendingUsers(data || []);
      }
    } catch (error) {
      console.error("Error loading pending users:", error);
      addToast({
        title: "Failed to load pending users",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (email: string) => {
    setApproving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        addToast({
          title: "You must be logged in to approve users",
          color: "danger",
        });
        return;
      }

      const success = await approveUser(email, user.id);
      if (success) {
        addToast({
          title: `User ${email} approved successfully`,
          color: "success",
        });
        setApprovingEmail("");
        loadPendingUsers(); // Refresh the list
      } else {
        addToast({
          title: "Failed to approve user",
          color: "danger",
        });
      }
    } catch (error) {
      console.error("Error approving user:", error);
      addToast({
        title: "Failed to approve user",
        color: "danger",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleManualApprove = async () => {
    if (!approvingEmail) {
      addToast({
        title: "Please enter an email address",
        color: "danger",
      });
      return;
    }

    await handleApproveUser(approvingEmail);
  };

  const generateTemporaryPassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserFirstName || !newUserLastName) {
      addToast({
        title: "Please fill in all required fields",
        color: "danger",
      });
      return;
    }

    setCreatingUser(true);
    try {
      const tempPassword = generateTemporaryPassword();

      // Create user in Supabase Auth
      const user = await createUserWithPassword(newUserEmail, tempPassword, {
        first_name: newUserFirstName,
        last_name: newUserLastName,
        full_name: `${newUserFirstName} ${newUserLastName}`,
      });

      if (user) {
        // Approve the user
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (currentUser) {
          await approveUser(newUserEmail, currentUser.id);
        }

        // Create user profile
        await supabase.from("affiliate_profiles").insert({
          user_id: user.id,
          user_aryeo_id: newUserAryeoId || user.id,
          user_email: newUserEmail,
          first_name: newUserFirstName,
          last_name: newUserLastName,
          notifications: {
            email_reports: true,
            sms_alerts: false,
            push_notifications: true,
          },
        });

        // Create referral code
        await supabase.from("affiliate_referrers").insert({
          user_id: user.id,
          code: generateReferralCode(),
        });

        // Generate email content
        const emailContent = emailTemplate
          .replace("{email}", newUserEmail)
          .replace("{password}", tempPassword);

        // Copy email content to clipboard
        navigator.clipboard.writeText(emailContent);

        addToast({
          title:
            "User created successfully! Email content copied to clipboard.",
          color: "success",
        });

        // Reset form
        setNewUserEmail("");
        setNewUserFirstName("");
        setNewUserLastName("");
        setNewUserAryeoId("");

        // Refresh pending users list
        loadPendingUsers();
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      addToast({
        title: error.message || "Failed to create user",
        color: "danger",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const generateReferralCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleTriggerDailyReportsUpdate = async () => {
    setUpdatingReports(true);
    try {
      const success = await triggerDailyReportsUpdate();
      if (success) {
        addToast({
          title: "Daily reports update triggered successfully",
          color: "success",
        });
      } else {
        addToast({
          title: "Failed to trigger daily reports update",
          color: "danger",
        });
      }
    } catch (error) {
      console.error("Error triggering daily reports update:", error);
      addToast({
        title: "Failed to trigger daily reports update",
        color: "danger",
      });
    } finally {
      setUpdatingReports(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Manage user approvals and system settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Create New Affiliate</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              type="email"
              label="Email Address"
              placeholder="Enter email address"
              value={newUserEmail}
              onValueChange={setNewUserEmail}
              isRequired
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="First name"
                value={newUserFirstName}
                onValueChange={setNewUserFirstName}
                isRequired
              />
              <Input
                label="Last Name"
                placeholder="Last name"
                value={newUserLastName}
                onValueChange={setNewUserLastName}
                isRequired
              />
            </div>

            <Input
              label="Aryeo ID (Optional)"
              placeholder="External system ID"
              value={newUserAryeoId}
              onValueChange={setNewUserAryeoId}
            />

            <Button
              color="primary"
              className="w-full"
              onPress={handleCreateUser}
              isLoading={creatingUser}
              disabled={!newUserEmail || !newUserFirstName || !newUserLastName}
            >
              Create User & Send Email
            </Button>

            <p className="text-sm text-gray-500">
              Creates user account, approves them, and copies email content to
              clipboard.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Manual User Approval</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter user email"
                value={approvingEmail}
                onValueChange={setApprovingEmail}
                className="flex-1"
              />
              <Button
                color="primary"
                onPress={handleManualApprove}
                isLoading={approving}
                disabled={!approvingEmail}
              >
                Approve User
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Approve existing users who have already signed up.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">System Maintenance</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Button
              color="secondary"
              className="w-full"
              onPress={handleTriggerDailyReportsUpdate}
              isLoading={updatingReports}
            >
              Trigger Daily Reports Update
            </Button>
            <p className="text-sm text-gray-500">
              Manually trigger the daily user reports update to add new days for all users.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Email Template</h3>
          </CardHeader>
          <CardBody>
            <Textarea
              label="Email Template"
              placeholder="Email template with {email} and {password} placeholders"
              value={emailTemplate}
              onValueChange={setEmailTemplate}
              minRows={8}
            />
            <p className="text-sm text-gray-500 mt-2">
              Use {"{email}"} and {"{password}"} as placeholders. Email content
              will be copied to clipboard.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Pending Users</h3>
        </CardHeader>
        <CardBody>
          {pendingUsers.length === 0 ? (
            <p className="text-gray-500">No pending users found.</p>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{user.email}</p>
                    <p className="text-sm text-gray-500">
                      Signed up:{" "}
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    color="primary"
                    size="sm"
                    onPress={() => handleApproveUser(user.email)}
                    isLoading={approving && approvingEmail === user.email}
                  >
                    Approve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Textarea,
  Divider,
  Link,
} from "@heroui/react";
import { createUserWithPassword } from "@/lib/auth";
import { addToast } from "@heroui/toast";
// import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaUser } from "react-icons/fa";
import { FiLink } from "react-icons/fi";
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    notes: "",
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        full_name: `${formData.firstName} ${formData.lastName}`,
        notes: formData.notes,
      };

      const result = await createUserWithPassword(
        formData.email,
        formData.password,
        userData
      );

      addToast({
        title: "User created successfully!",
        description: `Referral code: ${result.referralCode}`,
        color: "success",
      });

      // Clear form
      setFormData({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        notes: "",
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      addToast({
        title: error.message || "Failed to create user",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const testDatabaseConnection = async () => {
    try {
      console.log('Testing database connection...');
      
      // Test basic query
      const { data, error } = await supabase
        .from('approved_users')
        .select('count')
        .limit(1);
      
      console.log('Database test result:', { data, error });
      
      if (error) {
        addToast({
          title: 'Database connection failed',
          description: error.message,
          color: 'danger',
        });
      } else {
        addToast({
          title: 'Database connection successful',
          color: 'success',
        });
      }
    } catch (error) {
      console.error('Database test error:', error);
      addToast({
        title: 'Database test failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        color: 'danger',
      });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Manage affiliate users and system settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create User Card */}
        <Card className="w-full">
          <CardHeader className="pb-3 flex-col items-start gap-2">
            <h2 className="text-xl font-semibold">Create New Affiliate</h2>
            <p className="text-sm text-gray-600">
              Create a new approved affiliate user. This will automatically
              populate all required database tables.
            </p>
          </CardHeader>

          <CardBody>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  placeholder="First name"
                  value={formData.firstName}
                  onValueChange={(value) =>
                    handleInputChange("firstName", value)
                  }
                  isRequired
                  variant="bordered"
                />
                <Input
                  label="Last Name"
                  placeholder="Last name"
                  value={formData.lastName}
                  onValueChange={(value) =>
                    handleInputChange("lastName", value)
                  }
                  isRequired
                  variant="bordered"
                />
              </div>

              <Input
                type="email"
                label="Email Address"
                placeholder="Enter user email"
                value={formData.email}
                onValueChange={(value) => handleInputChange("email", value)}
                isRequired
                variant="bordered"
              />

              <Input
                type="password"
                label="Password"
                placeholder="Enter user password"
                value={formData.password}
                onValueChange={(value) => handleInputChange("password", value)}
                isRequired
                variant="bordered"
                description="User will use this to sign in with email/password"
              />

              <Textarea
                label="Notes (Optional)"
                placeholder="Any additional notes about this user"
                value={formData.notes}
                onValueChange={(value) => handleInputChange("notes", value)}
                variant="bordered"
              />

              <Button
                type="submit"
                color="primary"
                className="w-full"
                isLoading={loading}
              >
                Create Affiliate User
              </Button>
              
              <Button
                type="button"
                color="secondary"
                variant="flat"
                className="w-full"
                onPress={testDatabaseConnection}
              >
                Test Database Connection
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* Information Card */}
        <Card className="w-full">
          <CardHeader className="pb-3 flex flex-col gap-2 items-start">
            <h2 className="text-xl font-semibold">User Creation Process</h2>
            <p className="text-sm text-gray-600">
              When you create a new affiliate, the system will automatically:
            </p>
          </CardHeader>

          <CardBody>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-medium">Create Auth User</h3>
                  <p className="text-sm text-gray-600">
                    Create user account in Supabase Auth
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-medium">Approve User</h3>
                  <p className="text-sm text-gray-600">
                    Add to approved_users table with active status
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-medium">Create Profile</h3>
                  <p className="text-sm text-gray-600">
                    Create affiliate_profiles record with user details
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">4</span>
                </div>
                <div>
                  <h3 className="font-medium">Generate Referral Code</h3>
                  <p className="text-sm text-gray-600">
                    Create unique referral code in affiliate_referrers
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">5</span>
                </div>
                <div>
                  <h3 className="font-medium">Initialize Dashboard</h3>
                  <p className="text-sm text-gray-600">
                    Create dashboard_kpis record with empty reports
                  </p>
                </div>
              </div>
            </div>

            <Divider className="my-4" />

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">
                Sign-in Options
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Email/Password authentication</li>
                <li>• Google SSO (links to existing approved email)</li>
                <li>• Users can reset their password via email</li>
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Additional Admin Features */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Admin Tools</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onPress={() => router.push("/admin/users")}
                className="flex flex-col items-center justify-center w-full h-full"
                color="default"
                variant="flat"
              >
                <div className="text-2xl font-bold text-blue-600">
                  <FaUser />
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  View Users
                </div>

                <p className="text-sm text-gray-600 mt-1 text-wrap">
                  Browse and manage existing affiliate users
                </p>
              </Button>

              <Card className="flex flex-col items-center justify-center text-center p-4 bg-gray-50 rounded-lg w-full">
                <CardHeader className="flex flex-col items-center justify-center text-center gap-2">
                  <h2 className="text-xl font-semibold">
                    External Application
                  </h2>
                </CardHeader>
                <CardBody className="flex flex-col items-center justify-center text-center gap-2">
                  <p className="text-sm text-center text-gray-600 mt-1">
                    Users apply via the external form and are manually approved
                  </p>
                  <Link
                    href="https://api.leadconnectorhq.com/widget/form/1R5iyXWWm6IgKBpqZffb"
                    target="_blank"
                    rel="noopener noreferrer"
                    color="primary"
                    underline="hover"
                    className="text-sm text-primary font-medium truncate"
                  >
                    <FiLink size={16} className="mr-2" />
                    View Application Form
                  </Link>
                </CardBody>
              </Card>

              <Card className="flex flex-col items-center justify-center text-center p-4 bg-gray-50 rounded-lg w-full">
                <CardHeader className="flex flex-col items-center justify-center text-center gap-2">
                  <h2 className="text-xl font-semibold">Authentication</h2>
                </CardHeader>
                <CardBody className="flex flex-col items-center justify-center text-center gap-2">
                  <p className="text-sm text-gray-600 mt-1">
                    Email/password + Google SSO supported
                  </p>
                </CardBody>
              </Card>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect, Suspense } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Image as HeroImage,
  Link,
  Spinner,
} from "@heroui/react";
import { FcGoogle } from "react-icons/fc";
import {
  signInWithGoogle,
  signInWithEmail,
  resetPassword,
  debugApprovedUsers,
  isUserApproved,
  testDatabaseConnection,
  testSupabaseConnection,
  checkSupabaseConfig,
  testSimpleTableQuery,
  testSimpleQuery,
  testExactQuery,
} from "@/lib/auth";
import { addToast } from "@heroui/toast";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";

function AuthPageContent() {
  const [showEmailForm, setShowEmailForm] = useState(true);
  const [showResetForm, setShowResetForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (error === "not-approved") {
      addToast({
        title: "Access Denied",
        description:
          "Your account is not approved. Please contact an administrator.",
        color: "danger",
      });
    }
  }, [error]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      addToast({
        title: "Signing in with Google...",
        color: "default",
      });
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      addToast({
        title: error.message || "Failed to sign in with Google",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      addToast({
        title: "Error",
        description: "Please fill in all fields",
        color: "danger",
      });
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email, password);
      addToast({
        title: "Success",
        description: "Signed in successfully",
        color: "success",
      });
    } catch (error) {
      console.error("Sign in error:", error);
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Sign in failed",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Password reset form submitted");
    setLoading(true);
    try {
      await resetPassword(resetEmail);

      addToast({
        title: "Password reset email sent! Check your inbox.",
        color: "success",
      });
      setShowResetForm(false);
      setShowEmailForm(true);
      setResetEmail("");
    } catch (error: any) {
      console.error("Password reset error:", error);
      
      // Handle rate limit error specifically
      if (error.message?.includes("rate limit")) {
        addToast({
          title: "Rate limit exceeded",
          description: "Please wait about an hour before requesting another reset email.",
          color: "warning",
        });
      } else {
        addToast({
          title: error.message || "Failed to send reset email",
          color: "danger",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShowResetForm = () => {
    console.log("Showing reset form");
    setShowResetForm(true);
    setShowEmailForm(false);
    setResetEmail(email); // Pre-fill with current email if available
    // addToast({
    //   title: "Opening password reset form...",
    //   color: "primary",
    // });
  };

  const handleDebugApproval = async () => {
    try {
      console.log("Debugging approval system...");

      // Test 0: Check Supabase configuration
      const config = checkSupabaseConfig();
      console.log("Supabase config check:", config);
      addToast({
        title: `Config: ${config.urlExists && config.anonKeyExists ? "OK" : "FAILED"}`,
        description: `URL: ${config.urlExists}, Key: ${config.anonKeyExists}`,
        color: config.urlExists && config.anonKeyExists ? "success" : "danger",
      });

      // Test 1: Basic Supabase connection
      const connectionTest = await testSupabaseConnection();
      console.log("Supabase connection test:", connectionTest);
      addToast({
        title: `Supabase connection: ${connectionTest.success ? "OK" : "FAILED"}`,
        description: connectionTest.error,
        color: connectionTest.success ? "success" : "danger",
      });

      // Test 2: Simple query test
      const simpleQueryTest = await testSimpleQuery();
      console.log("Simple query test:", simpleQueryTest);
      addToast({
        title: `Simple query: ${simpleQueryTest ? "OK" : "FAILED"}`,
        color: simpleQueryTest ? "success" : "danger",
      });

      // Test 3: Simple table query
      const simpleTableTest = await testSimpleTableQuery();
      console.log("Simple table test:", simpleTableTest);
      addToast({
        title: `Simple table query: ${simpleTableTest.success ? "OK" : "FAILED"}`,
        description: simpleTableTest.error,
        color: simpleTableTest.success ? "success" : "danger",
      });

      // Test 4: Database health check
      const dbHealthy = await testDatabaseConnection();
      console.log("Database healthy:", dbHealthy);
      addToast({
        title: `Database connection: ${dbHealthy ? "OK" : "FAILED"}`,
        color: dbHealthy ? "success" : "danger",
      });

      // Test 3: Check approved users table
      const approvedUsers = await debugApprovedUsers();
      console.log("Approved users:", approvedUsers);

      // Test 4: Check if current user is approved
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const isApproved = await isUserApproved(user.id);
        console.log("Current user approved:", isApproved);
        addToast({
          title: `Current user approved: ${isApproved}`,
          color: isApproved ? "success" : "danger",
        });
      } else {
        addToast({
          title: "No current user found",
          color: "warning",
        });
      }

      // Test exact query that's failing
      const exactQueryResult = await testExactQuery(
        "996c5b3a-3bd6-47f1-a5b5-073bcdda2f85"
      );
      addToast({
        title: `Exact query test: ${exactQueryResult ? "SUCCESS" : "FAILED"}`,
        color: exactQueryResult ? "success" : "danger",
      });
      console.log("Exact query test:", exactQueryResult);
    } catch (error) {
      console.error("Debug error:", error);
      addToast({
        title: "Debug failed",
        description: error instanceof Error ? error.message : "Unknown error",
        color: "danger",
      });
    }
  };

  // Debug state values
  console.log("Auth page state:", { showEmailForm, showResetForm, loading });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center justify-center pb-2">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <HeroImage
                src="https://storage.googleapis.com/msgsndr/6mf1vLiHQTtwiHYT2ZIP/media/6700d525ab8aa65e4371b897.png"
                alt="Virtual Xposure Logo"
                width={48}
                height={48}
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Affiliate Portal
            </h1>
            <p className="text-gray-600">Sign in with your approved account</p>
          </div>
        </CardHeader>

        <CardBody className="pt-0">
          <div className="space-y-4">
            <Button
              color="default"
              variant="flat"
              className="w-full"
              onPress={handleGoogleSignIn}
              isLoading={loading && !showEmailForm && !showResetForm}
              startContent={<FcGoogle size={20} />}
            >
              Continue with Google
            </Button>

            <div className="relative my-4">
              <div className="relative flex justify-center text-sm">
                <span className="px-2 text-primary">or</span>
              </div>
            </div>

            {showEmailForm ? (
              <div className="space-y-4">
                <Input
                  type="email"
                  label="Email"
                  value={email}
                  onValueChange={setEmail}
                  isRequired
                />
                <Input
                  type="password"
                  label="Password"
                  value={password}
                  onValueChange={setPassword}
                  isRequired
                />
                <Button
                  color="primary"
                  className="w-full"
                  onPress={handleEmailSignIn}
                  isLoading={loading}
                >
                  Sign In
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    color="default"
                    variant="light"
                    className="flex-1"
                    onPress={handleShowResetForm}
                  >
                    Forgot Password?
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <Input
                  type="email"
                  label="Email Address"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onValueChange={setResetEmail}
                  isRequired
                  variant="bordered"
                />

                <Button
                  type="submit"
                  color="primary"
                  className="w-full"
                  isLoading={loading}
                >
                  Send Reset Email
                </Button>

                <Button
                  type="button"
                  color="default"
                  variant="light"
                  className="w-full"
                  onPress={() => {
                    console.log("Back to Sign In button clicked");
                    setShowResetForm(false);
                    setShowEmailForm(true);
                    setResetEmail("");
                  }}
                >
                  Back to Sign In
                </Button>
              </form>
            )}

            <div className="text-center space-y-2">
              <p className="text-sm text-gray-500">
                Only approved affiliates can access the dashboard
              </p>
              <p className="text-xs text-gray-400">
                Google SSO will link to existing approved accounts by email
              </p>
              <Link
                href="https://api.leadconnectorhq.com/widget/form/1R5iyXWWm6IgKBpqZffb"
                target="_blank"
                rel="noopener noreferrer"
                color="primary"
                underline="hover"
                className="text-sm"
              >
                Not an affiliate? Apply here →
              </Link>

              {/* <Button
                size="sm"
                variant="light"
                onPress={handleDebugApproval}
                className="mt-2"
              >
                Debug Approval System
              </Button> */}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          classNames={{ label: "text-foreground mt-4" }}
          variant="default"
          size="lg"
          color="primary"
        />
        {/* <p className="mt-4 text-gray-600">Loading...</p> */}
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}

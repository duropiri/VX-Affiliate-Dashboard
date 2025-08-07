"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Image as HeroImage,
  Link,
} from "@heroui/react";
import { FcGoogle } from "react-icons/fc";
import {
  signInWithEmail,
  resetPassword,
  getUserCredentials,
  clearUserCredentials,
} from "@/lib/auth";
import { addToast } from "@heroui/toast";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";

function AuthPageContent() {
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(true);
  const [showResetForm, setShowResetForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  // Load stored credentials on mount
  useEffect(() => {
    const storedCredentials = getUserCredentials();
    if (storedCredentials) {
      setEmail(storedCredentials.email);
      setPassword(storedCredentials.password);
      console.log("Loaded stored credentials for:", storedCredentials.email);
    }
  }, []);

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
      const result = await signInWithEmail(email, password);
      
      // If we get here, the user is approved and signed in
      addToast({
        title: "Success",
        description: "Signed in successfully",
        color: "success",
      });
      
      // Use router for proper navigation
      router.push('/home');
      
    } catch (error) {
      console.error("Sign in error:", error);
      
      // Clear stored credentials on sign-in failure
      clearUserCredentials();
      
      addToast({
        title: "Sign In Failed",
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
  };

  const handleClearCredentials = () => {
    clearUserCredentials();
    setEmail("");
    setPassword("");
    addToast({
      title: "Credentials Cleared",
      description: "Stored credentials have been cleared.",
      color: "success",
    });
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
                  {getUserCredentials() && (
                    <Button
                      type="button"
                      color="default"
                      variant="light"
                      className="flex-1"
                      onPress={handleClearCredentials}
                    >
                      Clear Saved
                    </Button>
                  )}
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
                Your credentials are securely stored for convenience
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
        {/* <Spinner
          classNames={{ label: "text-foreground mt-4" }}
          variant="default"
          size="lg"
          color="primary"
        /> */}
        {/* <p className="mt-4 text-gray-600">Loading...</p> */}
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}

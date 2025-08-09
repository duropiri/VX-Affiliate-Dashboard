"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Image as HeroImage,
  Form,
} from "@heroui/react";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { addToast } from "@heroui/toast";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    const type = searchParams.get("type");

    // Supabase sends a link to this page with ?type=recovery&token=...
    // We need to exchange that for a session so updateUser() can succeed.
    const establishSession = async () => {
      try {
        if (type === "recovery" && token) {
          const { error } = await supabase.auth.exchangeCodeForSession(token);
          if (error) {
            console.error("exchangeCodeForSession error:", error);
            setError("Invalid reset link. Please request a new password reset.");
          }
        } else {
          // Fallback: check if a session already exists (some providers may redirect after verification)
          const { data, error } = await supabase.auth.getSession();
          if (error || !data.session) {
            setError("Invalid reset link. Please request a new password reset.");
          }
        }
      } catch (e) {
        console.error("Session establish error:", e);
        setError("Invalid reset link. Please request a new password reset.");
      }
    };

    establishSession();
  }, [searchParams]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // For password reset, we need to use the recovery flow
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        console.error("Password update error:", error);
        setError(error.message || "Failed to update password");
        return;
      }

      setSuccess(true);
      addToast({
        title: "Password updated successfully!",
        description: "You can now sign in with your new password.",
        color: "success",
      });

      // Sign out the user after password reset
      await signOut();

      // Redirect to auth page after a short delay
      setTimeout(() => {
        router.push("/auth");
      }, 2000);
    } catch (error) {
      console.error("Password reset error:", error);
      setError("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (error && !success) {
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
                Reset Password
              </h1>
            </div>
          </CardHeader>

          <CardBody className="pt-0">
            <div className="text-center space-y-4">
              <div className="text-red-500 text-xl mb-4">❌</div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Invalid Reset Link
              </h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button
                color="primary"
                className="w-full"
                onPress={() => router.push("/auth")}
              >
                Back to Sign In
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (success) {
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
                Password Reset
              </h1>
            </div>
          </CardHeader>

          <CardBody className="pt-0">
            <div className="text-center space-y-4">
              <div className="text-green-500 text-xl mb-4">✅</div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Password Updated Successfully!
              </h2>
              <p className="text-gray-600 mb-4">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <Button
                color="primary"
                className="w-full"
                onPress={() => router.push("/auth")}
              >
                Sign In
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

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
              Reset Password
            </h1>
            <p className="text-gray-600">Enter your new password</p>
          </div>
        </CardHeader>

        <CardBody className="pt-0">
          <Form onSubmit={handlePasswordReset} className="space-y-4">
            <Input
              type="password"
              label="New Password"
              placeholder="Enter your new password"
              value={password}
              onValueChange={setPassword}
              isRequired
              variant="bordered"
              minLength={6}
            />

            <Input
              type="password"
              label="Confirm Password"
              placeholder="Confirm your new password"
              value={confirmPassword}
              onValueChange={setConfirmPassword}
              isRequired
              variant="bordered"
              minLength={6}
            />

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <Button
              type="submit"
              color="primary"
              className="w-full"
              isLoading={loading}
            >
              Update Password
            </Button>

            <Button
              type="button"
              color="default"
              variant="light"
              className="w-full"
              onPress={() => router.push("/auth")}
            >
              Back to Sign In
            </Button>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
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
                Reset Password
              </h1>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="text-center">
              <p className="text-gray-600">Loading...</p>
            </div>
          </CardBody>
        </Card>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
} 
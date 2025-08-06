'use client';

import { useState } from 'react';
import { Card, CardBody, CardHeader, Button, Input } from '@heroui/react';
import { FcGoogle } from "react-icons/fc";
import { signInWithGoogle, signInWithEmail, resetPassword } from '@/lib/auth';
import { addToast } from '@heroui/toast';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      addToast({
        title: 'Signing in with Google...',
        color: 'default',
      });
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      addToast({
        title: error.message || 'Failed to sign in with Google',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      addToast({
        title: 'Signing in...',
        color: 'success',
      });
    } catch (error: any) {
      console.error('Email sign-in error:', error);
      addToast({
        title: error.message || 'Failed to sign in',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Password reset form submitted');
    setLoading(true);
    try {
      await resetPassword(email);
      
      addToast({
        title: 'Password reset email sent! Check your inbox.',
        color: 'success',
      });
      setShowResetForm(false);
      setShowEmailForm(false);
    } catch (error: any) {
      console.error('Password reset error:', error);
      addToast({
        title: error.message || 'Failed to send reset email',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShowResetForm = () => {
    console.log('Showing reset form');
    alert('Forgot Password button clicked!'); // Temporary test
    setShowResetForm(true);
    setShowEmailForm(false);
    addToast({
      title: 'Opening password reset form...',
      color: 'primary',
    });
  };

  // Debug state values
  console.log('Auth page state:', { showEmailForm, showResetForm, loading });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-purple-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center justify-center pb-2">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <FcGoogle className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Affiliate Portal</h1>
            <p className="text-gray-600">Sign in with your approved account</p>
          </div>
        </CardHeader>
        
        <CardBody className="pt-0">
          <div className="space-y-4">
            <Button
              color="primary"
              variant="flat"
              className="w-full"
              onPress={handleGoogleSignIn}
              isLoading={loading && !showEmailForm && !showResetForm}
              startContent={<FcGoogle size={20} />}
            >
              Continue with Google
            </Button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            {!showEmailForm && !showResetForm ? (
              <Button
                color="primary"
                variant="bordered"
                className="w-full"
                onPress={() => {
                  console.log('Sign in with Email button clicked');
                  setShowEmailForm(true);
                }}
              >
                Sign in with Email
              </Button>
            ) : showEmailForm ? (
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <Input
                  type="email"
                  label="Email Address"
                  placeholder="Enter your email"
                  value={email}
                  onValueChange={setEmail}
                  isRequired
                  variant="bordered"
                />
                
                <Input
                  type="password"
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onValueChange={setPassword}
                  isRequired
                  variant="bordered"
                />
                
                <Button
                  type="submit"
                  color="primary"
                  className="w-full"
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
                    onPress={() => setShowEmailForm(false)}
                  >
                    Back to Google Sign In
                  </Button>
                  
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
              </form>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <Input
                  type="email"
                  label="Email Address"
                  placeholder="Enter your email"
                  value={email}
                  onValueChange={setEmail}
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
                  onPress={() => setShowResetForm(false)}
                >
                  Back to Sign In
                </Button>
              </form>
            )}
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-500">
                Only approved affiliates can access the dashboard
              </p>
              <p className="text-xs text-gray-400">
                Google SSO will link to existing approved accounts by email
              </p>
              <a
                href="https://api.leadconnectorhq.com/widget/form/1R5iyXWWm6IgKBpqZffb"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Not an affiliate? Apply here →
              </a>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
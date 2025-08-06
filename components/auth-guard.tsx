'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { createUserProfile, createReferralCode, getUserProfile, isUserApproved, handlePostGoogleAuth, debugApprovedUsers } from '@/lib/auth';
import { addToast, Spinner } from '@heroui/react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState<boolean>(false);
  const router = useRouter();

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('AuthGuard loading timeout - redirecting to auth');
        console.warn('Timeout details - loading:', loading, 'user:', !!user, 'approved:', approved);
        setLoading(false);
        router.push('/auth');
      }
    }, 15000); // Increased to 15 second timeout

    return () => clearTimeout(timeout);
  }, [loading, router]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/auth');
          return;
        }
        
        // Check if user is approved (simplified for speed)
        console.log('Checking user approval for:', user.email, 'ID:', user.id);
        
        // Check user approval with timeout
        let isApproved = false;
        try {
          const approvalPromise = isUserApproved(user.id);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Approval check timeout')), 5000);
          });
          
          isApproved = await Promise.race([approvalPromise, timeoutPromise]) as boolean;
          console.log('User approval result:', isApproved);
        } catch (error) {
          console.error('Approval check error:', error);
          isApproved = false;
        }
        
        if (!isApproved) {
          console.log('❌ User not approved, redirecting to auth');
          setUser(null);
          setLoading(false);
          router.push('/auth');
          addToast({
            title: "User not approved",
            color: "danger",
          });
          return;
        }
        
        console.log('✅ User is approved, proceeding to dashboard');
        
        // Set user and approval status immediately
        setUser(user);
        setApproved(true);
        setLoading(false);
        
        // Try to set up user profile in background (non-blocking)
        setTimeout(async () => {
          try {
            const profile = await getUserProfile(user.id);
            if (!profile) {
              console.log('Creating user profile...');
              await createUserProfile(user);
              await createReferralCode(user.id);
              console.log('User profile created successfully');
            }
          } catch (error) {
            console.error('Error setting up user profile (non-critical):', error);
            // Don't block the user from accessing the app if profile creation fails
          }
        }, 1000); // Delay profile creation to not block rendering
      } catch (error) {
        console.error('Error checking user:', error);
        router.push('/auth');
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setApproved(false);
          setLoading(false);
          router.push('/auth');
        } else if (session?.user) {
          // Check if user is approved (with email cross-referencing for Google SSO)
          console.log('Auth state change - checking user approval for:', session.user.email, 'ID:', session.user.id);
          
          // Check user approval with timeout
          let isApproved = false;
          try {
            const approvalPromise = isUserApproved(session.user.id);
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Approval check timeout')), 5000);
            });
            
            isApproved = await Promise.race([approvalPromise, timeoutPromise]) as boolean;
            console.log('Auth state change - initial approval check result:', isApproved);
          } catch (error) {
            console.error('Auth state change - Approval check error:', error);
            isApproved = false;
          }
          
          // If not approved by user ID, try email cross-referencing for Google SSO
          if (!isApproved && session.user.app_metadata?.provider === 'google') {
            console.log('Auth state change - User not approved by ID, trying email cross-reference for Google SSO');
            console.log('Auth state change - User provider:', session.user.app_metadata?.provider);
            isApproved = await handlePostGoogleAuth(session.user);
            console.log('Auth state change - Email cross-reference result:', isApproved);
          }
          
          console.log('Auth state change - Final user approval status:', isApproved);
          
          console.log('About to check if user is approved from auth state change. isApproved =', isApproved);
          
          if (!isApproved) {
            console.log('❌ User not approved from auth state change, redirecting to auth');
            setUser(null);
            setApproved(false);
            setLoading(false);
            router.push('/auth');
            return;
          }
          
          console.log('✅ User is approved from auth state change, proceeding to dashboard');
          
          // Set user and approval status
          console.log('Auth state change - Setting user state:', session.user.email);
          setUser(session.user);
          console.log('Auth state change - Setting approved state: true');
          setApproved(true);
          console.log('Auth state change - Setting loading state: false');
          setLoading(false);
          
          // Try to set up user profile in background (non-blocking)
          setTimeout(async () => {
            try {
              const profile = await getUserProfile(session.user.id);
              if (!profile) {
                console.log('Creating user profile from auth state change...');
                await createUserProfile(session.user);
                await createReferralCode(session.user.id);
                console.log('User profile created successfully from auth state change');
              }
            } catch (error) {
              console.error('Error setting up user profile from auth state change (non-critical):', error);
            }
          }, 1000); // Delay profile creation to not block rendering
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  console.log('AuthGuard render - loading:', loading, 'user:', !!user, 'approved:', approved);
  
  if (loading) {
    console.log('AuthGuard showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner classNames={{label: "text-foreground mt-4"}} variant="default" size="lg" />
      </div>
    );
  }

  if (!user || !approved) {
    console.log('AuthGuard returning null - user:', !!user, 'approved:', approved);
    return null;
  }

  console.log('AuthGuard rendering children');
  return <>{children}</>;
}
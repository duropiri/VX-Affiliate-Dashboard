"use client";

import type { ThemeProviderProps } from "next-themes";
import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ToastProvider } from "@heroui/toast";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  // Session management - refresh tokens on tab focus and periodically
  useEffect(() => {
    // Refresh session when tab gains focus (browsers throttle background timers)
    const handleFocus = async () => {
      try {
        console.log('🔄 Tab focused - refreshing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session refresh error:', error);
        } else if (session) {
          console.log('✅ Session refreshed successfully');
        } else {
          console.log('ℹ️ No active session found');
        }
      } catch (error) {
        console.error('Session refresh failed:', error);
      }
    };

    // Manual session refresh every 30 minutes as backup
    const handlePeriodicRefresh = async () => {
      try {
        console.log('🔄 Periodic session refresh...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Periodic session refresh error:', error);
        } else if (session) {
          console.log('✅ Periodic session refresh successful');
        }
      } catch (error) {
        console.error('Periodic session refresh failed:', error);
      }
    };

    // Set up event listeners
    window.addEventListener('focus', handleFocus);
    
    // Set up periodic refresh every 30 minutes
    const interval = setInterval(handlePeriodicRefresh, 30 * 60 * 1000);

    // Initial session check
    handleFocus();

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider {...themeProps}>
        {children}
        <ToastProvider />
      </NextThemesProvider>
    </HeroUIProvider>
  );
}

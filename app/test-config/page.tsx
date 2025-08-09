"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Button } from "@heroui/react";
import { supabase } from "@/lib/supabase";

interface ConfigState {
  url?: string;
  key?: string;
  environment?: string;
  origin?: string;
  supabaseConnection?: string;
  error?: string;
}

export default function TestConfigPage() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkConfig = async () => {
      try {
        // Check if environment variables are loaded
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY;
        
        setConfig({
          url: url ? "✅ Loaded" : "❌ Missing",
          key: key ? "✅ Loaded" : "❌ Missing",
          environment: process.env.NODE_ENV,
          origin: window.location.origin,
        });

        // Test Supabase connection
        const { data, error } = await supabase.auth.getSession();
        setConfig((prev: ConfigState | null) => ({
          ...prev,
          supabaseConnection: error ? "❌ Failed" : "✅ Connected",
          error: error?.message,
        }));
      } catch (error) {
        setConfig((prev: ConfigState | null) => ({
          ...prev,
          supabaseConnection: "❌ Error",
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      } finally {
        setLoading(false);
      }
    };

    checkConfig();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl font-bold">Production Configuration Test</h1>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Environment Variables:</h3>
              <div className="space-y-2 text-sm">
                <div>Supabase URL: {config?.url}</div>
                <div>Supabase Key: {config?.key}</div>
                <div>Environment: {config?.environment}</div>
                <div>Origin: {config?.origin}</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Connection Status:</h3>
              <div className="text-sm">
                <div>Supabase: {config?.supabaseConnection}</div>
                {config?.error && (
                  <div className="text-red-500 mt-1">Error: {config.error}</div>
                )}
              </div>
            </div>

            <Button
              color="primary"
              className="w-full"
              onPress={() => window.location.href = "/auth"}
            >
              Go to Auth Page
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
} 
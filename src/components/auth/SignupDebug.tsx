"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Temporary debug component to test Supabase connection
 * Remove this after debugging
 */
export default function SignupDebug() {
  const [status, setStatus] = useState<string>("");
  const [details, setDetails] = useState<any>(null);

  const testConnection = async () => {
    setStatus("Testing...");
    setDetails(null);

    try {
      const supabase = createClient();
      
      // Test 1: Check if we can reach Supabase
      const { data: health, error: healthError } = await supabase
        .from("_realtime")
        .select("count")
        .limit(1);

      // Test 2: Try to get auth session (should work even if not logged in)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      // Test 3: Check Supabase URL
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      setDetails({
        supabaseUrl: supabaseUrl || "MISSING",
        hasAnonKey,
        healthError: healthError?.message,
        sessionError: sessionError?.message,
        canReachSupabase: !healthError || healthError.code !== "PGRST301",
      });

      if (!supabaseUrl || !hasAnonKey) {
        setStatus("❌ Missing environment variables");
      } else if (healthError && healthError.code === "PGRST301") {
        setStatus("❌ Cannot reach Supabase (network/CORS issue)");
      } else {
        setStatus("✅ Can reach Supabase");
      }
    } catch (err) {
      setStatus("❌ Error: " + (err instanceof Error ? err.message : String(err)));
      setDetails({ error: err });
    }
  };

  return (
    <Card className="p-4 mt-4 border-yellow-500">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Debug: Supabase Connection Test</p>
        <Button onClick={testConnection} size="sm" variant="outline">
          Test Connection
        </Button>
        {status && <p className="text-sm">{status}</p>}
        {details && (
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(details, null, 2)}
          </pre>
        )}
      </div>
    </Card>
  );
}

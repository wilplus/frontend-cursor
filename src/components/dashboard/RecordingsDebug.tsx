"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchUserRecordings } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/**
 * Debug component to test recordings API
 * This helps diagnose issues without needing to find bearer tokens
 */
export default function RecordingsDebug() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        
        setSessionInfo({
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          expiresAt: session?.expires_at,
          expiresAtDate: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
          error: error?.message,
        });
        
        if (!session) {
          console.warn("[RecordingsDebug] No session found");
        } else {
          console.log("[RecordingsDebug] Session found:", {
            userId: session.user.id,
            expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : "N/A",
          });
        }
      } catch (err) {
        console.error("[RecordingsDebug] Error checking session:", err);
        setSessionInfo({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    
    checkSession();
  }, []);

  const testAPI = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log("[RecordingsDebug] Starting API test...");
      
      // Test the API
      const response = await fetchUserRecordings(10, 0);
      
      setResult({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      });
      
      console.log("[RecordingsDebug] API test successful:", response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setResult({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      console.error("[RecordingsDebug] API test failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const testDirectFetch = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log("[RecordingsDebug] Testing direct fetch...");
      
      // Check session first
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No session found. Please log in again.");
      }
      
      const res = await fetch("/api/user/recordings?limit=10&offset=0", {
        credentials: "include", // Ensure cookies are sent
      });
      const text = await res.text();
      let json;
      
      try {
        json = JSON.parse(text);
      } catch {
        json = { rawText: text };
      }
      
      setResult({
        success: res.ok,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: json,
        rawText: text,
        sessionChecked: !!session,
        timestamp: new Date().toISOString(),
      });
      
      console.log("[RecordingsDebug] Direct fetch result:", {
        status: res.status,
        body: json,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setResult({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      console.error("[RecordingsDebug] Direct fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        toast.error(`Failed to refresh session: ${error.message}`);
        return;
      }
      
      if (data.session) {
        toast.success("Session refreshed successfully!");
        // Re-check session info
        setSessionInfo({
          hasSession: true,
          userId: data.session.user.id,
          email: data.session.user.email,
          expiresAt: data.session.expires_at,
          expiresAtDate: data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : "N/A",
        });
      } else {
        toast.error("No session after refresh. Please log in again.");
      }
    } catch (err) {
      toast.error(`Error refreshing session: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <Card className="p-6 border-yellow-500">
      <h3 className="text-lg font-semibold mb-4">🔍 Recordings API Debug Tool</h3>
      
      <div className="space-y-4">
        {/* Session Info */}
        {sessionInfo && (
          <div className={`p-3 rounded-md text-sm ${
            sessionInfo.hasSession 
              ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" 
              : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
          }`}>
            <p className="font-semibold mb-1">
              {sessionInfo.hasSession ? "✅ Session Active" : "❌ No Session"}
            </p>
            {sessionInfo.hasSession ? (
              <div className="text-xs space-y-1">
                <p>User ID: {sessionInfo.userId}</p>
                <p>Email: {sessionInfo.email}</p>
                <p>Expires: {sessionInfo.expiresAtDate}</p>
              </div>
            ) : (
              <div className="text-xs">
                <p className="text-destructive mb-2">You need to log in again.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = "/login"}
                >
                  Go to Login
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={testAPI}
            disabled={loading || !sessionInfo?.hasSession}
            variant="outline"
          >
            {loading ? "Testing..." : "Test API (via client)"}
          </Button>
          <Button
            onClick={testDirectFetch}
            disabled={loading || !sessionInfo?.hasSession}
            variant="outline"
          >
            {loading ? "Testing..." : "Test Direct Fetch"}
          </Button>
          {sessionInfo?.hasSession && (
            <Button
              onClick={refreshSession}
              disabled={loading}
              variant="outline"
            >
              Refresh Session
            </Button>
          )}
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="p-4 bg-muted rounded-md">
            <p className="font-semibold mb-2">
              {result.success ? "✅ Success" : "❌ Failed"}
            </p>
            <pre className="text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap break-words">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Instructions:</strong></p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Click &quot;Test API (via client)&quot; to test using the API helper</li>
            <li>Click &quot;Test Direct Fetch&quot; to test the raw fetch call</li>
            <li>Check the browser Console (F12) for detailed logs</li>
            <li>Check the Network tab to see the actual HTTP request/response</li>
            <li>Check your Flask backend logs for any errors</li>
          </ol>
        </div>
      </div>
    </Card>
  );
}

'use client';

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

// Helper to extract tokens from URL (handles both hash and query params)
function extractTokensFromUrl(): {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  type: string | null;
} {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null, code: null, type: null };
  }

  // Check hash first (Supabase password reset uses this)
  const hash = window.location.hash;
  let hashParams: URLSearchParams | null = null;
  
  if (hash && hash.length > 1) {
    try {
      hashParams = new URLSearchParams(hash.substring(1));
    } catch (e) {
      console.warn("[UpdatePassword] Failed to parse hash:", e);
    }
  }

  // Check query params (fallback)
  const searchParams = new URLSearchParams(window.location.search);

  return {
    accessToken: hashParams?.get('access_token') || null,
    refreshToken: hashParams?.get('refresh_token') || null,
    code: searchParams.get('code') || null,
    type: hashParams?.get('type') || searchParams.get('type') || null,
  };
}

export default function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Set up auth state change listener to detect when session is set
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[UpdatePassword] Auth state changed:", event, session ? "has session" : "no session");
      
      // Accept any session - don't require PASSWORD_RECOVERY event
      // Sometimes Supabase fires SIGNED_IN instead
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        console.log("[UpdatePassword] ✅ Session detected via auth state change, user:", session.user.email);
        setCheckingSession(false);
        // Clean up URL if it has hash/query params
        if (window.location.hash || window.location.search) {
          window.history.replaceState({}, '', '/update-password');
        }
      }
    });

    // Also check immediately for tokens in URL
    const handlePasswordReset = async () => {
      try {
        // Log the full URL for debugging
        console.log("[UpdatePassword] Full URL:", window.location.href);
        console.log("[UpdatePassword] Hash:", window.location.hash);
        console.log("[UpdatePassword] Search:", window.location.search);
        
        // Extract tokens using helper function
        const tokens = extractTokensFromUrl();
        const { accessToken, refreshToken, code, type } = tokens;
        
        console.log("[UpdatePassword] Token detection:", {
          hasHashTokens: !!(accessToken && refreshToken),
          hasCode: !!code,
          type,
          fullHash: window.location.hash,
        });

        // If we have a code in the URL, the exchange MUST happen server-side (PKCE code verifier
        // is in cookies). Redirect to /auth/callback so the route handler can exchange and redirect back.
        if (code && !accessToken) {
          const callbackUrl = `/auth/callback?code=${encodeURIComponent(code)}${type ? `&type=${encodeURIComponent(type)}` : ''}`;
          console.log("[UpdatePassword] Code in URL - redirecting to callback for server-side exchange:", callbackUrl);
          window.location.replace(callbackUrl);
          return;
        }

        // If we have tokens in hash, set the session
        // Don't require type=recovery - tokens might be valid even without it
        if (accessToken && refreshToken) {
          console.log("[UpdatePassword] Hash tokens found, setting session");
          console.log("[UpdatePassword] Token preview:", {
            accessTokenLength: accessToken.length,
            refreshTokenLength: refreshToken.length,
            type: type,
          });
          
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.error("[UpdatePassword] Error setting session:", error);
              
              // Provide more specific error messages
              if (error.message?.includes('expired') || error.message?.includes('invalid')) {
                toast.error("This reset link has expired or is invalid. Please request a new one.");
              } else {
                toast.error(`Invalid reset link: ${error.message}. Please request a new one.`);
              }
              
              setTimeout(() => router.push("/reset-password"), 2000);
              return;
            }
            
            if (data.session) {
              console.log("[UpdatePassword] ✅ Session set successfully, user:", data.session.user.email);
              setCheckingSession(false);
              // Clean up the URL
              window.history.replaceState({}, '', '/update-password');
              return;
            } else {
              console.error("[UpdatePassword] setSession succeeded but no session in response");
              console.error("[UpdatePassword] Response data:", data);
              toast.error("Session was not created. Please try requesting a new reset link.");
              setTimeout(() => router.push("/reset-password"), 2000);
              return;
            }
          } catch (setSessionError: any) {
            console.error("[UpdatePassword] Exception setting session:", setSessionError);
            const errorMsg = setSessionError?.message || "Unknown error";
            toast.error(`Failed to set session: ${errorMsg}. Please try requesting a new reset link.`);
            setTimeout(() => router.push("/reset-password"), 2000);
            return;
          }
        }
        
        // If we have a code in query params, exchange it (for password reset or other flows)
        if (code) {
          // Don't require type=recovery - code might be valid for password reset
          const isRecovery = type === 'recovery' || searchParams.get('type') === 'recovery';
          if (isRecovery) {
            console.log("[UpdatePassword] Password recovery code detected");
          }
          console.log("[UpdatePassword] Exchanging code for session");
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error("[UpdatePassword] Error exchanging code:", error);
              toast.error(`Invalid or expired reset link: ${error.message}. Please request a new one.`);
              setTimeout(() => router.push("/reset-password"), 2000);
              return;
            }
            
            if (data.session) {
              console.log("[UpdatePassword] Session obtained from code, user:", data.session.user.email);
              setCheckingSession(false);
              // Clean up the URL
              window.history.replaceState({}, '', '/update-password');
              return;
            }
          } catch (exchangeError) {
            console.error("[UpdatePassword] Exception exchanging code:", exchangeError);
            toast.error("Failed to exchange code. Please try requesting a new reset link.");
            setTimeout(() => router.push("/reset-password"), 2000);
            return;
          }
        }
        
        // Fallback: try to get existing session (might have been set by callback route)
        console.log("[UpdatePassword] No reset tokens found, checking existing session");
        
        // Wait a moment for any async session setting to complete
        // Also wait for auth state change listener to potentially fire
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check session again after waiting
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (session) {
          console.log("[UpdatePassword] ✅ Existing session found after wait, user:", session.user.email);
          setCheckingSession(false);
          return;
        }
        
        // No session available - show helpful error with diagnostic info
        console.error("[UpdatePassword] ❌ No session available after all attempts");
        console.error("[UpdatePassword] Diagnostic info:", {
          hash: window.location.hash || "(empty - this is likely the problem!)",
          search: window.location.search || "(empty)",
          fullUrl: window.location.href,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasCode: !!code,
        });
        
        // Show more helpful error message
        const errorMessage = window.location.hash 
          ? "The reset link appears to be invalid or expired. Please request a new one."
          : "The reset link did not include authentication tokens. This usually means:\n" +
            "1. The link has expired (links expire after 1 hour)\n" +
            "2. The redirect URL doesn't match your Supabase configuration\n" +
            "3. You need to request a new reset link";
        
        toast.error(errorMessage, { duration: 8000 });
        
        setTimeout(() => {
          router.push("/reset-password");
        }, 4000);
      } catch (error) {
        console.error("Error handling password reset:", error);
        toast.error("Error verifying reset link. Please try requesting a new one.");
        setTimeout(() => {
          router.push("/reset-password");
        }, 2000);
      }
    };

    // Small delay to ensure URL is fully loaded
    const timer = setTimeout(() => {
      handlePasswordReset();
    }, 100);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [supabase, router, searchParams, checkingSession]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message || "Failed to update password");
        return;
      }

      toast.success("Password updated successfully!");
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualToken, setManualToken] = useState("");

  const handleManualToken = async () => {
    if (!manualToken.trim()) {
      toast.error("Please paste the full URL from the reset email");
      return;
    }

    try {
      // Try to extract tokens from the pasted URL
      const url = new URL(manualToken);
      const hash = url.hash;
      
      if (!hash || hash.length < 2) {
        toast.error("The URL doesn't contain authentication tokens. Please check the full URL from your email.");
        return;
      }

      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        toast.error("Could not find tokens in the URL. Make sure you copied the complete URL from the email.");
        return;
      }

      console.log("[UpdatePassword] Setting session from manual token entry");
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        toast.error(`Invalid tokens: ${error.message}`);
        return;
      }

      if (data.session) {
        toast.success("Session set successfully!");
        setCheckingSession(false);
        setShowManualEntry(false);
        window.history.replaceState({}, '', '/update-password');
      }
    } catch (err: any) {
      toast.error(`Invalid URL: ${err.message}`);
    }
  };

  if (checkingSession) {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const currentHash = typeof window !== 'undefined' ? window.location.hash : '';
    const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
    
    return (
      <Card className="p-6 text-center space-y-4">
        <p className="text-sm text-muted-foreground">Verifying reset link...</p>
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded break-all text-left">
          <p className="font-semibold mb-2">Debug Information:</p>
          <p className="font-mono text-[10px]">URL: {currentUrl}</p>
          <p className="font-mono text-[10px] mt-1">Hash: {currentHash || '(empty - this is the problem!)'}</p>
          <p className="font-mono text-[10px] mt-1">Search: {currentSearch || '(empty)'}</p>
        </div>
        
        {!showManualEntry ? (
          <>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>If hash is empty, the reset link may have expired or the redirect URL is incorrect.</p>
              <p>Check that your Supabase redirect URL matches exactly.</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log("[UpdatePassword] Manual refresh triggered");
                  window.location.reload();
                }}
              >
                Retry Verification
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualEntry(true)}
              >
                Enter Link Manually
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3 text-left">
            <p className="text-xs text-muted-foreground">
              Paste the complete URL from your password reset email:
            </p>
            <Input
              type="text"
              placeholder="https://app.willonski.com/auth/callback#access_token=..."
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              className="text-xs font-mono"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleManualToken}
                className="flex-1"
              >
                Verify Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualEntry(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">New Password</label>
          <Input
            type="password"
            placeholder="Enter new password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Confirm Password</label>
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Password"}
        </Button>
      </form>

      <div className="mt-4 text-center text-sm">
        <Link href="/login" className="text-orange-500 hover:underline">
          Back to login
        </Link>
      </div>
    </Card>
  );
}

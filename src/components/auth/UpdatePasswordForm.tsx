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
    let cancelled = false;
    // Set up auth state change listener so the form appears as soon as session is ready (no button click)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        setCheckingSession(false);
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
        
        // Fallback: session was set by callback (cookies). Poll getSession so form appears automatically.
        const maxAttempts = 6;
        const delayMs = 400;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (cancelled) return;
          if (attempt > 0) await new Promise((r) => setTimeout(r, delayMs));
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (cancelled) return;
            if (session) {
              setCheckingSession(false);
              if (window.location.hash || window.location.search) {
                window.history.replaceState({}, '', '/update-password');
              }
              return;
            }
          } catch (_) {
            // Auth session missing / not ready yet; retry
          }
        }
        if (cancelled) return;
        toast.error("Verification is taking longer than usual. Please wait a moment or request a new reset link.");
        setTimeout(() => router.push("/reset-password"), 4000);
      } catch (error: unknown) {
        console.error("Error handling password reset:", error);
        const msg = error instanceof Error ? error.message : String(error);
        const isNetwork = msg === "Load failed" || msg === "Failed to fetch" || msg.includes("network");
        if (isNetwork) {
          toast.error("Network error. Check your connection and refresh the page.");
        } else {
          toast.error("Error verifying reset link. Please try requesting a new one.");
        }
        setCheckingSession(false);
        setTimeout(() => {
          router.push("/reset-password");
        }, 2000);
      }
    };

    // Run as soon as the component mounts so the form appears without clicking anything
    handlePasswordReset();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, router, searchParams]);

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
    } catch (err: unknown) {
      console.error("[UpdatePassword] Error updating password:", err);
      const message = err instanceof Error ? err.message : String(err);
      const isNetworkError =
        message === "Load failed" ||
        message === "Failed to fetch" ||
        message.includes("NetworkError") ||
        message.includes("network");
      if (isNetworkError) {
        toast.error(
          "Network error. Check your connection and try again. If the problem continues, try again in a few minutes."
        );
      } else {
        toast.error(message || "An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Verifying your link...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Enter your new password</h2>
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

'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import LinkedInAuthButton from "@/components/auth/LinkedInAuthButton";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { claimOAuthRetry, isStateReplayError } from "@/lib/auth/oauthRetry";
import { startOAuth } from "@/lib/auth/startOAuth";
import { sameSitePath } from "@/lib/auth/sameSitePath";
import WhatsAppAuth, { WHATSAPP_SIGNIN } from "@/components/auth/WhatsAppAuth";
import OtherWays from "@/components/auth/OtherWays";

interface LoginFormProps {
  onSuccess?: () => void;
}

/** One more decode, for links that encoded the target twice; a malformed
 *  one reads as no target. */
function decodedOnce(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export default function LoginForm({ onSuccess }: LoginFormProps = {}) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // With WhatsApp on, the page opens on the number and Email opens the
  // email form (backend N232).
  const [showEmail, setShowEmail] = useState(false);
  // Carry "where to go after" (e.g. the booking page) through to sign-up.
  const [signupHref, setSignupHref] = useState("/signup");
  useEffect(() => {
    const back = new URLSearchParams(window.location.search).get("redirectTo");
    if (back) setSignupHref(`/signup?redirectTo=${encodeURIComponent(back)}`);
  }, []);

  // Show error toast if redirected here after failed OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "oauth_failed") {
      const detail = params.get("detail");
      console.error("[OAuth] failed:", detail);

      // The provider's answer reached Supabase twice and the second was
      // refused. Start the same sign-in over once, silently — see
      // src/lib/auth/oauthRetry.ts. A second refusal lands here again with
      // the restart already claimed and shows the ordinary toast.
      if (isStateReplayError(params.get("error_code"), detail)) {
        const provider = claimOAuthRetry();
        if (provider) {
          console.warn("[OAuth] replayed state — restarting sign-in once:", provider);
          void startOAuth(provider)
            .then((failure) => {
              if (failure) toast.error("Sign-in failed. Please try again.");
            })
            .catch(() => toast.error("Sign-in failed. Please try again."));
          return;
        }
      }

      toast.error("Sign-in failed. Please try again.");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Clear any stale session/refresh token so we don't get "Refresh Token Not Found" after login
      await supabase.auth.signOut();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error);
        
        // Handle specific errors
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password");
          return;
        }
        
        if (error.message.includes("Email not confirmed")) {
          toast.error("Please check your email and confirm your account first");
          return;
        }
        
        toast.error(error.message || "Login failed");
        return;
      }

      // Verify session was created
      const { data: { session: newSession } } = await supabase.auth.getSession();
      
      if (!newSession) {
        toast.error("Session not created. Please try again.");
        return;
      }

      // Call server route to ensure httpOnly cookies are set server-side
      try {
        const confirmRes = await fetch("/api/auth/confirm-session", {
          method: "POST",
          credentials: "include", // Important: include cookies
        });

        if (!confirmRes.ok) {
          console.error("Failed to confirm session on server");
        }
      } catch (err) {
        console.error("Error confirming session:", err);
      }

      // Check for redirectTo parameter (from email links or protected routes).
      // Only a page on this site, checked AFTER decoding: get() has decoded
      // once already, so "/%2Fevil.com" would decode to "//evil.com".
      const searchParams = new URLSearchParams(window.location.search);
      const redirectTo = sameSitePath(decodedOnce(searchParams.get("redirectTo")));

      // Brief delay so cookies are committed before navigation
      await new Promise((r) => setTimeout(r, 200));

      if (onSuccess) {
        onSuccess();
        return;
      }

      // If there's an explicit redirect target on this site, honour it;
      // anything else falls through to the smart redirect below.
      if (redirectTo) {
        // replace, not push — so Back from the destination never returns here.
        setTimeout(() => router.replace(redirectTo), 100);
        return;
      }

      // Smart redirect via /api/results/state — every branch lands
      // on /chat now (the standalone /results surface was retired):
      //   - completed   → /chat?session=<id>  (review loop)
      //   - processing  → /chat?session=<id>  (Q&A while waiting)
      //   - no_session  → /chat               (cold-start onboarding)
      // /chat's phase machine resolves the right sub-surface either
      // way, so a failed state call just falls through to /chat.
      try {
        const stateRes = await fetch("/api/results/state", {
          cache: "no-store",
        });
        if (stateRes.ok) {
          const data = (await stateRes.json()) as
            | { kind: "no_session" }
            | { kind: "processing"; session_id: string }
            | { kind: "completed"; session_id: string };
          if (data.kind === "completed" || data.kind === "processing") {
            router.replace(
              `/chat?session=${encodeURIComponent(data.session_id)}`
            );
            return;
          }
        }
      } catch {
        /* non-fatal — fall through to /chat */
      }
      router.replace("/chat");
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const signUpLine = (
    <p className="text-center text-base sm:text-sm">
      Don&apos;t have an account?{" "}
      <Link href={signupHref} className="text-orange-500 hover:underline">
        Sign up
      </Link>
    </p>
  );

  // The page opens on the WhatsApp number (founder 2026-10-28, backend
  // N232): the number and "Sign in with WhatsApp", then the other ways.
  if (WHATSAPP_SIGNIN && !showEmail) {
    return (
      <Card className="min-w-0 p-6 sm:p-7">
        <WhatsAppAuth mode="login" first onSuccess={onSuccess}
          after={(
            <>
              <OtherWays mode="login" onEmail={() => setShowEmail(true)} />
              {signUpLine}
            </>
          )} />
      </Card>
    );
  }

  return (
    <Card className="min-w-0 p-4 sm:p-6">
      {WHATSAPP_SIGNIN ? (
        <div className="mb-4 flex flex-col gap-1">
          <button type="button" onClick={() => setShowEmail(false)}
            className="min-h-[44px] self-start text-sm text-muted-foreground hover:underline">
            ← Back
          </button>
          <h2 className="text-base font-semibold">Sign in with email</h2>
        </div>
      ) : (
      <div className="mb-4 space-y-3">
        <LinkedInAuthButton mode="login" />
        <GoogleAuthButton mode="login" />

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>
      </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="mb-2 block text-base font-medium sm:text-sm">Email</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="mb-2 block text-base font-medium sm:text-sm">Password</label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="mt-4 space-y-2 text-center text-base sm:text-sm">
        {signUpLine}
        <p>
          <Link
            href="/reset-password"
            className="text-orange-500 hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </div>
    </Card>
  );
}


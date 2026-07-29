'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import LinkedInAuthButton from "@/components/auth/LinkedInAuthButton";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import SpeakerSexQuestion from "@/components/willab/SpeakerSexQuestion";
import type { ProfileSex } from "@/services/api/userProfile";

interface SignupFormProps {
  onSuccess?: () => void;
  /** Skip the provider picker and go straight to the email form. */
  skipProviderPicker?: boolean;
}

export default function SignupForm({ onSuccess, skipProviderPicker }: SignupFormProps = {}) {
  const router = useRouter();
  const supabase = createClient();
  const [showEmailForm, setShowEmailForm] = useState(!!skipProviderPicker);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Optional, and deliberately never validated: leaving it blank is a valid
  // outcome. SpeakerSexPrompt asks again later, which is also the only path
  // for LinkedIn/Google signups since those never reach this form.
  const [sex, setSex] = useState<ProfileSex | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Client-side validation ─────────────────────────────────────────
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    // Consent is also validated server-side, but we give immediate feedback
    // here so the user doesn't have to wait for a network round-trip.
    if (!termsAccepted) {
      toast.error(
        "You must accept the Terms of Service and Privacy Policy to create an account."
      );
      return;
    }

    setLoading(true);

    try {
      // ── 1. Call backend via BFF — validates consent, creates user, ────
      //       records terms_accepted_at, returns session tokens.
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim(),
          terms_accepted: true, // validated above; always true at this point
          // Omitted entirely when unanswered, so the BE stores NULL ("never
          // asked") rather than a value we invented. Never inferred here.
          ...(sex ? { sex } : {}),
        }),
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code = resData?.code as string | undefined;
        const message = resData?.error as string | undefined;

        if (code === "TERMS_NOT_ACCEPTED") {
          toast.error(
            "You must accept the Terms of Service and Privacy Policy to register."
          );
          return;
        }
        if (code === "EMAIL_IN_USE" || res.status === 409) {
          toast.error("This email is already registered. Please sign in instead.");
          router.push("/login");
          return;
        }
        toast.error(message ?? "Registration failed. Please try again.");
        return;
      }

      // ── 2. Establish the browser session using the tokens returned ────
      //       by the backend so the Supabase client is immediately authed.
      const accessToken: string | undefined = resData.access_token;
      const refreshToken: string | undefined = resData.refresh_token;

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }

      toast.success("Account created! Redirecting…");

      // ── 3. Sync httpOnly cookies server-side ─────────────────────────
      try {
        await fetch("/api/auth/confirm-session", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        /* non-fatal */
      }

      if (onSuccess) {
        onSuccess();
        return;
      }

      // ── 4. Smart redirect ─────────────────────────────────────────────
      // Hit /api/results/state to learn whether this user has any session.
      // Every branch lands on /chat now — the standalone /results
      // surface was retired and /chat's phase machine handles the rest:
      //   - completed   → /chat?session=<id>  (review loop)
      //   - processing  → /chat?session=<id>  (Q&A fallback for pending)
      //   - no_session  → /chat               (cold-start onboarding)
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
            // replace, not assign — keep the signup page out of the back stack.
            window.location.replace(
              `/chat?session=${encodeURIComponent(data.session_id)}`
            );
            return;
          }
        }
      } catch {
        /* non-fatal — fall through to /chat */
      }

      setTimeout(() => {
        window.location.replace("/chat");
      }, 100);

    } catch (err) {
      console.error("Signup exception:", err);
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  // Provider picker: LinkedIn vs email
  if (!showEmailForm) {
    return (
      <Card className="p-5 sm:p-6">
        {/* Auth provider buttons + OR separator share equal vertical padding
            (my-5 above and below the rule) so the column reads as a single
            visual rhythm. */}
        <div className="flex flex-col">
          <LinkedInAuthButton mode="signup" />
          <GoogleAuthButton mode="signup" className="mt-3" />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="default"
            className="w-full font-medium"
            onClick={() => setShowEmailForm(true)}
          >
            Sign up with email
          </Button>
        </div>

        <LegalConsent />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Name</label>
          <Input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Email</label>
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
          <label className="mb-2 block text-sm font-medium">Password</label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">
            Confirm Password
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        {/* Optional. No `required`, and the submit button below is NOT gated
            on it: a forced answer would be a random answer, and a wrong value
            flips the pitch cue for that user, which is strictly worse than the
            sex-blind fallback we ship today. */}
        <SpeakerSexQuestion
          value={sex}
          onChange={setSex}
          disabled={loading}
          className="rounded-lg border border-border bg-muted/30 p-3"
        />

        {/* Legal consent checkbox — required before account creation.
            Gating the submit button ensures the user actively ticks the box
            before any data is sent; the backend validates terms_accepted=true
            as a second, server-side enforcement layer. */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <input
            id="terms"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            disabled={loading}
            required
            aria-required="true"
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
          />
          <label
            htmlFor="terms"
            className="cursor-pointer text-sm leading-snug text-muted-foreground"
          >
            I have read and agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2 hover:no-underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2 hover:no-underline"
            >
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !termsAccepted}
        >
          {loading ? "Creating account…" : "Sign up"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setShowEmailForm(false)}
        className="mt-3 block w-full text-center text-sm text-muted-foreground hover:underline"
      >
        Back to sign up options
      </button>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

/**
 * Frictionless legal consent — sits above the submit CTA and tells the user
 * that clicking it constitutes acceptance. Per spec we deliberately don't
 * gate submission on a checkbox; the descriptive claim is sufficient.
 * Links open in a new tab so the auth flow isn't lost.
 */
function LegalConsent() {
  return (
    <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
      By signing up, you agree to our{" "}
      <Link
        href="/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary hover:underline"
      >
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary hover:underline"
      >
        Privacy Policy
      </Link>
      .
    </p>
  );
}


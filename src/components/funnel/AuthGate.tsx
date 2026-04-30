"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const CALLBACK_PATH = "/auth/callback";

function MockDashboardBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-background to-purple-50" />
      <div className="relative h-full w-full p-8 opacity-60 blur-xl">
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-40 rounded bg-foreground/30" />
            <div className="h-6 w-24 rounded bg-foreground/20" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 rounded-xl bg-orange-300/40" />
            <div className="h-32 rounded-xl bg-purple-300/40" />
            <div className="h-32 rounded-xl bg-blue-300/40" />
          </div>
          <div className="h-48 rounded-xl bg-foreground/15" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-28 rounded-xl bg-foreground/15" />
            <div className="h-28 rounded-xl bg-foreground/15" />
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" />
    </div>
  );
}

export default function AuthGate() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${CALLBACK_PATH}`
      : CALLBACK_PATH;

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loadingMagic) return;
    setLoadingMagic(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: callbackUrl,
          shouldCreateUser: true,
        },
      });
      if (error) {
        toast.error(error.message || "Could not send magic link.");
        return;
      }
      setMagicLinkSent(true);
      toast.success("Check your email for the sign-in link.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoadingMagic(false);
    }
  };

  const handleGoogle = async () => {
    if (loadingGoogle) return;
    setLoadingGoogle(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl },
      });
      if (error) {
        toast.error(error.message || "Google sign-in is not configured.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="relative min-h-[600px] w-full overflow-hidden rounded-2xl">
      <MockDashboardBackdrop />
      <div className="relative z-10 flex min-h-[600px] items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 shadow-2xl">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold">
              Analysis Complete! <span aria-hidden>🎯</span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a free account to unlock your personal voice analysis.
            </p>
          </div>

          {magicLinkSent ? (
            <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm">
              <p className="font-medium text-orange-900">Check your inbox.</p>
              <p className="text-orange-800">
                We sent a sign-in link to <strong>{email}</strong>. Click it to see your
                analysis.
              </p>
              <button
                type="button"
                className="text-orange-700 underline"
                onClick={() => setMagicLinkSent(false)}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleMagicLink}>
              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loadingMagic}
                  autoComplete="email"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={loadingMagic || !email.trim()}
              >
                {loadingMagic ? "Sending link…" : "Email me a sign-in link"}
              </Button>
            </form>
          )}

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={loadingGoogle}
          >
            {loadingGoogle ? "Redirecting…" : "Continue with Google"}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing you agree to our terms. We'll never share your recording.
          </p>
        </Card>
      </div>
    </div>
  );
}

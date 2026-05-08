"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/**
 * "We are analyzing your voice baseline" screen.
 *
 * Shared between /results (overview) and /results/[sessionId] so both
 * surfaces look identical when the admin hasn't published yet. Fetches
 * the founder video from /api/public/funnel/afterwards-video on mount;
 * gracefully renders a Play-icon placeholder until the URL resolves
 * (or if the backend has nothing configured).
 *
 * Sign-out replaces the old "Return to Homepage" CTA — most users at
 * this point have nowhere meaningful to go on the marketing site, but
 * a sign-out is a real action they understand.
 */
export default function ProcessingState() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/funnel/afterwards-video")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const v = data?.video_url;
        if (typeof v === "string" && v) setVideoUrl(v);
        setVideoLoading(false);
      })
      .catch(() => {
        if (!cancelled) setVideoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      console.error("Sign out failed:", err);
      toast.error("Sign out failed. Please try again.");
      setSigningOut(false);
    }
  };

  return (
    <main
      className="animate-fade-in-up mx-auto flex min-h-[80vh] w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center"
      aria-live="polite"
    >
      {/* Pulsing status badge */}
      <span className="inline-flex animate-pulse items-center rounded-full border border-border px-3 py-1 text-xs">
        ⏳ Analysis in Progress
      </span>

      {/* Header */}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        We are analyzing your voice baseline.
      </h1>

      {/* Vertical 9:16 founder video */}
      <div className="relative mx-auto flex aspect-[9/16] w-64 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-border bg-muted sm:w-72">
        {videoLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        ) : videoUrl ? (
          <video
            src={videoUrl}
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            aria-label="Founder message"
          />
        ) : (
          // No video configured yet — keep the design intent (play icon
          // + caption) so the layout doesn't collapse to empty.
          <>
            <button
              type="button"
              aria-label="Founder message unavailable"
              disabled
              className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play className="h-6 w-6 fill-current" aria-hidden />
            </button>
            <p className="text-sm font-medium text-muted-foreground">
              Founder Message
            </p>
          </>
        )}
      </div>

      {/* Description */}
      <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-muted-foreground sm:max-w-sm">
        Our AI engine and expert coaches are currently extracting your
        Charisma and Stress snippets. This process usually takes a little
        while. You can safely close this page — we will email you the
        moment your customized insights are ready.
      </p>

      {/* Sign-out — closer to the user's actual desire here than "Home" */}
      <Button
        type="button"
        variant="outline"
        className="mt-4 rounded-full"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </main>
  );
}

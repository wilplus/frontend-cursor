"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/**
 * "Analysis in progress" screen.
 *
 * Shared between /results (overview) and /results/[sessionId] so both
 * surfaces look identical when the admin hasn't published yet.
 *
 * Video resolution: we ship a local founder message at
 * /videos/founder-message.mp4 as the always-available default. The
 * BFF (/api/public/funnel/afterwards-video) can override it if the
 * backend has configured a different (e.g. CDN-hosted) clip. This
 * means the card NEVER renders an empty/placeholder state — the user
 * always has something to play while they wait.
 *
 * Sign-out replaces the old "Return to Homepage" CTA — most users at
 * this point have nowhere meaningful to go on the marketing site, but
 * a sign-out is a real action they understand.
 */
const FALLBACK_VIDEO_URL = "/videos/founder-message.mp4";

export default function ProcessingState() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState<string>(FALLBACK_VIDEO_URL);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/funnel/afterwards-video")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const v = data?.video_url;
        if (typeof v === "string" && v) setVideoUrl(v);
      })
      .catch(() => {
        // Keep local fallback — nothing to do.
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

      {/* Vertical 9:16 founder video */}
      <div className="relative mx-auto aspect-[9/16] w-64 overflow-hidden rounded-2xl border border-border bg-muted sm:w-72">
        <video
          src={videoUrl}
          className="h-full w-full object-cover"
          controls
          playsInline
          preload="metadata"
          aria-label="Founder message"
        />
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

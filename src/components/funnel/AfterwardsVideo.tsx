"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import SectionCard from "@/components/admin/SectionCard";

interface AfterwardsVideoResponse {
  video_url?: string | null;
}

type Phase = "loading" | "playing" | "missing" | "error";

export default function AfterwardsVideo() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/public/funnel/afterwards-video");
        if (cancelled) return;
        if (!resp.ok) {
          setPhase("error");
          return;
        }
        const data = (await resp.json()) as AfterwardsVideoResponse | null;
        const url = data?.video_url;
        if (typeof url !== "string" || !url) {
          setPhase("missing");
          return;
        }
        setVideoUrl(url);
        setPhase("playing");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" aria-hidden />
      </div>
    );
  }

  if (phase === "missing") {
    return (
      <SectionCard title="Thanks for recording">
        <p className="text-sm text-muted-foreground">
          We&apos;ve got your clip. We&apos;ll review it and follow up shortly.
        </p>
      </SectionCard>
    );
  }

  if (phase === "error") {
    return (
      <SectionCard title="Thanks for recording">
        <p className="text-sm text-muted-foreground">
          Your recording was saved. We&apos;ll be in touch.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="w-full">
      {videoUrl && (
        <video
          src={videoUrl}
          className="aspect-video w-full rounded-xl bg-black shadow-sm"
          controls
          autoPlay
          playsInline
        />
      )}
    </div>
  );
}

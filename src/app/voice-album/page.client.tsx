"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import LoadingState from "@/components/willab/LoadingState";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import { useRouter } from "next/navigation";
import {
  fetchVoiceAlbum,
  type VoiceAlbumEntry,
} from "@/services/api/voiceAlbum";

export default function VoiceAlbumPageClient({
  initialProjectId,
}: {
  initialProjectId: string | null;
}) {
  const router = useRouter();
  const projectId = initialProjectId;
  const [entries, setEntries] = useState<VoiceAlbumEntry[] | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "empty" | "error"
  >("loading");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchVoiceAlbum(projectId).then((result) => {
      if (!active) return;
      setEntries(result);
      setStatus(
        result === null ? "error" : result.length === 0 ? "empty" : "ready"
      );
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  const item = entries?.[Math.min(index, Math.max(entries.length - 1, 0))];
  return (
    <main className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background px-5">
      <header className="flex shrink-0 items-center justify-between pt-4">
        <h1 className="text-[17px] font-semibold text-foreground">Voice Album</h1>
        <OverlayCloseButton onClick={() => router.push("/chat")} />
      </header>

      {status === "loading" ? (
        <LoadingState />
      ) : status === "error" ? (
        <Centered>We couldn&apos;t load your Voice Album just now.</Centered>
      ) : status === "empty" || !item || !entries ? (
        <Centered>
          Your Voice Album is empty. Moments appear here only after the
          machine, you, and your coach independently hear confident delivery.
        </Centered>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col justify-center gap-6 py-8">
          <p className="text-center text-[13px] text-muted-foreground">
            {index + 1} / {entries.length}
          </p>
          {item.audioUrl ? (
            <MediaPlayer
              src={item.audioUrl}
              startOffsetMs={item.startOffsetMs ?? 0}
              durationMs={item.durationMs ?? 0}
            />
          ) : null}
          {item.text ? (
            <p className="text-[17px] leading-relaxed text-foreground">
              {item.text}
            </p>
          ) : null}
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Back
            </button>
            <button
              type="button"
              disabled={index >= entries.length - 1}
              onClick={() =>
                setIndex((value) => Math.min(entries.length - 1, value + 1))
              }
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center text-center text-[15px] leading-relaxed text-muted-foreground">
      <p className="max-w-sm">{children}</p>
    </div>
  );
}

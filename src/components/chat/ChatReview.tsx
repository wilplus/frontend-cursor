"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActionBubble,
  DashboardBubble,
  MirrorBubble,
  SnippetPlayerBubble,
  TextBubble,
  type DashboardBubbleData,
  type MirrorBubbleData,
  type SnippetPlayerData,
} from "@/components/chat/RichBubbles";

/* -------------------------------------------------------------------------- */
/*  Backend response shapes the review flow consumes                          */
/* -------------------------------------------------------------------------- */

interface BackendSnippet {
  id: string;
  snippet_type: "charisma" | "stress" | "unlabeled" | null;
  admin_comment: string;
  audio_url: string | null;
  start_offset_ms: number;
  duration_ms: number;
}

interface SnippetsPayload {
  status: string;
  snippets: BackendSnippet[];
  charisma_profile?: {
    archetype?: string;
    narrative?: string;
    trinity?: { power?: number; warmth?: number; presence?: number };
    acoustics?: { pace?: number };
    triggers?: { topTheme?: string };
  } | null;
}

interface MirrorPayload {
  feature_enabled: boolean;
  mirror: {
    headline: string;
    narrative: string;
    observations: string[];
    generated_at: string;
  } | null;
}

/* -------------------------------------------------------------------------- */
/*  ChatReview surface                                                        */
/*                                                                            */
/*  Bubble-driven review of a freshly-published session. Fetches snippets +  */
/*  mirror in parallel, then renders them as a single scrolling thread that  */
/*  ends with a "Ready to practice?" CTA. The CTA hands off to the parent's  */
/*  onPracticeStart callback, which cuts a NEW backend session for the      */
/*  roleplay phase (per the spec — review writes back to the old session,    */
/*  roleplay gets a new one).                                                */
/* -------------------------------------------------------------------------- */

interface ChatReviewProps {
  sessionId: string;
  /** Called when the user taps the final "Ready to practice" CTA.
   *  Parent transitions to the roleplay phase (new session). */
  onPracticeStart: () => void;
}

export default function ChatReview({
  sessionId,
  onPracticeStart,
}: ChatReviewProps) {
  const [snippets, setSnippets] = useState<SnippetPlayerData[]>([]);
  const [dashboardData, setDashboardData] =
    useState<DashboardBubbleData | null>(null);
  const [mirror, setMirror] = useState<MirrorBubbleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Per-snippet local state: which option the user picked (null until
   *  they tap) and whether the POST is in flight. Indexed by snippet id. */
  const [labels, setLabels] = useState<
    Record<string, { value: string | null; submitting: boolean }>
  >({});
  const [mirrorDeleting, setMirrorDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [snipRes, mirrorRes] = await Promise.all([
          fetch(`/api/results/${sessionId}/snippets`, { cache: "no-store" }),
          fetch("/api/v2/user/mirror", { cache: "no-store" }),
        ]);
        if (cancelled) return;

        if (!snipRes.ok) {
          setError("Couldn't load this session's snippets.");
          return;
        }
        const snipData = (await snipRes.json()) as SnippetsPayload;
        if (cancelled) return;

        const rawSnippets = Array.isArray(snipData.snippets)
          ? snipData.snippets
          : [];
        setSnippets(rawSnippets.map(mapSnippet));

        if (snipData.charisma_profile) {
          setDashboardData(mapDashboard(snipData.charisma_profile));
        }

        if (mirrorRes.ok) {
          const mData = (await mirrorRes.json()) as MirrorPayload;
          if (mData.feature_enabled && mData.mirror) {
            setMirror({
              headline: mData.mirror.headline,
              narrative: mData.mirror.narrative,
              observations: mData.mirror.observations,
              generatedAt: mData.mirror.generated_at,
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("ChatReview load failed:", err);
          setError("Couldn't load this session's snippets.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleLabel = async (snippetId: string, value: string) => {
    setLabels((prev) => ({
      ...prev,
      [snippetId]: { value, submitting: true },
    }));
    try {
      const res = await fetch(
        `/api/v2/user/snippets/${encodeURIComponent(snippetId)}/label`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_label: value }),
        }
      );
      if (!res.ok) {
        setLabels((prev) => ({
          ...prev,
          [snippetId]: { value: null, submitting: false },
        }));
        return;
      }
      setLabels((prev) => ({
        ...prev,
        [snippetId]: { value, submitting: false },
      }));
    } catch (err) {
      console.warn("label POST failed:", err);
      setLabels((prev) => ({
        ...prev,
        [snippetId]: { value: null, submitting: false },
      }));
    }
  };

  const handleDeleteMirror = async () => {
    if (mirrorDeleting || !mirror) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Delete the current reflection? You can regenerate a fresh one anytime."
      );
      if (!ok) return;
    }
    setMirrorDeleting(true);
    try {
      const res = await fetch("/api/v2/user/mirror", { method: "DELETE" });
      if (res.ok) setMirror(null);
    } catch (err) {
      console.warn("mirror DELETE failed:", err);
    } finally {
      setMirrorDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto py-4">
      <div className="flex flex-col gap-3">
        <TextBubble>
          Here&apos;s what I noticed in your last session. Listen back, tell me
          if I read each moment right, then we&apos;ll practise.
        </TextBubble>

        {dashboardData && <DashboardBubble data={dashboardData} />}

        {mirror && (
          <MirrorBubble
            mirror={mirror}
            onDelete={() => void handleDeleteMirror()}
            deleting={mirrorDeleting}
          />
        )}

        {snippets.length === 0 ? (
          <TextBubble>
            No snippets came through for this session — your coach is still
            preparing your insights.
          </TextBubble>
        ) : (
          snippets.map((s) => {
            const labelState = labels[s.id] ?? {
              value: null,
              submitting: false,
            };
            return (
              <div key={s.id} className="flex flex-col gap-2">
                <SnippetPlayerBubble snippet={s} />
                <ActionBubble
                  prompt="Do you agree with this insight?"
                  options={[
                    {
                      value: s.type,
                      label:
                        s.type === "charisma"
                          ? "YES, this is Charisma"
                          : "YES, this is Stress",
                    },
                    {
                      value: s.type === "charisma" ? "stress" : "charisma",
                      label:
                        s.type === "charisma"
                          ? "NO, this is Stress"
                          : "NO, this is Charisma",
                      variant: "outline",
                    },
                  ]}
                  selected={labelState.value}
                  submitting={labelState.submitting}
                  onSelect={(v) => void handleLabel(s.id, v)}
                />
              </div>
            );
          })
        )}

        {snippets.length > 0 && (
          <>
            <TextBubble>
              Ready to put one of these into practice? I&apos;ll run a short
              roleplay — two minutes max.
            </TextBubble>
            <div className="flex justify-center px-4 py-2">
              <Button
                type="button"
                size="lg"
                onClick={onPracticeStart}
                className="rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:shadow-lg"
              >
                Start practice (2 min)
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Backend → bubble shape mappers                                            */
/* -------------------------------------------------------------------------- */

function mapSnippet(s: BackendSnippet): SnippetPlayerData {
  const type: "charisma" | "stress" =
    s.snippet_type === "stress" ? "stress" : "charisma";
  return {
    id: s.id,
    type,
    badgeLabel: type === "charisma" ? "Charisma Highlight" : "Stress Indicator",
    insight: (s.admin_comment ?? "").trim(),
    audioUrl: s.audio_url,
    startOffsetMs: s.start_offset_ms ?? 0,
    durationMs: s.duration_ms ?? 0,
  };
}

function mapDashboard(
  profile: NonNullable<SnippetsPayload["charisma_profile"]>
): DashboardBubbleData {
  return {
    archetype: profile.archetype ?? "Your charisma profile",
    narrative: profile.narrative ?? "",
    trinity: {
      power: profile.trinity?.power ?? 0,
      warmth: profile.trinity?.warmth ?? 0,
      presence: profile.trinity?.presence ?? 0,
    },
    acousticsPace: profile.acoustics?.pace ?? null,
    stickyTopic: profile.triggers?.topTheme ?? null,
  };
}

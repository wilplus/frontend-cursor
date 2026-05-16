"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActionBubble,
  DashboardBubble,
  SnippetPlayerBubble,
  type DashboardBubbleData,
  type SnippetPlayerData,
} from "@/components/chat/RichBubbles";

/* -------------------------------------------------------------------------- */
/*  Backend response shape                                                    */
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
    trinity?: { power?: number; warmth?: number; presence?: number };
  } | null;
}

/* -------------------------------------------------------------------------- */
/*  ChatReview — Calm-Anchor-only review surface                              */
/*                                                                            */
/*  Per the "Single Surface" spec we strip the review down to the bare       */
/*  essentials:                                                               */
/*    • One DashboardBubble (Calm Anchor + 3 trinity bars), if we have data. */
/*    • Per snippet: SnippetPlayerBubble + ActionBubble (YES / NO).          */
/*    • The moment the user taps a YES/NO inside an ActionBubble it          */
/*      vanishes from the feed — instead a right-anchored user bubble        */
/*      with their choice is appended, keeping the thread chronological.    */
/*    • Bottom toolbar is a single-slot affair. It's empty while any         */
/*      ActionBubble remains unresolved; when all are resolved the           */
/*      [Start Practice (2 min)] button mounts there for the roleplay        */
/*      handoff.                                                              */
/*                                                                            */
/*  Mirror / Delete-reflection / intro narrative all removed in this pass.   */
/* -------------------------------------------------------------------------- */

interface ChatReviewProps {
  sessionId: string;
  /** Called when the user taps the bottom-toolbar "Start practice" CTA. */
  onPracticeStart: () => void;
}

interface UserChoice {
  snippetId: string;
  value: string;
  label: string;
}

export default function ChatReview({
  sessionId,
  onPracticeStart,
}: ChatReviewProps) {
  const [snippets, setSnippets] = useState<SnippetPlayerData[]>([]);
  const [dashboardData, setDashboardData] =
    useState<DashboardBubbleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Per-snippet local state: `submitting` while the label POST is in
   *  flight, `choice` is the resolved value once the click completes.
   *  When choice is set the inline ActionBubble unmounts. */
  const [labels, setLabels] = useState<
    Record<
      string,
      { choice: string | null; submitting: boolean; labelDisplay: string }
    >
  >({});
  /** User choice bubbles to inject into the chronological feed once
   *  the ActionBubble disappears — surfaces the user's answer as a
   *  right-anchored chat bubble so the thread reads like a real
   *  conversation rather than a form. */
  const [userChoices, setUserChoices] = useState<UserChoice[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/results/${sessionId}/snippets`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          setError("Couldn't load this session's snippets.");
          return;
        }
        const data = (await res.json()) as SnippetsPayload;
        if (cancelled) return;
        const rawSnippets = Array.isArray(data.snippets) ? data.snippets : [];
        setSnippets(rawSnippets.map(mapSnippet));
        if (data.charisma_profile?.trinity) {
          setDashboardData({
            trinity: {
              power: data.charisma_profile.trinity.power ?? 0,
              warmth: data.charisma_profile.trinity.warmth ?? 0,
              presence: data.charisma_profile.trinity.presence ?? 0,
            },
          });
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

  const handleLabel = async (
    snippetId: string,
    value: string,
    label: string
  ) => {
    setLabels((prev) => ({
      ...prev,
      [snippetId]: { choice: null, submitting: true, labelDisplay: label },
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
        // Roll back so the user can retry without losing the bubble.
        setLabels((prev) => ({
          ...prev,
          [snippetId]: { choice: null, submitting: false, labelDisplay: label },
        }));
        return;
      }
      // Success — collapse the ActionBubble out of the stream and
      // record the choice as a user-text bubble so the chat thread
      // stays chronological.
      setLabels((prev) => ({
        ...prev,
        [snippetId]: { choice: value, submitting: false, labelDisplay: label },
      }));
      setUserChoices((prev) => [...prev, { snippetId, value, label }]);
    } catch (err) {
      console.warn("label POST failed:", err);
      setLabels((prev) => ({
        ...prev,
        [snippetId]: { choice: null, submitting: false, labelDisplay: label },
      }));
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

  // All snippets resolved? The bottom toolbar swaps in [Start
  // Practice]; otherwise the slot stays empty (per the single-slot
  // dynamic toolbar rule — buttons hide the mic, but here there's
  // no mic on the review surface, just the contextual CTA when
  // it's time to transition).
  const allLabelled =
    snippets.length > 0 &&
    snippets.every((s) => labels[s.id]?.choice != null);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
        {dashboardData && <DashboardBubble data={dashboardData} />}

        {snippets.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No snippets came through for this session — your coach is still
            preparing your insights.
          </p>
        )}

        {snippets.map((s) => {
          const labelState = labels[s.id] ?? {
            choice: null,
            submitting: false,
            labelDisplay: "",
          };
          const choiceBubble = userChoices.find((c) => c.snippetId === s.id);
          return (
            <div key={s.id} className="flex flex-col gap-2">
              <SnippetPlayerBubble snippet={s} />
              {/* ActionBubble lives in the feed only while
                  unresolved. Once a label sticks, it disappears and
                  the user's choice surfaces as a right-anchored
                  user bubble in its place. */}
              {labelState.choice == null && (
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
                  selected={null}
                  submitting={labelState.submitting}
                  onSelect={(value) => {
                    const labelText =
                      value === s.type
                        ? s.type === "charisma"
                          ? "YES, this is Charisma"
                          : "YES, this is Stress"
                        : s.type === "charisma"
                        ? "NO, this is Stress"
                        : "NO, this is Charisma";
                    void handleLabel(s.id, value, labelText);
                  }}
                />
              )}
              {choiceBubble && <UserChoiceBubble text={choiceBubble.label} />}
            </div>
          );
        })}
      </div>

      {/* Bottom toolbar — single slot, contextual button only.
          Hidden while ActionBubbles are pending so it doesn't compete
          for attention; the [Start Practice] CTA mounts here as soon
          as the user labels every snippet. */}
      {allLabelled && (
        <div className="shrink-0 px-4 pb-4 pt-2">
          <Button
            type="button"
            size="lg"
            onClick={onPracticeStart}
            className="w-full rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:shadow-lg sm:w-auto sm:mx-auto sm:flex"
          >
            Start practice (2 min)
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  User-choice bubble — right-anchored echo of what the user picked          */
/* -------------------------------------------------------------------------- */

function UserChoiceBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end animate-fade-in-up">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-chat-bubble-user px-4 py-2.5 text-sm leading-relaxed text-chat-bubble-user-foreground shadow-sm">
        {text}
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

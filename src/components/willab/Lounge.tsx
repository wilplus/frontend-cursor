"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postChatQuery } from "@/services/api/chatQuery";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { ReviewQueueRow } from "@/services/api/reviewQueue";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import { loungeToHistory } from "./willabHelpers";
import ReportCard from "./ReportCard";
import InsightsOverlay from "./InsightsOverlay";
import LibraryOverlay from "./LibraryOverlay";
import HistoryOverlay from "./HistoryOverlay";
import { clearInsightsReady, getInsightsReady } from "./sendStatus";
import { type WillabState } from "./useWillabFlow";
import { useUserProfile } from "./useUserProfile";
import { useReviewQueue } from "./useReviewQueue";
import CoachReviewBubble from "./CoachReviewBubble";
import CoachReviewOverlay from "./CoachReviewOverlay";

/* -------------------------------------------------------------------------- */
/*  Lounge — the always-mounted science-chat home (§3 / §6a / §7)             */
/*                                                                            */
/*  Replaces the LoungeStub: a persistent thread (useLoungeThread — server     */
/*  when signed in, localStorage when not), a librarian bot over the existing  */
/*  /v2/chat/query endpoint (we read `.answer`; the funnel-only flags are      */
/*  ignored), the single-active status region (§6a: parked / review / ready),  */
/*  and the entry into the Lab. Audio, KPIs and labels live in the Lab — the   */
/*  Lounge is text-only and never judges (§7 librarian-not-judge).            */
/*                                                                            */
/*  Coach-mode addition (§F.1): when the signed-in user's profile carries     */
/*  `is_coach: true`, the chat thread also surfaces review-queue rows as       */
/*  inbound bubbles, chronologically interleaved with regular messages.        */
/*  Non-coach users see exactly the same Lounge as before.                    */
/* -------------------------------------------------------------------------- */

/** Discriminated union of items rendered in the Lounge thread. Carries the
 *  sort key + react key explicitly so the merge stays type-safe. */
type ThreadItem =
  | {
      kind: "message";
      sortKey: string;
      reactKey: string;
      message: LoungeMessage;
    }
  | {
      kind: "review";
      sortKey: string;
      reactKey: string;
      row: ReviewQueueRow;
    };

export default function Lounge({
  state,
  onStart,
  goTo,
}: {
  state: WillabState;
  onStart: () => void;
  goTo: (s: WillabState) => void;
}) {
  const thread = useLoungeThreadCtx();
  const { messages, reload } = thread;
  const [draftText, setDraftText] = useState("");
  const [botThinking, setBotThinking] = useState(false);
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // §F.0 / §F.1 — coach-mode surface. is_coach is the RENDER gate (the BE
  // role-gates each endpoint independently via require_admin_or_coach, so a
  // tampered FE flag wouldn't get past the upstream wall). Non-coach users
  // see exactly the same Lounge as today.
  const { isCoach } = useUserProfile();
  const reviewQueue = useReviewQueue(isCoach);
  // §F.2 — overlay sessionId. null = closed. Setting to a sessionId mounts
  // the CoachReviewOverlay over the Lounge; closing it returns to the chat
  // thread underneath with no remount of the queue.
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);

  // Interleave the coach's review queue rows with regular Lounge messages so
  // a "new session ready to label" bubble appears chronologically alongside
  // the rest of the chat — that's the §3 design ("message in his chat from
  // that user"). Sort by created_at / sent_at ascending so oldest sits at
  // the top and newest at the bottom (matching how the existing thread
  // already reads).
  const threadItems = useMemo<ThreadItem[]>(() => {
    const items: ThreadItem[] = messages.map((m) => ({
      kind: "message",
      sortKey: m.client_created_at,
      reactKey: m.client_id,
      message: m,
    }));
    if (isCoach) {
      for (const row of reviewQueue.rows) {
        items.push({
          kind: "review",
          sortKey: row.sentAt || "",
          reactKey: `review:${row.sessionId}`,
          row,
        });
      }
    }
    items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return items;
  }, [messages, isCoach, reviewQueue.rows]);

  // §F.2 — open the review overlay over the Lounge. No navigation: the chat
  // thread stays mounted beneath the overlay so closing returns the coach
  // to the same scroll position, same queue, same chat history. The
  // overlay refetches via useCoachReview on its own.
  function openReview(sessionId: string): void {
    setReviewSessionId(sessionId);
  }

  function closeReview(): void {
    setReviewSessionId(null);
    // Refresh the queue so the bubble's state badge (pending → in_progress)
    // reflects any per-snippet saves the coach made inside the overlay.
    void reviewQueue.refresh();
  }

  // Voice input has been removed from the Lounge (product call): only
  // the **official recording** holds the mic. Off-task chat is
  // text-only — keeps the Lounge composer visually distinct from the
  // Lab's "Start official recording" CTA so users never confuse the
  // calm off-stage surface with the high-stakes on-stage one. The
  // Web Speech machinery (`useSpeechInput`) stays in the tree for
  // now in case a future surface (e.g. an accessibility opt-in) wants
  // to bring it back, but the Lounge no longer calls it.

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, botThinking]);

  // §6c: when the coach publishes (status flips to insights_ready), pull the
  // thread so the BE-appended "insights ready" ping shows in-chat at once — the
  // status card already flips live. The BE is the sole writer; we only re-read.
  useEffect(() => {
    if (state === "insights_ready") void reload();
  }, [state, reload]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const q = draftText.trim();
    if (!q || botThinking) return;
    const history = loungeToHistory(messages); // snapshot of prior turns (pre-append)
    setDraftText("");
    await thread.append({ role: "user", kind: "text", body: q });
    setBotThinking(true);
    try {
      const resp = await postChatQuery({ question: q, history });
      const answer = (resp.answer ?? "").trim();
      await thread.append({
        role: "bot",
        kind: "text",
        body: answer || "I didn't quite catch that — mind putting it another way?",
      });
    } catch {
      await thread.append({
        role: "bot",
        kind: "text",
        body: "I'm having trouble reaching the lab right now — give it another try in a moment.",
      });
    } finally {
      setBotThinking(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <StatusRegion state={state} goTo={goTo} onViewReadout={setActiveInsight} />

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {thread.hasMore && (
          <button
            type="button"
            onClick={() => void thread.loadOlder()}
            disabled={thread.loadingOlder}
            className="mx-auto text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {thread.loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}

        {thread.loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : threadItems.length === 0 ? (
          <LoungeEmptyState />
        ) : (
          threadItems.map((item) =>
            item.kind === "message" ? (
              <Bubble
                key={item.reactKey}
                message={item.message}
                onViewInsights={setActiveInsight}
              />
            ) : (
              <CoachReviewBubble
                key={item.reactKey}
                row={item.row}
                onOpen={openReview}
              />
            )
          )
        )}

        {botThinking && (
          <div className="mr-auto rounded-2xl bg-muted px-3 py-2 text-[15px] text-muted-foreground">
            …
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onStart}
        className="w-full rounded-full"
      >
        ▶ Start official recording
      </Button>
      <div className="flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="text-[13px] text-muted-foreground hover:text-foreground"
        >
          ★ Your strong sides
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="text-[13px] text-muted-foreground hover:text-foreground"
        >
          🕓 Your recordings
        </button>
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Ask about how communication works…"
          /* B9 — kill any autofill / password-manager overlay that can ghost
             a second line of placeholder text over a chat composer. The
             markup is a single clean input, so the reported "doubled
             placeholder" is a runtime overlay or a font-swap flash, not a
             stacked element. These attrs remove the most common overlay
             cause; if the doubling persists on a device it's a font-load
             flash and needs a repro screenshot to pin. */
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-[15px] outline-none focus:border-primary"
          aria-label="Message the willab librarian"
        />
        <Button
          type="submit"
          disabled={!draftText.trim() || botThinking}
          className="rounded-full px-4"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {activeInsight && (
        <InsightsOverlay
          sessionId={activeInsight}
          onClose={() => setActiveInsight(null)}
        />
      )}
      {libraryOpen && <LibraryOverlay onClose={() => setLibraryOpen(false)} />}
      {historyOpen && (
        <HistoryOverlay
          onClose={() => setHistoryOpen(false)}
          onOpenSession={(sid) => {
            setHistoryOpen(false);
            setActiveInsight(sid);
          }}
        />
      )}
      {reviewSessionId && (
        <CoachReviewOverlay
          sessionId={reviewSessionId}
          onClose={closeReview}
        />
      )}
    </div>
  );
}

function Bubble({
  message,
  onViewInsights,
}: {
  message: LoungeMessage;
  onViewInsights?: (sessionId: string) => void;
}) {
  if (message.kind === "recording_summary" || message.kind === "insight") {
    return <ReportCard message={message} onViewInsights={onViewInsights} />;
  }
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-[15px] text-primary-foreground">
        {message.body}
      </div>
    );
  }
  if (message.role === "bot") {
    return (
      <div className="mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
        {message.body}
      </div>
    );
  }
  // system / status / recording_summary / insight → centered meta line
  return (
    <div className="mx-auto max-w-[90%] text-center text-[12px] text-muted-foreground">
      {message.body}
    </div>
  );
}

function LoungeEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <p className="max-w-sm text-[15px] text-foreground">
        Hi — I&apos;m your willab librarian.
      </p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
        Ask me anything about how communication actually works, or hit{" "}
        <span className="font-medium text-foreground">
          Start official recording
        </span>{" "}
        when you want a coach&apos;s read on how you sound.
      </p>
    </div>
  );
}

/* ----------------------------- status region (§6a) ------------------------ */
/*  Single-active by construction: these states are mutually exclusive in the
 *  §8 machine, so at most one card renders. */
function StatusRegion({
  state,
  goTo,
  onViewReadout,
}: {
  state: WillabState;
  goTo: (s: WillabState) => void;
  onViewReadout: (sessionId: string) => void;
}) {
  if (state === "parked") {
    return (
      <StatusCard tone="hold">
        {/* B5 — training vocabulary. */}
        <p className="text-[15px] text-foreground">
          Your training isn&apos;t finished.
        </p>
        {/* TODO(slice: Readout): restore the held Readout data on resume. */}
        <Button
          type="button"
          size="sm"
          onClick={() => goTo("readout")}
          className="mt-2 rounded-full"
        >
          Resume
        </Button>
      </StatusCard>
    );
  }
  if (state === "review_pending") {
    return (
      <StatusCard tone="info">
        {/* B6 — training vocabulary. */}
        <p className="text-[15px] text-foreground">Good job! Training sent!</p>
        {/* B12 (founder decision 2 — time promise): no number yet. Soft,
            no-commit copy until the founder picks "~Xh" / "within a day" /
            no-number. Swap this single line when decided. */}
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Your coach will take it from here — insights land here when
          they&apos;re ready.
        </p>
        {/* B6 / B11: the "View your readout" button is removed — History
            (🕓 Your recordings) is the access path to a sent session. */}
      </StatusCard>
    );
  }
  if (state === "insights_ready") {
    const sid = getInsightsReady();
    return (
      <StatusCard tone="ready">
        <p className="text-[15px] text-foreground">
          Your coach sent through new insights.
        </p>
        {sid ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onViewReadout(sid); // opens the annotated Readout (read → BE library fold §3.11)
              clearInsightsReady();
              goTo("lounge_idle"); // transient: once read, back to the launch CTA (§6a)
            }}
            className="mt-2 rounded-full"
          >
            Read ›
          </Button>
        ) : (
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            They&apos;re saved to your history.
          </p>
        )}
      </StatusCard>
    );
  }
  return null;
}

function StatusCard({
  tone,
  children,
}: {
  tone: "hold" | "info" | "ready";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "ready"
      ? "border-primary/30 bg-primary/5"
      : tone === "hold"
        ? "border-border bg-muted/30"
        : "border-border bg-muted/20";
  return <div className={`rounded-2xl border p-3 ${toneClass}`}>{children}</div>;
}

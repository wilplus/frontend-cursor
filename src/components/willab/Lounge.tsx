"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postChatQuery } from "@/services/api/chatQuery";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { ReviewQueueRow } from "@/services/api/reviewQueue";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import {
  isStrongSidesAsk,
  loungeToHistory,
  splitBotMessage,
} from "./willabHelpers";
import ReportCard from "./ReportCard";
import InsightsOverlay from "./InsightsOverlay";
import LibraryOverlay from "./LibraryOverlay";
import AuditOverlay from "./AuditOverlay";
import ProgressToAuditBubble from "./ProgressToAuditBubble";
import StudentRosterOverlay from "./StudentRosterOverlay";
import { clearInsightsReady } from "./sendStatus";
import { type WillabState } from "./useWillabFlow";
import { useUserProfile } from "./useUserProfile";
import { useReviewQueue } from "./useReviewQueue";
import CoachReviewBubble from "./CoachReviewBubble";
import CoachReviewOverlay from "./CoachReviewOverlay";
import WillabInstallPrompt from "./WillabInstallPrompt";
import {
  CHIP_LABEL,
  coerceSuggestedAction,
  type ChipAction,
} from "./loungePrompts";

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
    }
  | {
      // A-4 / B-2 — the post-send offer + audit-progress, anchored in the thread
      // right after the completed-training card (not pinned to the foot), so new
      // chat sorts below it.
      kind: "postsend";
      sortKey: string;
      reactKey: string;
    }
  | {
      // The "Strong sides" button when the user asks for them — anchored IN the
      // thread like any other bubble, not the sticky foot action button, so it
      // stays put as the conversation continues.
      kind: "strongsides";
      sortKey: string;
      reactKey: string;
    };

export default function Lounge({
  state,
  onStart,
  goTo,
  initialReviewSessionId = null,
  initialInsightSessionId = null,
}: {
  state: WillabState;
  onStart: () => void;
  goTo: (s: WillabState) => void;
  /** U12 — when set (from /chat?review=<id>), open the CoachReviewOverlay for
   *  that session once on mount. Coach-gated; ignored for non-coaches. */
  initialReviewSessionId?: string | null;
  /** D3 — when set (from /chat?insight=<id>), open the InsightsOverlay for that
   *  session once on mount (user results email deep-link). */
  initialInsightSessionId?: string | null;
}) {
  const thread = useLoungeThreadCtx();
  const { messages, reload } = thread;
  const [draftText, setDraftText] = useState("");
  const [botThinking, setBotThinking] = useState(false);
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // C-1 — the unified audit / history view (recordings + all moments).
  const [auditOpen, setAuditOpen] = useState(false);
  // E3 — coach-only student roster overlay.
  const [rosterOpen, setRosterOpen] = useState(false);
  // B-1 — the single intent-driven quick-action button for the latest turn,
  // from the BE's suggested_action (S1). null → no button. Transient: cleared
  // on the next send / on tap. Not persisted (freeze-safe).
  const [pendingAction, setPendingAction] = useState<ChipAction | null>(null);
  // The "Strong sides" ask surfaces a button anchored IN the thread (not the
  // sticky foot action button). Holds the timestamp it was offered at, so it
  // sorts chronologically right after the bot's reply and stays put. Persists
  // (a new ask just re-anchors it); cleared only when the thread resets.
  const [strongSidesAt, setStrongSidesAt] = useState<string | null>(null);
  // U1 (native scroll): scroll the thread CONTAINER, and stick to the bottom
  // only when the user is already there. The old code called scrollIntoView on
  // a bottom sentinel on every new message + every bot-typing toggle, which
  // (a) could pan the whole page / iOS viewport, and (b) yanked the user back
  // down whenever they'd scrolled up to read history — the non-native feel.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  // U3 — baseline of message ids present on first load (historical). A bot
  // message NOT in this set, rendered as the last thread item, is a freshly-
  // arrived reply → it reveals sequentially (animate). Set once, post first load.
  const baselineRef = useRef<Set<string> | null>(null);

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
    // A-4 / B-2 — anchor the post-send offer right after the latest completed-
    // training card (its timestamp + "~" sorts just after that card but before
    // any later message), so chatting on doesn't push it to the foot.
    if (state === "review_pending") {
      const lastSummaryAt = messages
        .filter((m) => m.kind === "recording_summary")
        .map((m) => m.client_created_at)
        .sort()
        .pop();
      items.push({
        kind: "postsend",
        sortKey: `${lastSummaryAt ?? ""}~`,
        reactKey: "postsend",
      });
    }
    // The Strong sides button sits where it was offered (anchored after the
    // bot's reply), so it scrolls with the thread like any other bubble.
    if (strongSidesAt) {
      items.push({
        kind: "strongsides",
        sortKey: strongSidesAt,
        reactKey: "strongsides",
      });
    }
    items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return items;
  }, [messages, isCoach, reviewQueue.rows, state, strongSidesAt]);

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

  // U6 — opening the in-thread insight card is the single "mark read" path now
  // that the top banner is gone: open the overlay, and if we were in the unread
  // insights_ready state, clear the flag + return the status machine to idle
  // (exactly what the banner's "Read ›" button used to do).
  function handleViewInsights(sessionId: string): void {
    setActiveInsight(sessionId);
    if (state === "insights_ready") {
      clearInsightsReady();
      goTo("lounge_idle");
    }
  }

  // Closing the insights overlay just returns to the thread. Wave-3 B-1 removed
  // the post-feedback chip offer here; the proactive strong-sides offer now
  // fires at the post-send moment (A-4 / B-2), and intent-driven buttons come
  // from the BE's suggested_action (B-1).
  function handleInsightsClose(): void {
    setActiveInsight(null);
  }

  // Quick-action → surface. record_again starts a fresh recording; strong_sides
  // opens the strong-sides gallery; recordings opens the unified audit view (C-1,
  // recordings + all moments — supersedes the old recordings-only overlay).
  function onChip(action: ChipAction): void {
    if (action === "strong_sides") setLibraryOpen(true);
    else if (action === "recordings") setAuditOpen(true);
    else if (action === "record_again") onStart();
  }

  // U12 — coach email deep-link (/chat?review=<id>): open the review overlay for
  // that session once on mount. Coach-gated (isCoach is the render gate; the BE
  // role-gates the endpoint regardless). Fire-once so closing it doesn't
  // immediately reopen; isCoach can resolve async, so the effect re-runs when it
  // flips true.
  const deepLinkOpenedRef = useRef(false);
  useEffect(() => {
    if (deepLinkOpenedRef.current || !isCoach || !initialReviewSessionId) return;
    deepLinkOpenedRef.current = true;
    setReviewSessionId(initialReviewSessionId);
  }, [isCoach, initialReviewSessionId]);

  // D3 — user results email deep-link (/chat?insight=<id>): open the insights
  // overlay for that session once on mount. Not coach-gated (InsightsOverlay
  // fetches the owner-auth readout); fire-once so closing it doesn't reopen.
  const insightLinkOpenedRef = useRef(false);
  useEffect(() => {
    if (insightLinkOpenedRef.current || !initialInsightSessionId) return;
    insightLinkOpenedRef.current = true;
    setActiveInsight(initialInsightSessionId);
  }, [initialInsightSessionId]);

  // Wave-3 — no standing / every-visit offer. The proactive strong-sides nudge
  // fires once at the post-send moment (A-4 / B-2); otherwise the bot stays
  // quietly standing by. Intent-driven buttons come from the BE (B-1).

  // Voice input has been removed from the Lounge (product call): only
  // the **official recording** holds the mic. Off-task chat is
  // text-only — keeps the Lounge composer visually distinct from the
  // Lab's "Start official recording" CTA so users never confuse the
  // calm off-stage surface with the high-stakes on-stage one. The
  // Web Speech machinery (`useSpeechInput`) stays in the tree for
  // now in case a future surface (e.g. an accessibility opt-in) wants
  // to bring it back, but the Lounge no longer calls it.

  useEffect(() => {
    // Stick to bottom only if the user hasn't scrolled up. Scroll the container
    // itself (not a sentinel) so the page/viewport never moves.
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, botThinking, pendingAction, strongSidesAt]);

  // U3 — capture the historical baseline once the thread first loads, so only
  // messages that arrive AFTER it (new bot replies) animate.
  useEffect(() => {
    if (baselineRef.current === null && messages.length > 0) {
      baselineRef.current = new Set(messages.map((m) => m.client_id));
    }
  }, [messages]);

  // Track whether the thread is parked at the bottom. Within 80px counts as
  // "at bottom" (sub-pixel rounding + a partially-visible last bubble).
  function handleThreadScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

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
    atBottomRef.current = true; // sending always scrolls to your own message
    setPendingAction(null); // B-1 — a new question supersedes any prior suggestion
    const history = loungeToHistory(messages); // snapshot of prior turns (pre-append)
    const botTurns = messages.filter((msg) => msg.role === "bot");
    const prevBotText = botTurns.length ? botTurns[botTurns.length - 1].body : "";
    setDraftText("");
    await thread.append({ role: "user", kind: "text", body: q });

    // Strong-sides shortcut: when the user asks to see their strong sides, don't
    // recite the coach notes as text — answer briefly and surface the existing
    // Strong sides bubble (it opens the library). Skips the LLM round-trip.
    if (isStrongSidesAsk(q, prevBotText)) {
      await thread.append({
        role: "bot",
        kind: "text",
        body: "Sure! Tap the button below to see your strong sides.",
      });
      // Anchor the button in the thread (after this reply), not at the foot.
      setStrongSidesAt(new Date().toISOString());
      return;
    }

    setBotThinking(true);
    try {
      const resp = await postChatQuery({ question: q, history });
      const answer = (resp.answer ?? "").trim();
      await thread.append({
        role: "bot",
        kind: "text",
        body: answer || "I didn't quite catch that. Mind putting it another way?",
      });
      // B-1 — the one quick-action the BE suggests for this turn (S1). A
      // strong-sides suggestion goes to the in-thread button (same as the FE
      // shortcut, never the sticky foot button); other actions stay as the
      // transient foot button. undefined → null → no button.
      const suggested = coerceSuggestedAction(resp.suggested_action);
      if (suggested === "strong_sides") {
        setStrongSidesAt(new Date().toISOString());
      } else {
        setPendingAction(suggested);
      }
    } catch {
      await thread.append({
        role: "bot",
        kind: "text",
        body: "I'm having trouble reaching the lab right now. Give it another try in a moment.",
      });
    } finally {
      setBotThinking(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <StatusRegion state={state} goTo={goTo} />

      <div
        ref={scrollRef}
        onScroll={handleThreadScroll}
        className="flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain"
      >
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
          threadItems.map((item, i) =>
            item.kind === "message" ? (
              <Bubble
                key={item.reactKey}
                message={item.message}
                onViewInsights={handleViewInsights}
                animate={
                  i === threadItems.length - 1 &&
                  baselineRef.current !== null &&
                  !baselineRef.current.has(item.message.client_id)
                }
              />
            ) : item.kind === "review" ? (
              <CoachReviewBubble
                key={item.reactKey}
                row={item.row}
                onOpen={openReview}
              />
            ) : item.kind === "postsend" ? (
              <div key={item.reactKey} className="flex flex-col gap-2">
                <PostSendOffer
                  onReviewStrongSides={() => onChip("strong_sides")}
                />
                <ProgressToAuditBubble onOpenAudit={() => setAuditOpen(true)} />
              </div>
            ) : (
              <ActionButton
                key={item.reactKey}
                action="strong_sides"
                onClick={() => onChip("strong_sides")}
              />
            )
          )
        )}

        {/* B-1 — the single intent-driven action button, from the BE's
            suggested_action for the latest turn (S1). One button, never a row;
            renders under the reply; clears on tap / next send. */}
        {pendingAction && !botThinking && (
          <ActionButton
            action={pendingAction}
            onClick={() => {
              const action = pendingAction;
              setPendingAction(null);
              onChip(action);
            }}
          />
        )}

        {botThinking && <TypingDots />}
      </div>

      {/* E3 — coach-only entry to the student roster (pseudonymized). Coaches
          can still record, so this sits above the record CTA, not instead of it. */}
      {isCoach && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setRosterOpen(true)}
          className="h-12 w-full gap-2 rounded-full"
        >
          <Users className="h-4 w-4" />
          Your students
        </Button>
      )}

      {/* U2 — record CTA: dark fill + a red record dot, full-width. Deliberately
          distinct from the orange primary (Send) and the calm text composer so
          the high-stakes "on-stage" action never reads as just another button.
          No flanking buttons — the strong-sides / recordings shortcuts moved to
          quick-reply chips below (U7). */}
      <Button
        type="button"
        onClick={onStart}
        className="h-12 w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
        Start official recording
      </Button>

      {/* Wave-3 — no standing chip row above the composer; quick actions are
          single in-thread buttons (A-4 / B-1). Footer is just the CTA + input. */}
      {/* A5 — the send button lives INSIDE the input (right edge): grey when the
          field is empty, black once there's text. A4 — the input height (h-12)
          matches the record CTA. B3 — "Will" persona in the placeholder + aria. */}
      <form onSubmit={handleSend} className="relative">
        <input
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Ask Will about how communication works…"
          /* B9 — kill any autofill / password-manager overlay that can ghost a
             second line of placeholder text over a chat composer. */
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck
          className="h-12 w-full rounded-full border border-border bg-background pl-4 pr-12 text-[15px] outline-none focus:border-primary"
          aria-label="Message Will"
        />
        <button
          type="submit"
          disabled={!draftText.trim() || botThinking}
          aria-label="Send"
          className={`absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full transition-colors disabled:cursor-default ${
            draftText.trim() ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <Send className="h-5 w-5" />
        </button>
      </form>

      {/* C-1 — the unified audit view. Rendered BEFORE the insights overlay so
          opening a session from here paints the read ON TOP; closing the read
          returns to the audit (it stays mounted underneath). */}
      {auditOpen && (
        <AuditOverlay
          onClose={() => setAuditOpen(false)}
          onOpenSession={(sid) => setActiveInsight(sid)}
        />
      )}
      {activeInsight && (
        <InsightsOverlay sessionId={activeInsight} onClose={handleInsightsClose} />
      )}
      {libraryOpen && <LibraryOverlay onClose={() => setLibraryOpen(false)} />}
      {rosterOpen && (
        <StudentRosterOverlay
          onClose={() => setRosterOpen(false)}
          onOpenReview={openReview}
        />
      )}
      {reviewSessionId && (
        <CoachReviewOverlay
          sessionId={reviewSessionId}
          onClose={closeReview}
          onPublished={reviewQueue.markDone}
        />
      )}

      {/* U10 pt2 — PWA install at the post-send moment (the final beat of the
          first-run flow). Self-gates to installable mobile, post-send only;
          captures beforeinstallprompt as early as this always-mounted Lounge. */}
      <WillabInstallPrompt show={state === "review_pending"} />
    </div>
  );
}

/** A-4 / B-2 — the post-send beat. Once the training is handed to the coach
 *  (review_pending), a warm "that's it for today" line + one proactive button
 *  to revisit past strong sides (B-2). Ordinary styling (not full-width).
 *  Transient: rendered from review_pending state, not persisted, so it clears
 *  when the state moves on. The formal "sent to your coach" record is the
 *  persisted completed-training card (A-3) above it. */
function PostSendOffer({
  onReviewStrongSides,
}: {
  onReviewStrongSides: () => void;
}) {
  return (
    <div className="mr-auto flex max-w-[85%] flex-col gap-2">
      <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-[15px] leading-relaxed text-foreground">
        That&apos;s it for the practice today. Maybe you want to review your
        previous strong sides and settle the neural pathways for your charismatic
        performance?
      </div>
      <button
        type="button"
        onClick={onReviewStrongSides}
        className="self-start rounded-full border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary/50"
      >
        {CHIP_LABEL.strong_sides}
      </button>
    </div>
  );
}

/** B-1 — a single intent-driven quick-action button (from the BE's
 *  suggested_action, S1), rendered under the bot's reply. One button, never a
 *  row; pure presentation, the Lounge resolves the action (onChip). */
function ActionButton({
  action,
  onClick,
}: {
  action: ChipAction;
  onClick: () => void;
}) {
  return (
    <div className="mr-auto flex max-w-[85%]">
      <button
        type="button"
        onClick={onClick}
        className="self-start rounded-full border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary/50"
      >
        {CHIP_LABEL[action]}
      </button>
    </div>
  );
}

/** U4 — animated "librarian is typing" indicator. Three dots bouncing out of
 *  phase (staggered negative animation-delays) in a bot-side bubble. Replaces
 *  the static "…" so the wait reads as a live, responsive chat — and pairs with
 *  the U3 bubble-split (typing → a few short bubbles land). */
function TypingDots() {
  return (
    <div
      role="status"
      aria-label="Librarian is typing"
      className="mr-auto flex items-center gap-1 rounded-2xl bg-muted px-3.5 py-3"
    >
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
    </div>
  );
}

/** U3 — gap between sequentially-revealed bubbles (ms of "typing"). */
const CHUNK_DELAY_MS = 750;

/** U3 — render a bot message's split chunks. A freshly-arrived reply
 *  (`animate`) reveals them one at a time with a typing indicator between, so
 *  it reads like a person sending a few short messages. Historical messages,
 *  single-chunk messages, and reduced-motion users render everything at once. */
function SequentialBotBubbles({
  chunks,
  animate,
}: {
  chunks: string[];
  animate: boolean;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  const shouldAnimate = animate && !reduceMotion && chunks.length > 1;
  const [revealed, setRevealed] = useState(shouldAnimate ? 1 : chunks.length);

  useEffect(() => {
    if (!shouldAnimate) {
      setRevealed(chunks.length); // instant: historical / single / reduced-motion
      return;
    }
    if (revealed >= chunks.length) return;
    const id = setTimeout(() => setRevealed((n) => n + 1), CHUNK_DELAY_MS);
    return () => clearTimeout(id);
  }, [shouldAnimate, revealed, chunks.length]);

  const stillTyping = shouldAnimate && revealed < chunks.length;

  return (
    <div className="mr-auto flex max-w-[85%] flex-col gap-1.5">
      {chunks.slice(0, revealed).map((part, i) => (
        <div
          key={`${i}-${part.slice(0, 12)}`}
          className="whitespace-pre-wrap rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground"
        >
          {part}
        </div>
      ))}
      {stillTyping ? <TypingDots /> : null}
    </div>
  );
}

function Bubble({
  message,
  onViewInsights,
  animate = false,
}: {
  message: LoungeMessage;
  onViewInsights?: (sessionId: string) => void;
  /** U3 — true only for a freshly-arrived last message → sequential reveal. */
  animate?: boolean;
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
    // U3 (bubble-split): a multi-paragraph answer renders as several stacked
    // bubbles — the librarian "sends" a few short messages, not one wall of
    // text. A freshly-arrived reply reveals them SEQUENTIALLY with a typing
    // indicator between (animate); historical messages render at once.
    return (
      <SequentialBotBubbles
        chunks={splitBotMessage(message.body)}
        animate={animate}
      />
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
  // B3 — "Will" greeting (de-dashed; §3.12 librarian behaviour unchanged).
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <p className="max-w-sm text-[15px] leading-relaxed text-foreground">
        Hi, I am Will and I will (hehe) assist you in your training. I suggest
        you jump into the{" "}
        <span className="font-medium">official recording</span>, but I can answer
        any other of your communication-related questions.
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
}: {
  state: WillabState;
  goTo: (s: WillabState) => void;
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
  // U5 — the review_pending confirmation moved OUT of the status region into an
  // in-thread bubble (<SentConfirmationBubble>) at the bottom of the thread, so
  // the "sent" acknowledgement reads as part of the conversation rather than a
  // top banner. StatusRegion renders nothing for review_pending now.
  // U6 — the "insights ready" top banner is REMOVED. The coach's insight is
  // delivered as an in-thread card (BE-appends it on publish, idempotent), which
  // is now the sole surface + "mark read" path (handleViewInsights). The
  // insights_ready state still drives the one-shot thread reload; StatusRegion
  // renders no card for it.
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

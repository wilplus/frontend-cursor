"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postChatQuery } from "@/services/api/chatQuery";
import { homeworkApi } from "@/lib/api/homework-client";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { ReviewQueueRow } from "@/services/api/reviewQueue";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import {
  isStrongSidesAsk,
  isUploadAsk,
  loungeToHistory,
  splitBotMessage,
} from "./willabHelpers";
import { stageLabUpload } from "./labUploadStage";
import ReportCard from "./ReportCard";
import LoadingState from "./LoadingState";
import InsightsOverlay from "./InsightsOverlay";
import LibraryOverlay from "./LibraryOverlay";
import BestPresentationOverlay from "./BestPresentationOverlay";
import BreakthroughsOverlay from "./BreakthroughsOverlay";
import StudentRosterOverlay from "./StudentRosterOverlay";
import CoachReviewOverlay from "./CoachReviewOverlay";
import ProgressToAuditBubble from "./ProgressToAuditBubble";
import { readExploreArc, writeExploreArc } from "@/lib/willab/exploreArc";
import {
  readStrongSidesAnchor,
  writeStrongSidesAnchor,
} from "@/lib/willab/strongSidesAnchor";
import { clearInsightsReady } from "./sendStatus";
import { type WillabState } from "./useWillabFlow";
import { useUserProfile } from "./useUserProfile";
import { useReviewQueue } from "./useReviewQueue";
import CoachReviewBubble from "./CoachReviewBubble";
import {
  useInstallOffer,
  InstallOfferActions,
  type InstallOffer,
} from "./WillabInstallPrompt";
import SymmetricPair from "./SymmetricPair";
import OfferBubble from "./OfferBubble";
import {
  offerDraft,
  readOfferType,
  hasOffer,
  readCreditOfferLive,
  writeCreditOfferLive,
  type OfferType,
} from "./loungeOffers";
import {
  CHIP_LABEL,
  coerceSuggestedAction,
  type ChipAction,
} from "./loungePrompts";
import type { RecordingProgress } from "@/services/api/recordingProgress";

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
      // A-4 / B-2 — the post-send strong-sides offer, anchored in the thread
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
    }
  | {
      // The audit-progress line. Once you've sent a training it stays in the
      // thread (any state), anchored after the completed-training card — like
      // any other bubble, never disappearing.
      kind: "auditprogress";
      sortKey: string;
      reactKey: string;
    }
  ;

export default function Lounge({
  state,
  onStart,
  goTo,
  initialReviewSessionId = null,
  initialInsightSessionId = null,
  initialBestPresentationArcId = null,
  recordingProgress = null,
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
  /** C — when set (from /chat?arc=<arc_id>), open the BestPresentationOverlay
   *  for that arc once on mount. */
  initialBestPresentationArcId?: string | null;
  /** Seed from the upload response; reserved for future per-take state. */
  recordingProgress?: RecordingProgress | null;
}) {
  const router = useRouter();
  const thread = useLoungeThreadCtx();
  const { messages, reload } = thread;
  const [draftText, setDraftText] = useState("");
  const [botThinking, setBotThinking] = useState(false);
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // F2 — best-presentation overlay. arcId drives which arc to show.
  const [bestPresentationArcId, setBestPresentationArcId] = useState<string | null>(null);
  // #5 — arc's coach-confirmed breakthrough moments overlay (sibling of best-pres).
  const [breakthroughsArcId, setBreakthroughsArcId] = useState<string | null>(null);
  // F1 — credit gate. `canStartAnalysis` is server-owned (don't hardcode >=5);
  // null until /status loads. Drives the "credit" thread offer.
  const [canStartAnalysis, setCanStartAnalysis] = useState<boolean | null>(null);
  // F1/F2/F7 — the offer (install / joke / credit) whose action pair is open in
  // the footer (replacing the record button). null → the record button shows.
  // The offers themselves persist as thread bubbles (loungeOffers); this only
  // tracks which one is currently "armed".
  const [activeOffer, setActiveOffer] = useState<OfferType | null>(null);
  // E3 — coach-only student roster overlay.
  const [rosterOpen, setRosterOpen] = useState(false);
  // The "Strong sides" ask surfaces a button anchored IN the thread (not the
  // sticky foot action button). Holds the timestamp it was offered at, so it
  // sorts chronologically right after the bot's reply and stays put. Persists
  // (a new ask just re-anchors it); cleared only when the thread resets.
  // Handoff F: persisted to localStorage so the button survives a reload (the
  // trainings chip already does, via the message's metadata). Hydrated on
  // mount via useEffect to avoid an SSR/CSR mismatch.
  const [strongSidesAt, setStrongSidesAt] = useState<string | null>(null);
  // markStrongSides — set + persist the anchor together (used by both the
  // local strong-sides shortcut and the BE's suggested_action path).
  const markStrongSides = (): void => {
    const ts = new Date().toISOString();
    setStrongSidesAt(ts);
    writeStrongSidesAnchor(ts);
  };
  useEffect(() => {
    const ts = readStrongSidesAnchor();
    if (ts) setStrongSidesAt(ts);
  }, []);
  // #9 fallback — the localStorage anchor is per-device, but a signed-in bot
  // turn carrying suggested_action=strong_sides is server-persisted. On another
  // device / cleared storage the anchor is empty, and since the in-bubble
  // ActionButton is suppressed for strong_sides (the anchor is the single
  // render), the affordance would vanish entirely. Derive the anchor from the
  // newest such message instead (not written back — the thread stays the
  // source of truth).
  useEffect(() => {
    if (strongSidesAt) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        m.role === "bot" &&
        coerceSuggestedAction(m.metadata?.suggested_action) === "strong_sides"
      ) {
        setStrongSidesAt(m.client_created_at);
        return;
      }
    }
  }, [messages, strongSidesAt]);
  // U1 (native scroll): scroll the thread CONTAINER, and stick to the bottom
  // only when the user is already there. The old code called scrollIntoView on
  // a bottom sentinel on every new message + every bot-typing toggle, which
  // (a) could pan the whole page / iOS viewport, and (b) yanked the user back
  // down whenever they'd scrolled up to read history — the non-native feel.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const didInitScrollRef = useRef(false);
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

  // The arc the best-presentation bubble points at — read from the DURABLE,
  // server-persisted recording_summary metadata (newest first), so the bubble
  // stays clickable across logout/login and any device. null → the bubble
  // falls back to the localStorage arc (pre-fix recordings, same device).
  const bubbleArcId = useMemo<string | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const arc = m.metadata?.arc_id;
      if (m.kind === "recording_summary" && typeof arc === "string" && arc.length > 0) {
        return arc;
      }
    }
    return null;
  }, [messages]);

  // Interleave the coach's review queue rows with regular Lounge messages so
  // a "new session ready to label" bubble appears chronologically alongside
  // the rest of the chat — that's the §3 design ("message in his chat from
  // that user"). Sort by created_at / sent_at ascending so oldest sits at
  // the top and newest at the bottom (matching how the existing thread
  // already reads).
  const threadItems = useMemo<ThreadItem[]>(() => {
    // #10 — dedupe by client_id: the BE thread is the source of truth and its
    // idempotent client_ids are the identity. A double-insert (retry, optimistic
    // + server echo) must never render twice (also keeps React keys unique).
    const seenIds = new Set<string>();
    const items: ThreadItem[] = [];
    for (const m of messages) {
      if (m.client_id) {
        if (seenIds.has(m.client_id)) continue;
        seenIds.add(m.client_id);
      }
      items.push({
        kind: "message",
        sortKey: m.client_created_at,
        reactKey: m.client_id,
        message: m,
      });
    }
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
    // Anchor both the post-send offer and the audit-progress line right after the
    // latest completed-training card (its timestamp + "~" sorts just after that
    // card but before any later message), so chatting on doesn't push them down.
    const lastSummaryAt = messages
      .filter((m) => m.kind === "recording_summary")
      .map((m) => m.client_created_at)
      .sort()
      .pop();
    if (state === "review_pending") {
      items.push({
        kind: "postsend",
        sortKey: `${lastSummaryAt ?? ""}~`,
        reactKey: "postsend",
      });
    }
    // The audit-progress line persists once you've sent a training — in ANY
    // state, never disappearing (it self-hides only when there's no progress
    // data). It's an ordinary thread bubble, anchored, not the transient offer.
    if (lastSummaryAt) {
      items.push({
        kind: "auditprogress",
        sortKey: `${lastSummaryAt}~~`,
        reactKey: "auditprogress",
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

  // C8 — every quick-action CTA lands in ONE place: the Trainings library
  // (strong_sides / trainings / audit). audit previously routed to /audits; it
  // now opens the Trainings library like the rest so the chips don't scatter.
  // No record chip: the bot points at the permanent record button in words.
  // The ONE exception: the BE pay note's arc_checkout taps into the audit
  // checkout (clean paywall — never an error).
  function onChip(action: ChipAction): void {
    if (action === "arc_checkout") router.push("/dashboard/pricing");
    else setLibraryOpen(true);
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

  // C — best-presentation deep-link (/chat?arc=<arc_id>): open the
  // BestPresentationOverlay for that arc once on mount; fire-once so closing it
  // doesn't reopen.
  const bestPresLinkOpenedRef = useRef(false);
  useEffect(() => {
    if (bestPresLinkOpenedRef.current || !initialBestPresentationArcId) return;
    bestPresLinkOpenedRef.current = true;
    setBestPresentationArcId(initialBestPresentationArcId);
  }, [initialBestPresentationArcId]);

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

  // Jump to bottom once the thread finishes loading — always open at the latest
  // message. Re-pin after the next frame + a short delay so async content
  // (slide images, report cards) that grows the thread doesn't leave us short
  // of the true bottom.
  useEffect(() => {
    if (didInitScrollRef.current || thread.loading || messages.length === 0) {
      return;
    }
    didInitScrollRef.current = true;
    const el = scrollRef.current;
    if (!el) return;
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    toBottom();
    requestAnimationFrame(toBottom);
    const t = setTimeout(toBottom, 150);
    return () => clearTimeout(t);
  }, [thread.loading, messages.length]);

  // F1 — load the credit gate (signed-in only). `can_start_analysis` is
  // server-owned; default to "can start" until it explicitly says false, so the
  // gate never appears spuriously. Refetch on focus so a top-up / a feedback
  // charge flips it without a reload.
  useEffect(() => {
    if (!thread.signedIn) return;
    let active = true;
    const load = () => {
      homeworkApi
        .getStatus()
        .then((s) => {
          if (active && s) setCanStartAnalysis(s.can_start_analysis !== false);
        })
        .catch(() => {
          // Status fetch failed (expired token / 5xx / offline) — leave the gate
          // in its default "can record" state; never block on a status error.
        });
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [thread.signedIn]);

  // F2 — install affordance primitives (platform + dismiss state). Drives both
  // whether to surface the install offer and the footer action pair.
  const install = useInstallOffer();

  // #7 — practice mode: while a 3-take practice arc is active and has at least
  // one take banked, the big record button reads "Record the next take" (the
  // small in-card button is gone; this is the ONE record affordance). Post-mount
  // effect (localStorage) so SSR/hydration stay clean; re-checked as the flow
  // state / thread move (a take completing flips both).
  const [practiceArcActive, setPracticeArcActive] = useState(false);
  useEffect(() => {
    const arc = readExploreArc();
    setPracticeArcActive(!!arc && arc.nextTakeIndex >= 2);
  }, [state, messages.length]);

  // When the user asks to upload a file, the footer's record button becomes a
  // file picker (deckless upload). Tracks the LATEST intent so it reverts once
  // the user moves on. Detection is FE-side (the bot doesn't classify it).
  const [uploadAskActive, setUploadAskActive] = useState(false);
  const uploadFileRef = useRef<HTMLInputElement | null>(null);

  // Auto-open an offer in the footer, respecting priority so that when several
  // fire at the same post-send moment the most urgent wins the slot (the others
  // remain clickable bubbles in the thread). An explicit bubble tap bypasses
  // this and opens that offer directly.
  const openOffer = useCallback((type: OfferType) => {
    const rank: Record<OfferType, number> = { credit: 3, joke: 2, install: 1 };
    setActiveOffer((prev) => (prev && rank[prev] >= rank[type] ? prev : type));
  }, []);

  // F7 — offer a (deliberately bad) joke ONLY after a genuine, in-session
  // recording: a recording_summary whose client_created_at is AFTER the thread
  // settled is the "just recorded" signal. Stamping a settle-time (rather than a
  // set of ids) means a reload, a status reconcile that lands on review_pending,
  // OR paging in older history ("Load earlier messages") can never re-arm the
  // joke — only a summary minted this session, after load, counts as fresh.
  const settleTimeRef = useRef<string | null>(null);
  const jokeHandledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (thread.loading) return;
    if (settleTimeRef.current === null) {
      settleTimeRef.current = new Date().toISOString();
      return;
    }
    for (const m of messages) {
      if (m.kind !== "recording_summary") continue;
      if (m.client_created_at <= settleTimeRef.current) continue; // historical / paged-in
      if (jokeHandledRef.current.has(m.client_id)) continue;
      jokeHandledRef.current.add(m.client_id);
      // C7 — read the feeling stamped on THIS take (per-recording), so a later
      // calm take is never gated on an earlier nervous one.
      const f =
        typeof m.metadata?.feeling === "string" ? m.metadata.feeling : null;
      if ((f === "nervous" || f === "unsure") && !hasOffer(messages, "joke")) {
        void thread.append(offerDraft("joke"));
        openOffer("joke");
        break; // one joke offer is plenty
      }
    }
  }, [messages, thread.loading, thread.append, openOffer]);

  // F2 — surface the install offer once, post-send, on an installable platform.
  // Gated on a FRESH in-session recording (a recording_summary minted after the
  // settle stamp) so a plain reload / status reconcile that lands on
  // review_pending never auto-opens it. hasOffer (+ the ref) dedups the append.
  const installHandledRef = useRef(false);
  useEffect(() => {
    if (thread.loading || settleTimeRef.current === null) return;
    if (state !== "review_pending" || !install.canOffer) return;
    if (installHandledRef.current || hasOffer(messages, "install")) return;
    const settle = settleTimeRef.current;
    const freshSend = messages.some(
      (m) => m.kind === "recording_summary" && m.client_created_at > settle
    );
    if (!freshSend) return;
    installHandledRef.current = true;
    void thread.append(offerDraft("install"));
    openOffer("install");
  }, [state, install.canOffer, thread.loading, messages, thread.append, openOffer]);

  // F1 — surface the credit offer when the server says the user can't start the
  // next analysis. A localStorage marker (cleared once they can record again)
  // dedups across reloads + history paging, where hasOffer only sees the loaded
  // window. We AUTO-OPEN only on a genuine in-session depletion (true → false);
  // a reload that simply loads an already-depleted status surfaces the saved
  // bubble without popping the action pair over the record button.
  const prevCanStartRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (thread.loading) return;
    const prev = prevCanStartRef.current;
    prevCanStartRef.current = canStartAnalysis;
    if (canStartAnalysis === false) {
      if (!readCreditOfferLive() && !hasOffer(messages, "credit")) {
        writeCreditOfferLive(true);
        void thread.append(offerDraft("credit"));
      }
      if (prev === true) openOffer("credit"); // in-session depletion only
    } else if (canStartAnalysis === true) {
      writeCreditOfferLive(false);
    }
  }, [canStartAnalysis, thread.loading, messages, thread.append, openOffer]);

  useEffect(() => {
    // Stick to bottom only if the user hasn't scrolled up. Scroll the container
    // itself (not a sentinel) so the page/viewport never moves.
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, botThinking, strongSidesAt]);

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
    // Guard BEFORE clearing the input so a send while the bot is busy keeps the
    // user's text rather than silently dropping it.
    if (!q || botThinking) return;
    setDraftText("");
    await runSend(q);
  }

  // F7 — the offer's "yes" asks the bot for a dad joke. The BE recognizes the
  // plain text and replies with a normal chat bubble (B2), which is itself the
  // response registered in the thread. Closing the offer is the caller's job.
  function askForJoke() {
    void runSend("Tell me a dad joke");
  }

  // The shared send core — used by the composer and the joke offer.
  async function runSend(q: string) {
    if (!q || botThinking) return;
    // Track upload intent so the footer record button swaps to a file picker
    // (and reverts the moment the user's next message is about something else).
    setUploadAskActive(isUploadAsk(q));
    atBottomRef.current = true; // sending always scrolls to your own message
    const history = loungeToHistory(messages); // snapshot of prior turns (pre-append)
    const botTurns = messages.filter((msg) => msg.role === "bot");
    const prevBotText = botTurns.length ? botTurns[botTurns.length - 1].body : "";
    // The user turn always persists (optimistic + FE write); for signed-in the
    // BE also writes it from the client_id we pass below, and the server dedups
    // on (user_id, client_id) so it collapses to one row (#2).
    const userMsg = await thread.append({ role: "user", kind: "text", body: q });

    // Strong-sides shortcut: when the user asks to see their strong sides, don't
    // recite the coach notes as text — answer briefly and surface the existing
    // Strong sides bubble (it opens the library). Skips the LLM round-trip.
    if (isStrongSidesAsk(q, prevBotText)) {
      // Button only — no text bubble. Anchored in the thread after the user's
      // ask, so it stays put like any other bubble (not the sticky foot button).
      markStrongSides();
      return;
    }

    setBotThinking(true);
    try {
      const resp = await postChatQuery({
        question: q,
        history,
        // #2 — let the BE own persistence for signed-in turns. It writes the
        // user turn with our client_id (dedup) and the bot turn with the chip
        // in its metadata; the FE then shows the bot turn optimistically only.
        persist: thread.signedIn,
        clientId: userMsg.client_id,
        clientCreatedAt: userMsg.client_created_at,
      });
      // B-1 — the one quick-action the BE suggests for this turn (S1). A
      // strong-sides suggestion shows ONLY the in-thread button — no text /
      // note recital. Every other turn renders the reply (+ any foot button).
      const suggested = coerceSuggestedAction(resp.suggested_action);
      if (suggested === "strong_sides") {
        markStrongSides();
      } else {
        const answer = (resp.answer ?? "").trim();
        // RULE F (seam 1) — the BE owns the bubble split; render `bubbles` 1:1.
        // We persist the joined body and the thread re-splits on the same
        // blank-line marker, so a reload shows exactly the bubbles that were sent.
        const body =
          resp.bubbles && resp.bubbles.length > 0
            ? resp.bubbles.join("\n\n")
            : answer || "I know nothing about that, at least yet 😏";
        const botDraft = {
          role: "bot" as const,
          kind: "text" as const,
          body,
          // B-1 — the chip rides in the bot row's metadata so it survives reload
          // and scroll-back. For signed-in, the BE persists this same row (chip
          // included) — see #2; we show it optimistically without re-persisting
          // to avoid a duplicate. Anonymous → the FE persists it locally.
          metadata: suggested ? { suggested_action: suggested } : null,
        };
        if (thread.signedIn) thread.appendLocalOnly(botDraft);
        else await thread.append(botDraft);
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
          <LoadingState />
        ) : threadItems.length === 0 ? (
          <LoungeEmptyState />
        ) : (
          threadItems.map((item, i) =>
            item.kind === "message" ? (
              <Bubble
                key={item.reactKey}
                message={item.message}
                onViewInsights={handleViewInsights}
                onOpenBestPresentation={(arcId) => setBestPresentationArcId(arcId)}
                onOpenBreakthroughs={(arcId) => setBreakthroughsArcId(arcId)}
                onOpenTranscripts={() => setLibraryOpen(true)}
                onChip={onChip}
                activeOffer={activeOffer}
                onOpenOffer={setActiveOffer}
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
              <PostSendOffer
                key={item.reactKey}
                onReviewStrongSides={() => onChip("strong_sides")}
              />
            ) : item.kind === "auditprogress" ? (
              <ProgressToAuditBubble key={item.reactKey} arcId={bubbleArcId} />
            ) : (
              <ActionButton
                key={item.reactKey}
                action="strong_sides"
                onClick={() => onChip("strong_sides")}
              />
            )
          )
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

      {/* The record-button slot. While an offer is "armed" (freshly triggered,
          or re-opened by tapping its thread bubble) its action pair REPLACES the
          black record button; resolving it returns the record button (U2). The
          offer's prompt + outcome live in the thread as durable bubbles. */}
      {activeOffer ? (
        <OfferActions
          type={activeOffer}
          install={install}
          onJokeYes={askForJoke}
          onGetCredits={() => router.push("/dashboard/pricing")}
          onResolve={() => setActiveOffer(null)}
        />
      ) : uploadAskActive ? (
        // The user asked to upload — the record button becomes a file picker.
        // Picking a file stashes it and opens the Lab, which collects the topic
        // (analysis needs it) then submits the upload (deckless).
        <>
          <input
            ref={uploadFileRef}
            type="file"
            accept="audio/*,video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              stageLabUpload(f);
              setUploadAskActive(false);
              onStart();
            }}
            className="hidden"
          />
          <Button
            type="button"
            onClick={() => uploadFileRef.current?.click()}
            className="h-12 w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Upload a recording
          </Button>
        </>
      ) : (
        <Button
          type="button"
          onClick={onStart}
          className="h-12 w-full gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
          {practiceArcActive ? "Record the next take" : "Start official recording"}
        </Button>
      )}

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

      {/* F2 — best-presentation overlay (the arc deliverable). Rendered BEFORE
          the insights overlay so opening a session from here paints the read ON
          TOP; closing the read returns to this (it stays mounted underneath). */}
      {bestPresentationArcId && (
        <BestPresentationOverlay
          arcId={bestPresentationArcId}
          onClose={() => setBestPresentationArcId(null)}
          onRecordNext={() => {
            setBestPresentationArcId(null);
            onStart();
          }}
        />
      )}
      {breakthroughsArcId && (
        <BreakthroughsOverlay
          arcId={breakthroughsArcId}
          onClose={() => setBreakthroughsArcId(null)}
        />
      )}
      {activeInsight && (
        <InsightsOverlay sessionId={activeInsight} onClose={handleInsightsClose} />
      )}
      {libraryOpen && (
        <LibraryOverlay
          onClose={() => setLibraryOpen(false)}
          onOpenBestPresentation={(arcId) => setBestPresentationArcId(arcId)}
          onRecordAnother={(arc) => {
            // Continue this deck's arc: seed the explore-arc (id + next index +
            // deck) so the Lab carries arc_id and pre-fills the deck, then open
            // the Lab. The BE appends the take to the same arc.
            writeExploreArc(arc.arcId, arc.nextTakeIndex, arc.deck);
            setLibraryOpen(false);
            onStart();
          }}
        />
      )}
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
        className="self-start rounded-full border border-border px-3 py-2 text-[15px] text-foreground transition-colors hover:border-primary/50"
      >
        {CHIP_LABEL.strong_sides}
      </button>
    </div>
  );
}

/** B-1 — a single intent-driven quick-action button (from the BE's
 *  suggested_action, S1). Lives inside the bot bubble it came with, persists
 *  in thread history, and is always clickable (action is idempotent). */
function ActionButton({ action, onClick }: { action: ChipAction; onClick: () => void }) {
  return (
    <div className="mr-auto flex max-w-[85%]">
      <button
        type="button"
        onClick={onClick}
        className="self-start rounded-full border border-border px-3 py-2 text-[15px] text-foreground transition-colors hover:border-primary/50"
      >
        {CHIP_LABEL[action]}
      </button>
    </div>
  );
}

/** The footer action pair for the currently-armed offer — it replaces the
 *  record button. The matching prompt bubble already lives in the thread; here
 *  we only render the grey/orange pair (install delegates to its platform-aware
 *  actions) and call onResolve to return the record button once the user picks. */
function OfferActions({
  type,
  install,
  onJokeYes,
  onGetCredits,
  onResolve,
}: {
  type: OfferType;
  install: InstallOffer;
  onJokeYes: () => void;
  onGetCredits: () => void;
  onResolve: () => void;
}) {
  if (type === "install") {
    return <InstallOfferActions offer={install} onResolve={onResolve} />;
  }
  if (type === "joke") {
    return (
      <SymmetricPair
        closeLabel="No thanks"
        onClose={onResolve}
        actionLabel="Go on then"
        onAction={() => {
          onJokeYes();
          onResolve();
        }}
      />
    );
  }
  // credit
  return (
    <SymmetricPair
      closeLabel="Close"
      onClose={onResolve}
      actionLabel="Unlock the full audit"
      onAction={() => {
        onGetCredits();
        onResolve();
      }}
    />
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
  onOpenBestPresentation,
  onOpenBreakthroughs,
  onOpenTranscripts,
  onChip,
  activeOffer,
  onOpenOffer,
  animate = false,
}: {
  message: LoungeMessage;
  onViewInsights?: (sessionId: string) => void;
  /** C — open BestPresentationOverlay from the best_presentation_ready card. */
  onOpenBestPresentation?: (arcId: string) => void;
  /** C2 — open BreakthroughsOverlay from the ideal-text hero card. */
  onOpenBreakthroughs?: (arcId: string) => void;
  /** transcript_ready card — opens the Trainings library. */
  onOpenTranscripts?: () => void;
  onChip?: (action: ChipAction) => void;
  /** F1/F2/F7 — which offer's action pair is currently armed (for the ring). */
  activeOffer?: OfferType | null;
  /** Tap a persisted offer bubble to re-arm its action pair in the footer. */
  onOpenOffer?: (type: OfferType) => void;
  /** U3 — true only for a freshly-arrived last message → sequential reveal. */
  animate?: boolean;
}) {
  const offerType = readOfferType(message.metadata);
  if (offerType) {
    return (
      <OfferBubble
        type={offerType}
        body={message.body}
        active={activeOffer === offerType}
        onOpen={() => onOpenOffer?.(offerType)}
      />
    );
  }
  if (
    message.kind === "recording_summary" ||
    message.kind === "insight" ||
    message.kind === "best_presentation_ready" ||
    message.kind === "transcript_ready"
  ) {
    return (
      <ReportCard
        message={message}
        onViewInsights={onViewInsights}
        onOpenBestPresentation={onOpenBestPresentation}
        onOpenBreakthroughs={onOpenBreakthroughs}
        onOpenTranscripts={onOpenTranscripts}
      />
    );
  }
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-[15px] text-primary-foreground">
        {message.body}
      </div>
    );
  }
  if (message.role === "bot") {
    // B-1 — read the persisted action from metadata; render below the bubbles.
    // #9 — strong_sides is EXCLUDED here: its single render is the anchored
    // in-thread button (the "strongsides" ThreadItem, set via markStrongSides),
    // so a suggested_action=strong_sides reply never draws a duplicate.
    const suggested =
      onChip && message.metadata
        ? coerceSuggestedAction(message.metadata.suggested_action)
        : null;
    const action = suggested === "strong_sides" ? null : suggested;
    return (
      <>
        {/* U3 (bubble-split): multi-paragraph answers reveal sequentially. */}
        <SequentialBotBubbles
          chunks={splitBotMessage(message.body)}
          animate={animate}
        />
        {action && (
          <ActionButton action={action} onClick={() => onChip!(action)} />
        )}
      </>
    );
  }
  // system / status → centered meta line
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

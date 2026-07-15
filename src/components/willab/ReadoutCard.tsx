"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Check, Copy, Info, Mic, Pause, Play, Sparkles, Square } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import { SlideRender } from "./pdfSlides";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { submitLabRecording } from "@/services/api/labRecording";
import { type PresentationSlide } from "./presentation";
import {
  groupSnippetsBySlide,
  pickTopSnippet,
  type FullTranscriptChunk,
  type InstantChunk,
  type ReadoutPayload,
  type SayItStronger,
  type SayItStrongerUpgrade,
  type ReadoutSlide,
  type ReadoutSlideGroup,
  type ReadoutSnippet,
} from "./readout";
import { saveTranscriptEdit } from "@/services/api/transcriptEdits";
import {
  sendSuggestionFeedback,
  type SuggestionFeedbackAction,
  type SuggestionFeedbackTarget,
} from "@/services/api/suggestionFeedback";

/* -------------------------------------------------------------------------- */
/*  ReadoutCard — ONE vertical scroll (P4, founder 2026-07-11): every slide     */
/*  section stacked top-to-bottom (slide image → small orange playback →        */
/*  transcript → grey divider → always-visible comment), a shaded top navbar    */
/*  whose "2/12" counter follows the scroll (IntersectionObserver), and a       */
/*  single terminal button at the end of the scroll. No Back/Next pagination.   */
/*                                                                            */
/*  The transcript is NOT editable here (editing lives on the Ideal Text        */
/*  view); user_edited_text still wins for display when present. Comments are   */
/*  always visible (P6) — no expand/collapse. A coach-assigned breakthrough     */
/*  adds a "Key moment" button deep-linking /game?snippet=<id> (P7).           */
/* -------------------------------------------------------------------------- */

/** One scroll section: a deck slide (with its complete transcript), the single
 *  deckless mock-slide page (chunks), or a legacy per-snippet block. */
type ReadoutSection = ReadoutSlideGroup & {
  fullTranscript: string | null;
  fullAudioRef: string | null;
  fullStartOffsetMs: number;
  fullDurationMs: number;
  /** Deckless-only: the whole transcript split into ordered chunks. */
  chunks: FullTranscriptChunk[] | null;
  /** R4-9 — the deduped chunk→suggestion list (BE instant_chunks). When
   *  present it is the instant view's SOLE source: chunk text → corrections →
   *  commentary, one entry per chunk, nothing rendered twice. */
  instantChunks: InstantChunk[] | null;
};

/** Stable key for a moment (BE id when present; else slide+offset). */
function momentKey(s: ReadoutSnippet): string {
  return s.id || `${s.slide?.index ?? "g"}:${s.startOffsetMs}`;
}

/** Does this snippet contribute comment content (coach note or a Say It
 *  Stronger suggestion)? Acoustic numbers left the user view entirely. */
function hasCommentContent(s: ReadoutSnippet): boolean {
  return !!(
    s.coach?.note ||
    s.coach?.when ||
    (s.coach?.examples && s.coach.examples.length > 0) ||
    s.sayItStronger
  );
}

/** Display text: the user's saved edit wins over the raw transcript. */
const snippetText = (s: ReadoutSnippet) => s.userEditedText ?? s.transcript;
const chunkText = (c: FullTranscriptChunk) => c.userEditedText ?? c.transcript;

/** The training-setup audience (B4) — suffixed onto Say-It-Stronger insight
 *  lines as "(audience: X)". Render-only; null hides the suffix. */
const ReadoutAudienceContext = createContext<string | null>(null);

/** #191 — ONE re-read mic at a time across all pieces (mirrors the single
 *  SectionAudioContext player). `claim` makes a piece the active recorder; every
 *  other recording piece sees `activeKey` change and cancels, so two mics can't
 *  be hot at once. `release` clears the slot when that piece finishes. */
interface ReReadCoordinator {
  activeKey: string | null;
  claim: (key: string) => void;
  release: (key: string) => void;
}
const ReReadCoordinatorContext = createContext<ReReadCoordinator>({
  activeKey: null,
  claim: () => {},
  release: () => {},
});

/* ── shared section audio: ONE element, seek + stop per section span ── */

interface SectionAudioApi {
  playingKey: string | null;
  toggle: (key: string, src: string, startMs: number, durationMs: number) => void;
}

const SectionAudioContext = createContext<SectionAudioApi>({
  playingKey: null,
  toggle: () => {},
});

function useSectionAudioController(): SectionAudioApi {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endAtRef = useRef<number | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const playingKeyRef = useRef<string | null>(null);
  playingKeyRef.current = playingKey;

  const stop = useCallback(() => {
    audioRef.current?.pause();
    endAtRef.current = null;
    setPlayingKey(null);
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = useCallback(
    (key: string, src: string, startMs: number, durationMs: number) => {
      if (playingKeyRef.current === key) {
        stop();
        return;
      }
      let el = audioRef.current;
      if (!el) {
        el = new Audio();
        el.preload = "none";
        // Stop exactly at the section's end (timeupdate beats a setTimeout —
        // it follows pauses/buffering instead of wall-clock drift).
        el.addEventListener("timeupdate", () => {
          const endAt = endAtRef.current;
          if (endAt !== null && el!.currentTime >= endAt) stop();
        });
        el.addEventListener("ended", stop);
        el.addEventListener("error", stop);
        audioRef.current = el;
      }
      if (el.src !== src) el.src = src;
      el.currentTime = startMs / 1000;
      endAtRef.current = durationMs > 0 ? (startMs + durationMs) / 1000 : null;
      // Key-guard the rejection: a superseded play() (user already tapped the
      // next section) must not clear the NEW section's playing state.
      void el.play().catch(() => {
        if (playingKeyRef.current === key) setPlayingKey(null);
      });
      setPlayingKey(key);
    },
    [stop]
  );

  return useMemo(() => ({ playingKey, toggle }), [playingKey, toggle]);
}

/** P5 restyle — the small orange play control: no grey card, less prominent
 *  than the old black-button player. */
function SectionPlay({
  playKey,
  src,
  startMs,
  durationMs,
}: {
  playKey: string;
  src: string;
  startMs: number;
  durationMs: number;
}) {
  const { playingKey, toggle } = useContext(SectionAudioContext);
  const playing = playingKey === playKey;
  return (
    <button
      type="button"
      onClick={() => toggle(playKey, src, startMs, durationMs)}
      aria-label={playing ? "Pause this section" : "Play this section"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
    >
      {playing ? (
        <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
      ) : (
        <Play className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden />
      )}
    </button>
  );
}

/* ============================== the overlay =============================== */

export default function ReadoutCard({
  payload,
  sessionId = null,
  isSample = false,
  onSend,
  onClose,
  // Kept for call-site compatibility; the scroll view needs no history paging.
  managed: _managed = true,
  onRegisterBack,
  reReadContext = null,
}: {
  payload: ReadoutPayload;
  /** Present for parity with the transcript-edit era; editing moved to the
   *  Ideal Text view, so this is currently unused (display still prefers
   *  user_edited_text off the payload itself). */
  sessionId?: string | null;
  isSample?: boolean;
  onSend?: () => void;
  /** #191 — the spoken take's setup context, so a piece with approved edits can
   *  offer a re-read mic (records → uploads as recording_kind=read paired to
   *  this session). null (e.g. the published InsightsOverlay) → no re-read. */
  reReadContext?: ReReadContext | null;
  /** Required for shell mode (full-screen overlay). Both LabOverlay and
   *  InsightsOverlay provide this. Without it the card renders a plain div. */
  onClose?: () => void;
  managed?: boolean;
  /** Back-gesture hook: the scroll view has no internal layout stack, so the
   *  handler always defers (returns false) and the host closes. */
  onRegisterBack?: (handler: () => boolean) => void;
}) {
  // The deck slide (index/title/body) by index — top-level `slides` first, with
  // per-snippet `slide` as a fallback for the title/body text-card path.
  const slidesByIndex = useMemo(() => {
    const m = new Map<number, ReadoutSlide>();
    for (const s of payload.slides) m.set(s.index, s);
    for (const sn of payload.snippets) {
      if (sn.slide && !m.has(sn.slide.index)) m.set(sn.slide.index, sn.slide);
    }
    return m;
  }, [payload.slides, payload.snippets]);

  // The parent recording's audio — shared across sections, so a slide with no
  // salient snippet (e.g. the quiet first slide) can still play its own span.
  const parentAudioRef = useMemo(
    () =>
      payload.parentAudioRef ??
      payload.snippets.find((s) => s.audioRef)?.audioRef ??
      null,
    [payload.parentAudioRef, payload.snippets]
  );

  // Section model. Per-deck-slide when the BE sends complete slide transcripts
  // (every slide gets a section, quiet first slide included); ONE mock-slide
  // section for deckless chunked takes; legacy per-snippet sections otherwise.
  const sections = useMemo((): ReadoutSection[] => {
    // #190 — instant_chunks is the SOLE source of the instant view when present.
    // Group the pieces by slide_index (first-order division); never re-split or
    // length-cap client-side (BE-1: pieces are punctuated prose ~250 chars).
    // Deckless pieces (slideIndex null) collect into one
    // trailing group. Old recordings (no instant_chunks) fall through to the
    // legacy per-slide / per-snippet paths below, unchanged.
    if (payload.instantChunks.length > 0) {
      const byKey = new Map<number | null, InstantChunk[]>();
      for (const c of payload.instantChunks) {
        const arr = byKey.get(c.slideIndex);
        if (arr) arr.push(c);
        else byKey.set(c.slideIndex, [c]);
      }
      const keys = [...byKey.keys()].sort((a, b) => {
        if (a === null) return 1; // deckless / no-slide group trails
        if (b === null) return -1;
        return a - b;
      });
      return keys.map((key) => ({
        slideIndex: key,
        slide: key !== null ? slidesByIndex.get(key) ?? null : null,
        snippets: [],
        fullTranscript: null,
        fullAudioRef: parentAudioRef,
        fullStartOffsetMs: 0,
        fullDurationMs: 0,
        chunks: null,
        instantChunks: byKey.get(key)!,
      }));
    }
    if (payload.slideTranscripts.length > 0) {
      const txIndices = new Set(payload.slideTranscripts.map((t) => t.index));
      const list: ReadoutSection[] = payload.slideTranscripts.map((st) => ({
        slideIndex: st.index,
        slide: slidesByIndex.get(st.index) ?? null,
        snippets: payload.snippets.filter((s) => s.slide?.index === st.index),
        fullTranscript: st.transcript,
        fullAudioRef: parentAudioRef,
        fullStartOffsetMs: st.startOffsetMs,
        fullDurationMs: st.durationMs,
        chunks: null,
        instantChunks: null,
      }));
      // Catch-all so a moment whose slide has no transcript entry (or no slide
      // at all) is never silently dropped.
      const leftover = payload.snippets.filter(
        (s) => !(s.slide && txIndices.has(s.slide.index))
      );
      if (leftover.length > 0) {
        list.push({
          slideIndex: null,
          slide: null,
          snippets: leftover,
          fullTranscript: null,
          fullAudioRef: null,
          fullStartOffsetMs: 0,
          fullDurationMs: 0,
          chunks: null,
          instantChunks: null,
        });
      }
      return list;
    }
    if (payload.fullTranscriptChunks.length > 0) {
      // Legacy deckless fallback (pre-#190): the whole transcript split into
      // ordered chunks under one mock slide. Only reached when instant_chunks
      // is absent.
      return [
        {
          slideIndex: null,
          slide: null,
          snippets: payload.snippets,
          fullTranscript: null,
          fullAudioRef: parentAudioRef,
          fullStartOffsetMs: 0,
          fullDurationMs: 0,
          chunks: payload.fullTranscriptChunks,
          instantChunks: null,
        },
      ];
    }
    // Legacy payloads (no slide transcripts, no chunks): ONE section per deck
    // slide group — unique keys, one slide image per slide (not per snippet).
    return groupSnippetsBySlide(payload.snippets).map((g) => ({
      ...g,
      fullTranscript: null,
      fullAudioRef: null,
      fullStartOffsetMs: 0,
      fullDurationMs: 0,
      chunks: null,
      instantChunks: null,
    }));
  }, [
    payload.slideTranscripts,
    payload.snippets,
    payload.fullTranscriptChunks,
    payload.instantChunks,
    slidesByIndex,
    parentAudioRef,
  ]);

  // R4-9 — ONE loading state for the whole suggestions layer: suggestions
  // generate async, so hold a single "sharpening" block (not per-card shimmers)
  // until every pending snippet resolves, then reveal the full list at once.
  // A local time cap matches the polling budget (8 polls x 3s) so a take whose
  // suggestions never arrive degrades to the text-only view instead of an
  // eternal shimmer.
  // #190 — with pieces, "pending" means the suggestion layer hasn't landed at
  // all yet (only ~16 salient pieces ever carry a card, so we can't wait on
  // "every piece"): pending until the FIRST piece suggestion arrives, then
  // render the whole list at once (no progressive pop-in). Legacy payloads keep
  // the per-snippet check.
  const suggestionsPending =
    payload.instantChunks.length > 0
      ? !payload.instantChunks.some((c) => c.sayItStronger)
      : payload.snippets.some((s) => !s.sayItStronger && !s.coach?.note);
  const [suggestionWaitExpired, setSuggestionWaitExpired] = useState(false);
  // A NEW session in the same mounted card (e.g. the Lab's next take) gets a
  // fresh wait budget — without this, one expired wait would disable the
  // single-loading behavior for every later take.
  useEffect(() => {
    setSuggestionWaitExpired(false);
  }, [sessionId]);
  useEffect(() => {
    if (!suggestionsPending) return;
    const id = setTimeout(() => setSuggestionWaitExpired(true), 30_000);
    return () => clearTimeout(id);
  }, [suggestionsPending, sessionId]);
  const suggestionsLoading = suggestionsPending && !suggestionWaitExpired;

  // The scroll view has no internal Back stack — the host's close handles it.
  useEffect(() => {
    onRegisterBack?.(() => false);
  }, [onRegisterBack]);

  // "2/12" — which section is on screen. Sections register their nodes; the
  // observer marks the one crossing a band around the upper third of the
  // viewport (scrolling down increments as each new slide enters).
  const [current, setCurrent] = useState(0);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const sectionNodes = useRef<(HTMLElement | null)[]>([]);
  const registerSection = useCallback(
    (idx: number) => (el: HTMLElement | null) => {
      sectionNodes.current[idx] = el;
    },
    []
  );
  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const idx = sectionNodes.current.indexOf(e.target as HTMLElement);
          if (idx >= 0) setCurrent(idx);
        }
      },
      // A thin horizontal band ~1/3 down the viewport: the section crossing it
      // is "the one you're on". Deterministic, no tie-breaking needed.
      { root, rootMargin: "-30% 0px -65% 0px", threshold: 0 }
    );
    const nodes = sectionNodes.current.filter(
      (n): n is HTMLElement => n !== null
    );
    nodes.forEach((n) => io.observe(n));
    // A short trailing section can sit below the observer band even at full
    // scroll — snap the counter to the last section at the bottom.
    const onScroll = () => {
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        setCurrent(sections.length - 1);
      }
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      root.removeEventListener("scroll", onScroll);
    };
  }, [sections.length]);

  const audio = useSectionAudioController();
  const sectionCount = Math.max(sections.length, 1);
  const hasSummary = !!(payload.overallMessage || payload.videoRef);

  // #191 — one active re-read mic across every piece (see ReReadCoordinator).
  const [activeReRead, setActiveReRead] = useState<string | null>(null);
  const reReadCoord = useMemo<ReReadCoordinator>(
    () => ({
      activeKey: activeReRead,
      claim: (key) => setActiveReRead(key),
      release: (key) => setActiveReRead((k) => (k === key ? null : k)),
    }),
    [activeReRead]
  );

  const body = (
    <ReadoutAudienceContext.Provider value={payload.audience}>
      <ReReadCoordinatorContext.Provider value={reReadCoord}>
        <SectionAudioContext.Provider value={audio}>
        {sections.length === 0 ? (
          <p className="px-4 py-12 text-center text-[15px] text-muted-foreground">
            No analyzable snippets in this recording.
          </p>
        ) : (
          sections.map((sec, i) => (
            <Section
              key={sec.slideIndex ?? `general-${i}`}
              refCallback={registerSection(i)}
              section={sec}
              presentationRef={payload.presentationRef}
              isSample={isSample && i === 0}
              voiceMetricsAvailable={i === 0 ? payload.voiceMetricsAvailable : true}
              suggestionsLoading={suggestionsLoading}
              sessionId={sessionId}
              reReadContext={reReadContext}
            />
          ))
        )}

        {hasSummary ? <SummaryBlock payload={payload} /> : null}

        {/* End of scroll — ONE terminal button (P4). The pre-send Lab readout
            keeps its send CTA: the guest sign-in-and-send flow hangs off it
            (LIVE LOOP), and signed-in sends ride the same step. */}
        {onClose || onSend ? (
          <div className="px-4 pb-10 pt-2">
            <button
              type="button"
              onClick={() => (onSend ? onSend() : onClose?.())}
              className="h-12 w-full rounded-full bg-foreground text-[15px] font-medium text-background transition hover:bg-foreground/90"
            >
              {onSend ? "Send for analysis" : "Exit the training"}
            </button>
          </div>
        ) : null}
        </SectionAudioContext.Provider>
      </ReReadCoordinatorContext.Provider>
    </ReadoutAudienceContext.Provider>
  );

  // Plain-div mode (no host overlay): just the stacked sections.
  if (!onClose) {
    return <div className="flex flex-1 flex-col overflow-y-auto">{body}</div>;
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Shaded top navbar: slide counter + X (P4). */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-medium tabular-nums text-foreground">
          {Math.min(current + 1, sectionCount)}/{sectionCount}
        </span>
        <OverlayCloseButton onClick={onClose} />
      </div>

      <div ref={scrollRootRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl">{body}</div>
      </div>
    </div>
  );
}

/* ── one scroll section: slide → playback → transcript → divider → comment ── */

function Section({
  refCallback,
  section,
  presentationRef,
  isSample,
  voiceMetricsAvailable,
  suggestionsLoading,
  sessionId,
  reReadContext,
}: {
  refCallback: (el: HTMLElement | null) => void;
  section: ReadoutSection;
  presentationRef: string | null;
  isSample: boolean;
  voiceMetricsAvailable: boolean;
  /** R4-9 — the whole suggestions layer is still generating (one loading
   *  state, not per-card shimmers). */
  suggestionsLoading: boolean;
  /** #190 — the session id, to persist Approve / transcript edits. */
  sessionId: string | null;
  /** #191 — re-read context (null → no re-read mic). */
  reReadContext: ReReadContext | null;
}) {
  const perSlide = section.fullTranscript !== null;
  const deckless = section.chunks !== null || section.instantChunks !== null;
  const slidePageIndex =
    section.slide?.index ?? (perSlide ? section.slideIndex : null);

  return (
    <section ref={refCallback} className="flex flex-col">
      {/* Slide image — edge-to-edge; deckless gets the one mock slide. */}
      {slidePageIndex !== null ? (
        <div className="w-full bg-muted">
          <SlideRender
            presentationRef={presentationRef}
            pageIndex={slidePageIndex}
            title={section.slide?.title ?? ""}
            body={section.slide?.body ?? ""}
            className="w-full"
          />
        </div>
      ) : deckless ? (
        <PlaceholderSlide />
      ) : null}

      <div className="flex flex-col gap-3 px-4 py-4">
        {isSample ? (
          <p className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-[12px] text-primary">
            Sample data. Your real acoustic Training Profile wires in at seam
            ③.
          </p>
        ) : null}
        {!voiceMetricsAvailable ? <VoiceMetricsNotice /> : null}

        {section.instantChunks ? (
          <PieceList
            pieces={section.instantChunks}
            audioRef={section.fullAudioRef}
            sessionId={sessionId}
            suggestionsLoading={suggestionsLoading}
            reReadContext={reReadContext}
          />
        ) : deckless ? (
          <DecklessSection section={section} />
        ) : perSlide ? (
          <DeckSlideSection section={section} />
        ) : (
          section.snippets.map((s) => <MomentBlock key={momentKey(s)} snippet={s} />)
        )}
      </div>
    </section>
  );
}

/* ── decked per-slide section ── */

function DeckSlideSection({ section }: { section: ReadoutSection }) {
  // One comment per slide: the slide's single top moment (lowest rank →
  // highest quality → earliest) so several salient snippets don't stack
  // duplicated-looking comments.
  const top = pickTopSnippet(section.snippets.filter(hasCommentContent));
  const breakthroughSnippet = section.snippets.find((s) => s.breakthrough);
  const playable = !!section.fullAudioRef && section.fullDurationMs > 0;
  return (
    <>
      {section.fullTranscript ? (
        <TranscriptBlock
          text={section.fullTranscript}
          play={
            playable ? (
              <SectionPlay
                playKey={`slide:${section.slideIndex ?? "g"}`}
                src={section.fullAudioRef!}
                startMs={section.fullStartOffsetMs}
                durationMs={section.fullDurationMs}
              />
            ) : null
          }
        />
      ) : (
        <p className="text-[14px] italic text-muted-foreground">
          No speech recorded on this slide.
        </p>
      )}

      <CommentBlock
        snippet={top}
        transcriptCorrected={section.snippets
          .map((s) => s.coach?.transcriptCorrected)
          .filter((t): t is string => !!t)}
        breakthroughSnippet={breakthroughSnippet ?? null}
      />
    </>
  );
}

/* ── deckless section: mock slide already above; chunks + moments ── */

function DecklessSection({ section }: { section: ReadoutSection }) {
  // Legacy deckless fallback (pre-#190 payloads): the whole transcript split
  // into ordered chunks + moments. The #190 instant-piece view is PieceList.
  const chunks = section.chunks ?? [];
  const fullText = chunks.map(chunkText).join("\n\n");
  const moments = section.snippets.filter(
    (s) => hasCommentContent(s) || s.breakthrough
  );
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          Your transcript
        </p>
        {fullText ? <CopyButton text={fullText} /> : null}
      </div>

      {/* The 200-char chunks: playback + text, stacked (P5). */}
      <div className="flex flex-col gap-3">
        {chunks.map((c) => (
          <div key={c.index} className="flex items-start gap-3">
            {section.fullAudioRef && c.durationMs > 0 ? (
              <SectionPlay
                playKey={`chunk:${c.index}`}
                src={section.fullAudioRef}
                startMs={c.startOffsetMs}
                durationMs={c.durationMs}
              />
            ) : null}
            <p className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
              {chunkText(c)}
            </p>
          </div>
        ))}
      </div>

      {moments.length > 0 ? (
        <div className="mt-2 flex flex-col gap-5">
          {moments.map((s) => (
            <MomentBlock key={momentKey(s)} snippet={s} skipTranscript />
          ))}
        </div>
      ) : null}
    </>
  );
}

/* ── #190/#191 per-piece instant view ─────────────────────────────────────
 *  Each piece (punctuated prose, ~250 chars — no client length cap) renders:
 *  text (+ its exact-span play) → word/phrase suggestion rows, each with a
 *  single "Approve" that rewrites the piece text optimistically and persists
 *  best-effort (transcript edit + suggestion feedback). No comment row, no ✓,
 *  no Apply-all (#191). Once a piece has an approved edit, a re-read mic offers
 *  to re-record the corrected text. */

/** Escape a literal for use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Apply one upgrade to the text: replace the first (case-insensitive) match of
 *  `original` with `upgrade`. No match → unchanged (best-effort optimistic edit;
 *  the BE stores the canonical). The replacement is a callback so `$`-patterns
 *  in the upgrade text are inserted literally, never as substitutions. */
function applyUpgradeText(text: string, original: string, upgrade: string): string {
  if (!original) return text;
  const re = new RegExp(escapeRegExp(original), "i");
  return re.test(text) ? text.replace(re, () => upgrade) : text;
}

/** #191 — the spoken take's setup, threaded from LabOverlay so a piece with
 *  approved edits can offer a re-read mic. Mirrors the fields submitLabRecording
 *  needs; the read carries them plus recording_kind=read + the paired session. */
export interface ReReadContext {
  topic: string;
  audience?: string | null;
  slides?: PresentationSlide[];
  presentationRef?: string | null;
  domainVocabulary?: string[];
  targetLengthSeconds?: number | null;
}

/** A fresh id so each read is its own session (never overwrites the spoken
 *  take). crypto.randomUUID where available; a timestamped fallback otherwise. */
function freshGuestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `read-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function PieceList({
  pieces,
  audioRef,
  sessionId,
  suggestionsLoading,
  reReadContext,
}: {
  pieces: InstantChunk[];
  audioRef: string | null;
  sessionId: string | null;
  suggestionsLoading: boolean;
  reReadContext: ReReadContext | null;
}) {
  // #190 — the suggestions arrive async: hold a skeleton until the layer has
  // landed, then reveal the whole list at once (no progressive pop-in).
  if (suggestionsLoading) return <PieceListSkeleton count={pieces.length} />;
  return (
    <div className="flex flex-col gap-6">
      {pieces.map((c) => (
        <PieceBlock
          key={c.index}
          piece={c}
          audioRef={audioRef}
          sessionId={sessionId}
          reReadContext={reReadContext}
        />
      ))}
    </div>
  );
}

function PieceBlock({
  piece,
  audioRef,
  sessionId,
  reReadContext,
}: {
  piece: InstantChunk;
  audioRef: string | null;
  sessionId: string | null;
  /** #191 — present → a piece with approved edits offers a re-read mic. */
  reReadContext: ReReadContext | null;
}) {
  // #191 — the instant view is suggestions-only: "Approve" composes the upgraded
  // text into the piece's main text (optimistic), one row at a time. No comment,
  // no ✓, no Apply-all.
  const [appliedText, setAppliedText] = useState<string | null>(null);
  const [approved, setApproved] = useState<Record<number, boolean>>({});

  const sug = piece.sayItStronger;
  const displayText = appliedText ?? piece.userEditedText ?? piece.text;
  const canPersist = !!(sessionId && piece.snippetId);
  const hasApprovedEdit = appliedText !== null;
  // Bumps on every new approval → remounts the re-read mic so it reflects the
  // latest corrected text (a completed read of stale text can't linger).
  const approvedCount = Object.keys(approved).length;

  // Approve = write this upgrade into the piece text + record the feedback. A
  // row already approved is a no-op on the text (re-running the replace would
  // swap a SECOND occurrence of a repeated word and corrupt it).
  const approve = (i: number, u: SayItStrongerUpgrade) => {
    if (approved[i]) return;
    const next = applyUpgradeText(displayText, u.original, u.upgrade);
    setAppliedText(next);
    setApproved((s) => ({ ...s, [i]: true }));
    if (canPersist) {
      void saveTranscriptEdit(sessionId!, { snippetId: piece.snippetId! }, next);
      const feedback: {
        snippetId: string;
        sessionId: string;
        target: SuggestionFeedbackTarget;
        action: SuggestionFeedbackAction;
        upgradeIndex: number;
        suggestionVersion: number | null;
      } = {
        snippetId: piece.snippetId!,
        sessionId: sessionId!,
        target: "upgrade",
        action: "applied",
        upgradeIndex: i,
        suggestionVersion: sug?.version ?? null,
      };
      void sendSuggestionFeedback(feedback);
    }
  };

  const upgrades = sug?.upgrades ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* 1 — the piece text (punctuated prose) + its exact-span play control. */}
      <div className="flex items-start gap-3">
        {audioRef && piece.durationMs > 0 ? (
          <SectionPlay
            playKey={`piece:${piece.index}`}
            src={audioRef}
            startMs={piece.startOffsetMs}
            durationMs={piece.durationMs}
          />
        ) : null}
        <p className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
          {displayText}
        </p>
      </div>

      {/* 2 — word / phrase suggestions, each with a single left "Approve". */}
      {upgrades.length > 0 ? (
        <div className="flex flex-col gap-2">
          {upgrades.map((u, i) => (
            <SuggestionRow
              key={i}
              upgrade={u}
              approved={!!approved[i]}
              onApprove={() => approve(i, u)}
            />
          ))}
        </div>
      ) : sug?.alreadyStrong ? (
        <AlreadyStrongLine />
      ) : null}

      {/* 3 — re-read the corrected text (only once a piece has approved edits).
          Keyed by the approval count so a further approval remounts it fresh:
          the stale "Recorded" clears and the user can re-read the newer text. */}
      {hasApprovedEdit && reReadContext && sessionId ? (
        <PieceReRead
          key={approvedCount}
          pieceKey={`piece:${piece.index}:${approvedCount}`}
          spokenSessionId={sessionId}
          context={reReadContext}
        />
      ) : null}
    </div>
  );
}

/** One word/phrase upgrade row: a single left "Approve" (writes the change into
 *  the piece text) then "old → new". Same row shape for word & phrase (#191). */
function SuggestionRow({
  upgrade,
  approved,
  onApprove,
}: {
  upgrade: SayItStrongerUpgrade;
  approved: boolean;
  onApprove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={onApprove}
        disabled={approved}
        className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
          approved
            ? "bg-muted text-muted-foreground"
            : "bg-foreground text-background hover:bg-foreground/90"
        }`}
      >
        {approved ? "Approved" : "Approve"}
      </button>
      <p className="flex-1 text-[14px] leading-relaxed">
        {/* E1 — filler/overuse carry a subtle amber caution tag. */}
        {upgrade.kind !== "upgrade" ? (
          <span className="mr-1.5 inline-flex -translate-y-px items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 align-middle text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            {upgrade.kind === "filler" ? "filler" : "overused"}
          </span>
        ) : null}
        <span className="text-muted-foreground line-through">
          {upgrade.original}
        </span>{" "}
        <span aria-hidden>&rarr;</span>{" "}
        <span className="font-medium text-foreground">{upgrade.upgrade}</span>
      </p>
    </div>
  );
}

/** #191 — the per-piece re-read: record the user reading the corrected text, then
 *  upload it as recording_kind=read paired to the spoken session (its own fresh
 *  session; never counts as a new take). Stays inline; a green check on success,
 *  no readout. */
function PieceReRead({
  pieceKey,
  spokenSessionId,
  context,
}: {
  /** Unique key so the shared coordinator can tell pieces apart. */
  pieceKey: string;
  spokenSessionId: string;
  context: ReReadContext;
}) {
  const coord = useContext(ReReadCoordinatorContext);
  const mic = useDualCaptureMic({ transcript: false });
  // The RECORDING/CONNECTING state is derived from mic.state (source of truth);
  // `phase` only tracks the upload lifecycle so the UI never shows a live Stop
  // before the mic is actually recording (dropped-Stop race).
  const [phase, setPhase] = useState<"pre" | "uploading" | "done">("pre");
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const uploadingRef = useRef(false);
  const status = mic.state.status;

  // Another piece claimed the mic → release this one (only one hot mic at a
  // time). cancel() aborts a pending start too (it bumps the hook's gen token).
  useEffect(() => {
    if (coord.activeKey !== pieceKey && (starting || status === "recording")) {
      mic.cancel();
      setStarting(false);
    }
  }, [coord.activeKey, pieceKey, starting, status, mic]);

  // Mic is live → drop the "connecting" flag so the real Stop button shows.
  useEffect(() => {
    if (status === "recording") setStarting(false);
  }, [status]);

  // Stopped → upload the read once (uploadingRef guards a re-entry).
  useEffect(() => {
    if (mic.state.status !== "stopped" || uploadingRef.current) return;
    uploadingRef.current = true;
    const { audioBlob, durationSec } = mic.state;
    setPhase("uploading");
    void (async () => {
      const res = await submitLabRecording({
        audioBlob,
        durationSec,
        topic: context.topic,
        audience: context.audience ?? undefined,
        slides: context.slides,
        presentationRef: context.presentationRef ?? undefined,
        domainVocabulary: context.domainVocabulary,
        targetLengthSeconds: context.targetLengthSeconds ?? undefined,
        recordingKind: "read",
        pairedSessionId: spokenSessionId,
        guestSessionId: freshGuestId(),
      });
      mic.cancel(); // reset the hook (releases the mic, back to idle)
      coord.release(pieceKey);
      uploadingRef.current = false;
      if (res.kind === "ok") {
        setPhase("done");
      } else {
        setErrorMsg(
          res.kind === "rejected"
            ? res.message
            : "Couldn't save your read. Try again."
        );
        setPhase("pre");
      }
    })();
  }, [mic, context, spokenSessionId, coord, pieceKey]);

  // A mic-level failure (denied / unsupported) surfaces as a retryable error.
  useEffect(() => {
    if (mic.state.status === "error") {
      setErrorMsg(mic.state.message);
      setStarting(false);
      coord.release(pieceKey);
    }
  }, [mic.state, coord, pieceKey]);

  if (phase === "done") {
    return (
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-success">
        <Check className="h-4 w-4" aria-hidden /> Recorded
      </p>
    );
  }
  if (phase === "uploading") {
    return (
      <p className="text-[13px] text-muted-foreground">Saving your read…</p>
    );
  }
  if (status === "recording") {
    return (
      <button
        type="button"
        onClick={() => void mic.stop()}
        className="flex items-center gap-2 self-start rounded-full bg-destructive px-4 py-1.5 text-[13px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
      >
        <Square className="h-3.5 w-3.5" aria-hidden /> Stop
      </button>
    );
  }
  if (starting) {
    // getUserMedia gap — no live Stop yet; Cancel aborts the pending start.
    return (
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-muted-foreground">
          Getting your mic ready…
        </span>
        <button
          type="button"
          onClick={() => {
            mic.cancel();
            setStarting(false);
            coord.release(pieceKey);
          }}
          className="text-[12px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }
  // idle (with an optional retryable error)
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => {
          setErrorMsg(null);
          setStarting(true);
          coord.claim(pieceKey);
          void mic.start();
        }}
        className="flex items-center gap-2 self-start rounded-full border border-primary/40 bg-primary/5 px-4 py-1.5 text-[13px] font-medium text-primary transition-colors hover:border-primary/60"
      >
        <Mic className="h-3.5 w-3.5" aria-hidden /> Re-read this
      </button>
      {errorMsg ? (
        <p className="text-[12px] text-destructive">{errorMsg}</p>
      ) : null}
    </div>
  );
}

/** The affirming line shown when a piece was already strong (no upgrades). */
function AlreadyStrongLine() {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-primary/[0.06] px-4 py-3">
      <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p className="text-[14px] text-foreground">
        This one&apos;s already strong. Said as-is.
      </p>
    </div>
  );
}

/** Skeleton for the whole piece list while the suggestion layer loads. */
function PieceListSkeleton({ count }: { count: number }) {
  const rows = Math.min(Math.max(count, 2), 5);
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-6 w-2/3 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
      <SuggestionShimmer />
    </div>
  );
}

/* ── legacy per-snippet block (also the deckless "moments" cards) ── */

function MomentBlock({
  snippet,
  skipTranscript = false,
  hideShimmer = false,
}: {
  snippet: ReadoutSnippet;
  skipTranscript?: boolean;
  /** R4-9 — instant mode owns the single suggestions-loading state; the
   *  per-card shimmer must not double it. */
  hideShimmer?: boolean;
}) {
  const text = snippetText(snippet);
  return (
    <div className="flex flex-col gap-3">
      {!skipTranscript && text ? (
        <TranscriptBlock
          text={text}
          play={
            snippet.audioRef ? (
              <SectionPlay
                playKey={`moment:${momentKey(snippet)}`}
                src={snippet.audioRef}
                startMs={snippet.startOffsetMs}
                durationMs={snippet.durationMs}
              />
            ) : null
          }
        />
      ) : skipTranscript && snippet.audioRef ? (
        <SectionPlay
          playKey={`moment:${momentKey(snippet)}`}
          src={snippet.audioRef}
          startMs={snippet.startOffsetMs}
          durationMs={snippet.durationMs}
        />
      ) : null}

      <CommentBlock
        snippet={hasCommentContent(snippet) ? snippet : null}
        transcriptCorrected={
          snippet.coach?.transcriptCorrected
            ? [snippet.coach.transcriptCorrected]
            : []
        }
        breakthroughSnippet={snippet.breakthrough ? snippet : null}
        hideShimmer={hideShimmer}
      />
    </div>
  );
}

/* ── transcript: small orange play directly above the text (P4) ── */

function TranscriptBlock({
  text,
  play,
}: {
  text: string;
  play: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {play ? (
        <div className="flex items-center gap-2">
          {play}
          <CopyButton text={text} iconOnly />
        </div>
      ) : (
        <div className="flex items-center">
          <CopyButton text={text} iconOnly />
        </div>
      )}
      {/* Black on white, plain — no card, not editable, no toggle (P4). */}
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}

/* ── the always-visible comment under its transcript (P6) ── */

function CommentBlock({
  snippet,
  transcriptCorrected,
  breakthroughSnippet,
  hideShimmer = false,
}: {
  /** The moment whose coach note + Say It Stronger render; null → no comment. */
  snippet: ReadoutSnippet | null;
  transcriptCorrected: string[];
  breakthroughSnippet: ReadoutSnippet | null;
  /** R4-9 — suppress the per-card shimmer when the instant view's single
   *  suggestions-loading state is in charge. */
  hideShimmer?: boolean;
}) {
  const empty =
    !snippet && transcriptCorrected.length === 0 && !breakthroughSnippet;
  if (empty) return null;
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-3">
      {transcriptCorrected.map((t, i) => (
        <CoachTranscript key={i} text={t} />
      ))}

      {snippet ? (
        <>
          {snippet.coach?.note ? (
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
              {snippet.coach.note}
            </p>
          ) : null}
          {snippet.coach?.when ? (
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">
              {snippet.coach.when}
            </p>
          ) : null}
          {snippet.coach?.examples && snippet.coach.examples.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {snippet.coach.examples.map((ex, i) => (
                <p key={i} className="text-[14px] text-foreground">
                  {ex}
                </p>
              ))}
            </div>
          ) : null}
          {snippet.sayItStronger ? (
            <SayItStrongerCard data={snippet.sayItStronger} />
          ) : !snippet.coach?.note && !hideShimmer ? (
            <SuggestionShimmer />
          ) : null}
        </>
      ) : null}

      {breakthroughSnippet ? (
        <>
          <BreakthroughBlock videoRef={breakthroughSnippet.breakthroughVideoRef} />
          {/* P7 — coach-assigned breakthrough → deep-link into the game. */}
          {breakthroughSnippet.id ? (
            <Link
              href={`/game?snippet=${encodeURIComponent(breakthroughSnippet.id)}`}
              className="self-start rounded-full bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Key moment
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ── deckless artificial slide: a generic placeholder image card ── */

function PlaceholderSlide() {
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
      <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
        <Sparkles className="h-8 w-8" aria-hidden />
        <p className="text-[12px] font-medium uppercase tracking-wider">
          Audio only
        </p>
      </div>
    </div>
  );
}

/* ── copy-to-clipboard control ── */

function CopyButton({ text, iconOnly = false }: { text: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      },
      () => {
        /* clipboard blocked — no-op */
      }
    );
  };
  if (iconOnly) {
    return (
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy text"}
        onClick={copy}
        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? (
          <Check className="h-4 w-4 text-primary" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden /> Copy text
        </>
      )}
    </button>
  );
}

/* ── "sharpening suggestions" placeholder while Say It Stronger generates ── */

function SuggestionShimmer() {
  return (
    <div className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden />
      <span className="animate-pulse">Sharpening suggestions...</span>
    </div>
  );
}

/* ── coach-corrected transcript — a calm, labelled card (free, unconditional) ── */

function CoachTranscript({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted px-4 py-3">
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        Coach&apos;s corrected version
      </p>
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}

/* ── Say It Stronger suggestion card ── */

function SayItStrongerCard({ data }: { data: SayItStronger }) {
  const audience = useContext(ReadoutAudienceContext);
  if (data.alreadyStrong) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-primary/[0.06] px-4 py-3">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-[15px] text-foreground">
          This one&apos;s already strong. Said as-is.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {data.upgrades.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.upgrades.map((u, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <p className="text-[14px] leading-relaxed">
                {/* E1 — filler/overuse carry a subtle amber caution tag: the
                    model judged the word against this speaker's own take. */}
                {u.kind !== "upgrade" ? (
                  <span className="mr-1.5 inline-flex -translate-y-px items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 align-middle text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-amber-500"
                      aria-hidden
                    />
                    {u.kind === "filler" ? "filler" : "overused"}
                  </span>
                ) : null}
                <span className="text-muted-foreground line-through">
                  {u.original}
                </span>{" "}
                <span aria-hidden>&rarr;</span>{" "}
                <span className="font-medium text-foreground">{u.upgrade}</span>
                {audience ? (
                  <span className="text-muted-foreground">
                    {" "}
                    (audience: {audience})
                  </span>
                ) : null}
              </p>
              {u.reason ? (
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {u.reason}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {data.rewriteYourVoice ? (
        <RewriteBlock label="Your voice" text={data.rewriteYourVoice} />
      ) : null}
      {data.rewritePolished ? (
        <RewriteBlock label="Polished" text={data.rewritePolished} />
      ) : null}

      {data.why ? (
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          {data.why}
        </p>
      ) : null}
    </div>
  );
}

function RewriteBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <CopyButton text={text} iconOnly />
      </div>
      <p className="text-[15px] leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

/* ── breakthrough — headline + note + (pending BE) per-snippet video ── */

function BreakthroughBlock({ videoRef }: { videoRef: string | null }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-primary/[0.08] px-4 py-4">
      <p className="text-[15px] font-semibold text-foreground">
        🥳 Here you turned your stress into charisma!
      </p>
      {videoRef ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={videoRef} controls playsInline className="w-full bg-black" />
        </div>
      ) : null}
    </div>
  );
}

/* ── voice metrics unavailable — soft inline note (A), not an error ── */

function VoiceMetricsNotice() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 text-[14px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        Voice metrics unavailable for this take. For best results, try speaking a
        bit louder or recording in a calmer, quieter space.
      </p>
    </div>
  );
}

/* ── post-coach summary (overall message + coach video + breakthroughs) ── */

function SummaryBlock({ payload }: { payload: ReadoutPayload }) {
  const [breakthroughOpen, setBreakthroughOpen] = useState(false);
  const breakthroughRef = useRef<HTMLDivElement>(null);
  const hasBreakthrough = payload.snippets.some((s) => s.breakthrough);

  function toggleBreakthrough() {
    setBreakthroughOpen((v) => {
      if (!v) {
        setTimeout(
          () =>
            breakthroughRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            }),
          50
        );
      }
      return !v;
    });
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-6">
      {payload.overallMessage ? (
        <div className="rounded-2xl bg-primary/[0.10] p-4">
          <p className="whitespace-pre-line text-[17px] leading-relaxed text-foreground">
            {payload.overallMessage}
          </p>
        </div>
      ) : null}

      {payload.videoRef ? <CoachVideoCard src={payload.videoRef} /> : null}

      {hasBreakthrough ? (
        <>
          <button
            type="button"
            onClick={toggleBreakthrough}
            className="w-full rounded-xl bg-foreground px-4 py-3 text-[15px] font-semibold text-background"
          >
            {breakthroughOpen
              ? "Close breakthrough"
              : "Explore your breakthrough moment!"}
          </button>
          {breakthroughOpen ? (
            <div ref={breakthroughRef} className="flex flex-col gap-3">
              {payload.snippets
                .filter((s) => s.breakthrough)
                .map((s, i) => (
                  <BreakthroughBlock
                    key={s.id || String(i)}
                    videoRef={s.breakthroughVideoRef}
                  />
                ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ── coach video card (session-level) ── */

function CoachVideoCard({ src }: { src: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 self-start rounded-full border border-border px-4 py-2 text-[14px] text-foreground transition-colors hover:border-primary/50"
      >
        <Play className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        Watch your coach&apos;s note
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={src} controls autoPlay playsInline className="w-full bg-black" />
    </div>
  );
}

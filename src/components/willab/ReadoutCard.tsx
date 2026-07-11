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
import { Check, ChevronDown, Copy, Info, Pencil, Play, Sparkles } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender } from "./pdfSlides";
import SnippetScreenShell from "./SnippetScreenShell";
import {
  saveTranscriptEdit,
  type TranscriptEditTarget,
} from "@/services/api/transcriptEdits";
import {
  decideReadoutBack,
  pickTopSnippet,
  type FullTranscriptChunk,
  type ReadoutPayload,
  type SayItStronger,
  type ReadoutSlide,
  type ReadoutSlideGroup,
  type ReadoutSnippet,
} from "./readout";

/** A readout page. In per-deck-slide mode (BE slide_transcripts present) each
 *  page is one DECK SLIDE carrying its COMPLETE 1:1 transcript + the slide's
 *  span in the parent recording; the per-snippet acoustic moments stack below.
 *  In the legacy fallback (no slide_transcripts) fullTranscript is null and the
 *  page is a single snippet, exactly as before. */
type ReadoutPage = ReadoutSlideGroup & {
  fullTranscript: string | null;
  fullAudioRef: string | null;
  fullStartOffsetMs: number;
  fullDurationMs: number;
  /** Deckless-only: the whole transcript split into ordered chunks, rendered as
   *  one artificial-slide page (placeholder image + stacked paragraphs). null in
   *  every decked / legacy path. */
  chunks: FullTranscriptChunk[] | null;
};

/* -------------------------------------------------------------------------- */
/*  ReadoutCard — one slide per page, its spoken moments stacked below it.      */
/*  Each moment shows its transcript in the orange card; tapping "Tap to see    */
/*  the coach insight" expands the rest IN PLACE below it (player + coach        */
/*  comment + metrics + breakthrough) — no new frame, the navbar is untouched.  */
/*  Multiple moments can be open at once. Back/swipe-back collapses the most     */
/*  recently opened moment, then pages to the previous slide, then closes.      */
/* -------------------------------------------------------------------------- */

/** Stable key for a moment (BE id when present; else slide+offset). */
function momentKey(s: ReadoutSnippet): string {
  return s.id || `${s.slide?.index ?? "g"}:${s.startOffsetMs}`;
}

/** A single toggle key for a per-deck-slide page's transcript card. */
function slideToggleKey(g: ReadoutPage): string {
  return `slide:${g.slideIndex ?? "g"}`;
}

/** Does this snippet have anything behind the chevron (coach note or a "Say It
 *  Stronger" suggestion)? Acoustic numbers left the user view entirely
 *  (2026-07-07) — the reveal now carries coaching, not metrics. The breakthrough
 *  badge is NOT counted (it renders un-gated under the transcript, C1). */
function snippetHasReveal(s: ReadoutSnippet): boolean {
  return !!(
    s.coach?.note ||
    s.coach?.when ||
    (s.coach?.examples && s.coach.examples.length > 0) ||
    s.sayItStronger
  );
}

/** The toggle keys present on a page (drives the Back-collapse gesture). One
 *  key per deck slide in per-slide mode; one per moment in the legacy view. */
function pageToggleKeys(g: ReadoutPage): string[] {
  if (g.fullTranscript !== null) return [slideToggleKey(g)];
  return g.snippets.map(momentKey);
}

/* ── transcript-edit context (avoids drilling the handlers 4 levels deep) ── */

interface ReadoutEditApi {
  /** Display text for a snippet: local optimistic edit → server edit → original. */
  snippetText: (s: ReadoutSnippet) => string;
  chunkText: (c: FullTranscriptChunk) => string;
  isSnippetEdited: (s: ReadoutSnippet) => boolean;
  isChunkEdited: (c: FullTranscriptChunk) => boolean;
  /** Optimistic save; resolves false on failure so the editor can surface it. */
  save: (target: TranscriptEditTarget, text: string) => Promise<boolean>;
  /** False for the sample readout / when there's no session to persist to. */
  canEdit: boolean;
}

const NOOP_EDIT: ReadoutEditApi = {
  snippetText: (s) => s.userEditedText ?? s.transcript,
  chunkText: (c) => c.userEditedText ?? c.transcript,
  isSnippetEdited: (s) => s.userEditedText !== null,
  isChunkEdited: (c) => c.userEditedText !== null,
  save: async () => false,
  canEdit: false,
};

const ReadoutEditContext = createContext<ReadoutEditApi>(NOOP_EDIT);
const useReadoutEdit = () => useContext(ReadoutEditContext);

export default function ReadoutCard({
  payload,
  sessionId = null,
  isSample = false,
  onSend,
  onClose,
  managed = true,
  onRegisterBack,
}: {
  payload: ReadoutPayload;
  /** The session whose transcript edits persist to. null → editing disabled. */
  sessionId?: string | null;
  isSample?: boolean;
  onSend?: () => void;
  /** Required for shell mode (full-screen overlay). Both LabOverlay and
   *  InsightsOverlay provide this. Without it the card renders a plain div. */
  onClose?: () => void;
  managed?: boolean;
  /** Lets the host wire device Back into the readout's internal layout stack
   *  (collapse → page → close). The host passes this and feeds the returned
   *  handler to useBackDismiss as its onBack. */
  onRegisterBack?: (handler: () => boolean) => void;
}) {
  // Optimistic transcript edits, keyed by target. Merged over the payload's
  // user_edited_text (which itself overrides the original) for display.
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const editApi = useMemo<ReadoutEditApi>(() => {
    const snipKey = (id: string) => `snip:${id}`;
    const chunkKey = (i: number) => `chunk:${i}`;
    return {
      snippetText: (s) =>
        localEdits[snipKey(s.id)] ?? s.userEditedText ?? s.transcript,
      chunkText: (c) =>
        localEdits[chunkKey(c.index)] ?? c.userEditedText ?? c.transcript,
      isSnippetEdited: (s) =>
        localEdits[snipKey(s.id)] !== undefined || s.userEditedText !== null,
      isChunkEdited: (c) =>
        localEdits[chunkKey(c.index)] !== undefined || c.userEditedText !== null,
      canEdit: !isSample && !!sessionId,
      save: async (target, text) => {
        const key =
          "snippetId" in target
            ? snipKey(target.snippetId)
            : chunkKey(target.chunkIndex);
        setLocalEdits((prev) => ({ ...prev, [key]: text })); // optimistic
        if (isSample || !sessionId) return true; // local-only preview
        const r = await saveTranscriptEdit(sessionId, target, text);
        if (!r.ok) {
          // Revert the optimistic edit so the display never shows text that
          // didn't persist (the editor stays open with its error for a retry).
          setLocalEdits((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
        return r.ok;
      },
    };
  }, [localEdits, sessionId, isSample]);
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

  // The parent recording's audio — shared across snippets, so a slide with no
  // salient snippet (e.g. the quiet first slide) can still play its own span.
  const parentAudioRef = useMemo(
    () => payload.snippets.find((s) => s.audioRef)?.audioRef ?? null,
    [payload.snippets]
  );

  // Pagination model. When the BE sends complete per-slide transcripts we page
  // per DECK SLIDE (slide + its full 1:1 transcript + its acoustic moments) —
  // every slide gets a page, so the quiet first slide is never dropped. Without
  // them we keep the legacy one-snippet-per-page view.
  const groups = useMemo((): ReadoutPage[] => {
    if (payload.slideTranscripts.length > 0) {
      const txIndices = new Set(payload.slideTranscripts.map((t) => t.index));
      const pages: ReadoutPage[] = payload.slideTranscripts.map((st) => ({
        slideIndex: st.index,
        slide: slidesByIndex.get(st.index) ?? null,
        snippets: payload.snippets.filter((s) => s.slide?.index === st.index),
        fullTranscript: st.transcript,
        fullAudioRef: parentAudioRef,
        fullStartOffsetMs: st.startOffsetMs,
        fullDurationMs: st.durationMs,
        chunks: null,
      }));
      // Catch-all so a moment whose slide has no transcript entry (or no slide
      // at all) is never silently dropped — rendered as a legacy moments page.
      const leftover = payload.snippets.filter(
        (s) => !(s.slide && txIndices.has(s.slide.index))
      );
      if (leftover.length > 0) {
        pages.push({
          slideIndex: null,
          slide: null,
          snippets: leftover,
          fullTranscript: null,
          fullAudioRef: null,
          fullStartOffsetMs: 0,
          fullDurationMs: 0,
          chunks: null,
        });
      }
      return pages;
    }
    // Deckless take with a chunked full transcript → ONE artificial-slide page
    // (placeholder image + the chunks stacked as paragraphs, no pagination).
    if (payload.fullTranscriptChunks.length > 0) {
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
        },
      ];
    }
    return payload.snippets.map((s) => ({
      slideIndex: s.slide?.index ?? null,
      slide: s.slide,
      snippets: [s],
      fullTranscript: null,
      fullAudioRef: null,
      fullStartOffsetMs: 0,
      fullDurationMs: 0,
      chunks: null,
    }));
  }, [
    payload.slideTranscripts,
    payload.snippets,
    payload.fullTranscriptChunks,
    slidesByIndex,
    parentAudioRef,
  ]);
  const groupCount = groups.length;
  const [cursor, setCursor] = useState(0);
  // Keys of expanded moments, in open order (newest last) — drives Back.
  const [expanded, setExpanded] = useState<string[]>([]);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const toggle = useCallback((key: string) => {
    setExpanded((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  // Device Back: collapse the newest expanded moment on the current slide, else
  // page back, else (return false) let the host close the overlay.
  const handleBack = useCallback((): boolean => {
    const gs = groupsRef.current;
    const i = Math.min(cursorRef.current, Math.max(gs.length - 1, 0));
    // On the summary page the cursor sits PAST the last group (i clamps down),
    // so there's no on-screen card to collapse — empty keys → Back pages off the
    // summary instead of silently collapsing a now-offscreen moment.
    const onRealPage = cursorRef.current === i;
    const currentKeys = onRealPage && gs[i] ? pageToggleKeys(gs[i]) : [];
    const action = decideReadoutBack(
      cursorRef.current,
      expandedRef.current,
      currentKeys
    );
    if (action.type === "collapse") {
      setExpanded((prev) => prev.filter((k) => k !== action.key));
      return true;
    }
    if (action.type === "page") {
      setCursor((c) => Math.max(c - 1, 0));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    onRegisterBack?.(handleBack);
  }, [onRegisterBack, handleBack]);

  const hasSummaryPage = !!(
    onClose && (payload.overallMessage || payload.videoRef)
  );
  const shellTotal = hasSummaryPage
    ? Math.max(groupCount, 1) + 1
    : Math.max(groupCount, 1);
  const idx = Math.min(cursor, Math.max(groupCount - 1, 0));
  const atSummary = hasSummaryPage && cursor === shellTotal - 1;
  const atLast = cursor === shellTotal - 1;

  if (!onClose) {
    if (groupCount === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[15px] text-muted-foreground">
            No analyzable snippets in this recording.
          </p>
        </div>
      );
    }
    return (
      <ReadoutEditContext.Provider value={editApi}>
        <div className="flex flex-1 flex-col overflow-y-auto">
          {groups.map((g, i) => (
            <SlideGroupPage
              key={g.slideIndex ?? `general-${i}`}
              group={g}
              presentationRef={payload.presentationRef}
              isSample={isSample && i === 0}
              // Take-level note: show once (first group) in the stacked view.
              voiceMetricsAvailable={i === 0 ? payload.voiceMetricsAvailable : true}
              expanded={expanded}
              onToggle={toggle}
            />
          ))}
        </div>
      </ReadoutEditContext.Provider>
    );
  }

  function handleNext() {
    if (!atLast) {
      setCursor((c) => c + 1);
    } else if (!hasSummaryPage && onSend) {
      onSend(); // pre-send readout: last page sends the take
    } else if (onClose) {
      onClose(); // viewer: last page closes the layer
    }
  }

  return (
    <ReadoutEditContext.Provider value={editApi}>
      <SnippetScreenShell
        onClose={onClose}
        index={cursor}
        total={shellTotal}
        onPrev={() => setCursor((c) => Math.max(c - 1, 0))}
        onNext={handleNext}
        nextLabel={
          atLast ? (!hasSummaryPage && onSend ? "Send for analysis" : "Close") : undefined
        }
        nextTone={atLast ? "terminal" : "primary"}
        managed={managed}
      >
        {atSummary ? (
          <SummaryPage payload={payload} />
        ) : groupCount === 0 ? (
          <p className="px-4 py-12 text-center text-[15px] text-muted-foreground">
            No analyzable snippets in this recording.
          </p>
        ) : (
          <SlideGroupPage
            group={groups[idx]}
            presentationRef={payload.presentationRef}
            isSample={isSample && idx === 0}
            voiceMetricsAvailable={payload.voiceMetricsAvailable}
            expanded={expanded}
            onToggle={toggle}
          />
        )}
      </SnippetScreenShell>
    </ReadoutEditContext.Provider>
  );
}

/* ── one slide + its stacked spoken moments ── */

function SlideGroupPage({
  group,
  presentationRef,
  isSample,
  voiceMetricsAvailable,
  expanded,
  onToggle,
}: {
  group: ReadoutPage;
  presentationRef: string | null;
  isSample: boolean;
  voiceMetricsAvailable: boolean;
  expanded: string[];
  onToggle: (key: string) => void;
}) {
  // Per-deck-slide mode: the page carries the slide's COMPLETE transcript.
  const perSlide = group.fullTranscript !== null;
  // The deck page index to render: the slide's own index, or (per-slide mode)
  // the page's slideIndex even when no `slides` entry carried title/body — the
  // PDF page renders off presentationRef + index alone, so the quiet first
  // slide still shows its image.
  const slidePageIndex =
    group.slide?.index ?? (perSlide ? group.slideIndex : null);
  const deckless = group.chunks !== null;
  return (
    <div className="flex flex-col">
      {/* Slide — edge-to-edge, once per group (never repeated per moment). A
          deckless take has no deck, so it gets one artificial placeholder card. */}
      {slidePageIndex !== null ? (
        <div className="w-full bg-muted">
          <SlideRender
            presentationRef={presentationRef}
            pageIndex={slidePageIndex}
            title={group.slide?.title ?? ""}
            body={group.slide?.body ?? ""}
            className="w-full"
          />
        </div>
      ) : deckless ? (
        <PlaceholderSlide />
      ) : null}

      <div className="flex flex-col gap-3 px-4 py-4">
        {isSample ? (
          <p className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-[12px] text-primary">
            Sample data — your real acoustic Training Profile wires in at seam
            ③.
          </p>
        ) : null}

        {/* A — voice metrics unavailable for this take (empty acoustic signal):
            a soft inline note instead of empty metric rows. */}
        {!voiceMetricsAvailable ? <VoiceMetricsNotice /> : null}

        {deckless ? (
          <DecklessContent group={group} expanded={expanded} onToggle={onToggle} />
        ) : perSlide ? (
          // Per deck slide: the COMPLETE 1:1 transcript + slide playback shown
          // exactly once (each slide's speech is distinct — never repeated).
          <DeckSlideContent
            group={group}
            isOpen={expanded.includes(slideToggleKey(group))}
            onToggle={() => onToggle(slideToggleKey(group))}
          />
        ) : (
          group.snippets.map((s) => {
            const key = momentKey(s);
            return (
              <MomentRow
                key={key}
                snippet={s}
                isOpen={expanded.includes(key)}
                onToggle={() => onToggle(key)}
              />
            );
          })
        )}
      </div>
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

/* ── deckless page body: whole transcript as editable chunks + moment upgrades ── */

function DecklessContent({
  group,
  expanded,
  onToggle,
}: {
  group: ReadoutPage;
  expanded: string[];
  onToggle: (key: string) => void;
}) {
  const edit = useReadoutEdit();
  const chunks = group.chunks ?? [];
  // The whole transcript, joined from the (possibly edited) chunks, for Copy.
  const fullText = chunks.map((c) => edit.chunkText(c)).join("\n\n");
  // Moments that have something to reveal (a Say It Stronger suggestion or a
  // coach note) — shown below the transcript as "sharpen these" cards, each with
  // its own playback (the snippet's clamped span is valid even deckless).
  const moments = group.snippets.filter(snippetHasReveal);
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          Your transcript
        </p>
        {fullText ? <CopyButton text={fullText} /> : null}
      </div>

      <div className="flex flex-col gap-2">
        {chunks.map((c) => (
          <EditableParagraph
            key={c.index}
            text={edit.chunkText(c)}
            edited={edit.isChunkEdited(c)}
            canEdit={edit.canEdit}
            onSave={(t) => edit.save({ chunkIndex: c.index }, t)}
          />
        ))}
      </div>

      {moments.length > 0 ? (
        <div className="mt-2 flex flex-col gap-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Moments to sharpen
          </p>
          {moments.map((s) => (
            <div key={momentKey(s)} className="flex flex-col gap-3">
              {s.audioRef ? (
                <MediaPlayer
                  src={s.audioRef}
                  startOffsetMs={s.startOffsetMs}
                  durationMs={s.durationMs}
                />
              ) : null}
              {s.breakthrough ? (
                <BreakthroughBlock videoRef={s.breakthroughVideoRef} />
              ) : null}
              <SnippetDetail snippet={s} />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

/* ── one spoken moment: transcript card + in-place expand ── */

function MomentRow({
  snippet,
  isOpen,
  onToggle,
}: {
  snippet: ReadoutSnippet;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const edit = useReadoutEdit();
  const hasReveal = snippetHasReveal(snippet);
  const text = edit.snippetText(snippet);

  return (
    <div className="flex flex-col gap-3">
      {/* Playback FIRST — directly below the slide. */}
      {snippet.audioRef ? (
        <MediaPlayer
          src={snippet.audioRef}
          startOffsetMs={snippet.startOffsetMs}
          durationMs={snippet.durationMs}
        />
      ) : null}

      {/* Then the transcript — copy + edit affordances; tapping toggles the reveal. */}
      {text ? (
        <TranscriptCard
          text={text}
          edited={edit.isSnippetEdited(snippet)}
          canEdit={edit.canEdit}
          onSaveEdit={(t) => edit.save({ snippetId: snippet.id }, t)}
          hasReveal={hasReveal}
          isOpen={isOpen}
          onToggle={onToggle}
        />
      ) : null}

      {/* Coach-corrected transcript — free + always visible when the coach
          saved one, alongside the raw transcript above it. */}
      {snippet.coach?.transcriptCorrected ? (
        <CoachTranscript text={snippet.coach.transcriptCorrected} />
      ) : null}

      {/* C1 — breakthrough under the transcript, always visible. */}
      {snippet.breakthrough ? (
        <BreakthroughBlock videoRef={snippet.breakthroughVideoRef} />
      ) : null}

      {/* Suggestions are still generating (async) — a subtle hint, never blocking. */}
      {!snippet.sayItStronger && !snippet.coach?.note ? <SuggestionShimmer /> : null}

      {isOpen && hasReveal ? <SnippetDetail snippet={snippet} /> : null}
    </div>
  );
}

/* ── transcript card: display text + copy + inline edit + reveal chevron ── */

function TranscriptCard({
  text,
  edited,
  canEdit,
  onSaveEdit,
  hasReveal,
  isOpen,
  onToggle,
}: {
  text: string;
  edited: boolean;
  canEdit: boolean;
  onSaveEdit: (text: string) => Promise<boolean>;
  hasReveal: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <InlineEditor
        initial={text}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
        onSave={onSaveEdit}
      />
    );
  }

  return (
    <div
      role={hasReveal ? "button" : undefined}
      tabIndex={hasReveal ? 0 : undefined}
      onClick={hasReveal ? onToggle : undefined}
      onKeyDown={
        hasReveal
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onToggle();
            }
          : undefined
      }
      aria-expanded={hasReveal ? isOpen : undefined}
      className={`flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3 ${hasReveal ? "cursor-pointer" : ""}`}
    >
      <p className="flex-1 text-[15px] leading-relaxed text-foreground">
        {text}
        {edited ? (
          <span className="ml-2 align-middle text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            edited
          </span>
        ) : null}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <CopyButton text={text} iconOnly />
        {canEdit ? (
          <IconAction
            label="Edit text"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </IconAction>
        ) : null}
        {hasReveal ? (
          <ChevronDown
            className={`mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

/* ── a deckless transcript chunk: a plain editable paragraph ── */

function EditableParagraph({
  text,
  edited,
  canEdit,
  onSave,
}: {
  text: string;
  edited: boolean;
  canEdit: boolean;
  onSave: (text: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <InlineEditor
        initial={text}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
        onSave={onSave}
      />
    );
  }
  return (
    <div className="flex items-start gap-2">
      <p className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
        {text}
        {edited ? (
          <span className="ml-2 align-middle text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            edited
          </span>
        ) : null}
      </p>
      {canEdit ? (
        <IconAction label="Edit text" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" aria-hidden />
        </IconAction>
      ) : null}
    </div>
  );
}

/* ── shared inline textarea editor (optimistic; surfaces a save failure) ── */

function InlineEditor({
  initial,
  onSave,
  onCancel,
  onSaved,
}: {
  initial: string;
  onSave: (text: string) => Promise<boolean>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.focus();
  }, [draft]);

  async function save() {
    const t = draft.trim();
    if (!t || saving) return;
    setSaving(true);
    setError(null);
    const ok = await onSave(t);
    setSaving(false);
    if (ok) onSaved();
    else setError("Couldn't save that edit. Try again.");
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        maxLength={2000}
        className="max-h-[50vh] w-full resize-none overflow-y-auto rounded-xl border border-primary bg-background px-3 py-2 text-[15px] leading-relaxed outline-none focus:ring-1 focus:ring-primary"
      />
      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-full border border-border py-2 text-[14px] text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !draft.trim()}
          className="flex-1 rounded-full bg-primary py-2 text-[14px] font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ── small icon button + a copy-to-clipboard control ── */

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

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

/* ── per deck slide: complete transcript (once) + slide playback + detail ── */

function DeckSlideContent({
  group,
  isOpen,
  onToggle,
}: {
  group: ReadoutPage;
  isOpen: boolean;
  onToggle: () => void;
}) {
  // Each slide's speech is distinct, so the transcript is shown ONCE here — no
  // per-moment transcript cards repeating it. The chevron reveals the acoustic
  // detail for the slide's SINGLE top moment (lowest rank → highest power /
  // stickiness → earliest), so a slide with several salient snippets shows one
  // coach comment, not a duplicated-looking stack.
  const top = pickTopSnippet(group.snippets.filter(snippetHasReveal));
  const detailSnippets = top ? [top] : [];
  const hasReveal = detailSnippets.length > 0;
  // C1 — the slide's breakthrough shows under the transcript, always visible
  // (not behind the chevron) when the coach confirmed it.
  const breakthroughSnippet = group.snippets.find((s) => s.breakthrough);
  return (
    <>
      {/* Playback FIRST — directly below the slide (parent recording, clamped). */}
      {group.fullAudioRef && group.fullDurationMs > 0 ? (
        <MediaPlayer
          src={group.fullAudioRef}
          startOffsetMs={group.fullStartOffsetMs}
          durationMs={group.fullDurationMs}
        />
      ) : null}

      {/* Then the transcript. */}
      {group.fullTranscript ? (
        <div
          role={hasReveal ? "button" : undefined}
          tabIndex={hasReveal ? 0 : undefined}
          onClick={hasReveal ? onToggle : undefined}
          onKeyDown={
            hasReveal
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") onToggle();
                }
              : undefined
          }
          aria-expanded={hasReveal ? isOpen : undefined}
          className={`flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3 ${hasReveal ? "cursor-pointer" : ""}`}
        >
          <p className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {group.fullTranscript}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <CopyButton text={group.fullTranscript} iconOnly />
            {hasReveal ? (
              <ChevronDown
                className={`mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-[14px] italic text-muted-foreground">
          No speech recorded on this slide.
        </p>
      )}

      {/* Coach-corrected transcript(s) for this slide's moments — free + always
          visible when saved, alongside the raw slide transcript above. */}
      {group.snippets
        .map((s) => s.coach?.transcriptCorrected)
        .filter((t): t is string => !!t)
        .map((t, i) => (
          <CoachTranscript key={i} text={t} />
        ))}

      {/* C1 — breakthrough under the transcript, always visible. */}
      {breakthroughSnippet ? (
        <BreakthroughBlock videoRef={breakthroughSnippet.breakthroughVideoRef} />
      ) : null}

      {/* Acoustic detail for the slide's moments — no transcript / player repeat. */}
      {isOpen && hasReveal ? (
        <div className="flex flex-col gap-5">
          {detailSnippets.map((s) => (
            <SnippetDetail key={momentKey(s)} snippet={s} />
          ))}
        </div>
      ) : null}
    </>
  );
}

/* ── the in-place reveal: coach comment → metrics (no transcript / breakthrough) ── */

function SnippetDetail({ snippet }: { snippet: ReadoutSnippet }) {
  return (
    <div className="flex flex-col gap-4">
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

      {/* Say It Stronger — the LLM suggestion overlay (replaces the acoustic
          numbers that used to live here). A suggestion only; never the
          transcript, never fed to the best-presentation pipeline (L1). */}
      {snippet.sayItStronger ? (
        <SayItStrongerCard data={snippet.sayItStronger} />
      ) : null}
    </div>
  );
}

/* ── Say It Stronger suggestion card ── */

function SayItStrongerCard({ data }: { data: SayItStronger }) {
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
    <div className="flex flex-col gap-4 rounded-xl bg-primary/[0.06] px-4 py-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary">
          Say it stronger
        </p>
      </div>

      {data.upgrades.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.upgrades.map((u, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <p className="text-[14px] leading-relaxed">
                <span className="text-muted-foreground line-through">
                  {u.original}
                </span>{" "}
                <span aria-hidden>&rarr;</span>{" "}
                <span className="font-medium text-foreground">{u.upgrade}</span>
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
  // The explanation IS the coach comment (shown above in the expanded moment);
  // this block adds the celebratory headline + the coach's separate video.
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

/* ── summary page (post-coach, after all slides) ── */

function SummaryPage({ payload }: { payload: ReadoutPayload }) {
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
    <div className="flex flex-col gap-5 px-4 py-8">
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

"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import DeckChunkModal, {
  type LockOutcome,
} from "@/components/willab/DeckChunkModal";
import DeckLockMark from "@/components/willab/DeckLockMark";
import { RichText } from "@/components/willab/RichText";
import {
  buildDeckChunks,
  groupChunksBySlide,
  type DeckChunk,
} from "@/lib/willab/deckChunks";
import type { Part } from "@/lib/willab/documentParts";
import type { DocumentSuggestion } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  TranscriptReviewDeck — the ideal text as a slide deck (founder 2026-08-11, */
/*  Lovable spec §4). One slide per viewport, scroll-snap, a dots rail, and    */
/*  every chunk wearing exactly one always-clickable lock.                     */
/*                                                                            */
/*  The deck is presentation + routing only. The HOST owns the fetch and the   */
/*  three decide lanes + the lock PUT — passed in as callbacks — so this       */
/*  surface cannot fork the serve/decide/lock contract it renders.             */
/*                                                                            */
/*  Visual grammar (the founder's rules, all four):                            */
/*    - underline appears ONLY on a waiting chunk — it is the one signal       */
/*      that feedback is outstanding;                                          */
/*    - an accepted-not-locked chunk carries the amber wash, no underline;     */
/*    - locked text is plain — a matured slide reads clean;                    */
/*    - no stars anywhere.                                                     */
/*                                                                            */
/*  AC-9: the footer counts work (waiting · slide · words), never quality.     */
/* -------------------------------------------------------------------------- */

const CHUNK_TEXT_CLS: Record<DeckChunk["status"], string> = {
  clean: "",
  waiting:
    "underline decoration-pending decoration-2 underline-offset-4 bg-pending/[0.08] rounded-sm",
  accepted: "bg-pending/[0.14] rounded-sm",
  locked: "",
};

export default function TranscriptReviewDeck({
  title = "",
  statusChip = null,
  chrome = "full",
  document: doc,
  parts,
  suggestions,
  pieceSlideIndexes,
  slideTitles,
  onAccept,
  onKeepMine,
  onLockPart,
  onClose,
}: {
  title?: string;
  /** Optional right-of-title chip (e.g. "Verified"). Qualitative only. */
  statusChip?: string | null;
  /** "full" renders the deck's own header (title · copy · close — Lovable
   *  §4). "stage" renders stage + dots + footer only, for a host that keeps
   *  its own header (the notebook overlay does — its Present/edit/timeline
   *  entries are load-bearing and live outside the deck's scope). */
  chrome?: "full" | "stage";
  document: string;
  parts: readonly Part[] | null;
  suggestions: readonly DocumentSuggestion[];
  pieceSlideIndexes: readonly (number | null)[] | null;
  /** Slide titles by slide index, when the host knows them. Absent → the
   *  kicker says "Slide N" and no title line renders — never a guess. */
  slideTitles?: readonly (string | null)[];
  onAccept: (s: DocumentSuggestion) => Promise<boolean>;
  onKeepMine: (s: DocumentSuggestion) => Promise<boolean>;
  /** Commit `newText` for the part (when changed) and lock it. */
  onLockPart: (part: Part, newText: string) => Promise<LockOutcome>;
  onClose?: () => void;
}) {
  const chunks = useMemo(
    () => buildDeckChunks(doc, parts, suggestions),
    [doc, parts, suggestions]
  );
  const groups = useMemo(
    () => groupChunksBySlide(chunks, pieceSlideIndexes),
    [chunks, pieceSlideIndexes]
  );

  // The open modal is addressed by PART ID, not by object: an accept
  // reassembles the document underneath the modal, and re-deriving the chunk
  // on every render is what carries the fresh words in.
  const [openPartId, setOpenPartId] = useState<string | null>(null);
  const openChunk = openPartId
    ? (chunks.find((c) => c.part.id === openPartId) ?? null)
    : null;
  const openSuggestion =
    openChunk && openChunk.pendingIds.length > 0
      ? (suggestions.find((s) => s.id === openChunk.pendingIds[0]) ?? null)
      : null;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [atSlide, setAtSlide] = useState(0);
  const [copied, setCopied] = useState(false);

  const waiting = chunks.filter((c) => c.status === "waiting").length;
  const words = doc.trim() ? doc.trim().split(/\s+/).length : 0;

  const kickerFor = (slideIndex: number | null, ord: number): string =>
    slideIndex === null ? "Your talk" : `Slide ${slideIndex + 1}`;
  const titleFor = (slideIndex: number | null): string | null =>
    slideIndex === null ? null : (slideTitles?.[slideIndex] ?? null);

  async function copyDeck() {
    // The whole deck: kicker/title + paragraphs, slides separated by a rule
    // (Lovable §4's copy tool).
    const textOut = groups
      .map((g, i) => {
        const head = [kickerFor(g.slideIndex, i), titleFor(g.slideIndex)]
          .filter(Boolean)
          .join(" — ");
        const body = g.chunks.map((c) => c.part.text).join("\n\n");
        return `${head}\n\n${body}`;
      })
      .join("\n\n———\n\n");
    try {
      await navigator.clipboard.writeText(textOut);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused (permissions) — the button simply doesn't confirm.
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      {/* Header — title, status chip, copy and close ONLY (Lovable §4). */}
      {chrome === "full" ? (
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">
            {title}
          </span>
          {statusChip ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {statusChip}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void copyDeck()}
            aria-label="Copy the whole text"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
          </button>
          {onClose ? (
            <OverlayCloseButton onClick={onClose} ariaLabel="Close the deck" />
          ) : null}
        </span>
      </div>
      ) : null}

      {/* Stage — one slide per viewport, snap-scrolled, dots pinned right. */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.clientHeight > 0) {
              setAtSlide(
                Math.max(
                  0,
                  Math.min(
                    groups.length - 1,
                    Math.round(el.scrollTop / el.clientHeight)
                  )
                )
              );
            }
          }}
          className="scrollbar-none h-full snap-y snap-mandatory overflow-y-auto scroll-smooth"
        >
          {groups.map((g, gi) => (
            <section
              key={g.slideIndex ?? `untitled-${gi}`}
              className="flex h-full snap-start snap-always flex-col justify-center gap-4 border-b border-dashed border-border px-6 py-8 sm:px-10"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {kickerFor(g.slideIndex, gi)}
              </p>
              {titleFor(g.slideIndex) ? (
                <h2 className="font-heading text-[clamp(1.5rem,4vw,2.1rem)] leading-tight tracking-[-0.035em] text-foreground">
                  {titleFor(g.slideIndex)}
                </h2>
              ) : null}
              <div className="flex flex-col gap-4">
                {g.chunks.map((c) => (
                  <p
                    key={c.part.id}
                    className="text-[clamp(1.02rem,2.5vw,1.22rem)] leading-[1.8] text-foreground"
                  >
                    <span className={CHUNK_TEXT_CLS[c.status]}>
                      <RichText text={c.part.text} />
                    </span>
                    <DeckLockMark
                      status={c.status}
                      onClick={() => setOpenPartId(c.part.id)}
                    />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Dots rail — one per slide, active dot stretched. */}
        {groups.length > 1 ? (
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2">
            {groups.map((g, i) => (
              <button
                key={g.slideIndex ?? `dot-${i}`}
                type="button"
                aria-label={`Go to ${kickerFor(g.slideIndex, i)}`}
                aria-current={atSlide === i ? "true" : undefined}
                onClick={() => {
                  const el = scrollerRef.current;
                  if (el) el.scrollTo({ top: i * el.clientHeight });
                }}
                className={`rounded-full transition-all ${
                  atSlide === i
                    ? "h-[1.1rem] w-2 bg-foreground"
                    : "h-2 w-2 bg-muted-foreground/40 hover:bg-muted-foreground"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Footer — work counts only, never quality (AC-9). */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        <span>
          {waiting === 0
            ? "Nothing waiting"
            : `${waiting} to review`}
        </span>
        <span className="tabular-nums">
          {groups.length > 1 ? `Slide ${atSlide + 1} of ${groups.length} · ` : ""}
          {words} words
        </span>
      </div>

      {openChunk ? (
        <DeckChunkModal
          key={openChunk.part.id}
          chunk={openChunk}
          suggestion={openSuggestion}
          onAccept={onAccept}
          onKeepMine={onKeepMine}
          onLockIn={(text: string): Promise<LockOutcome> =>
            onLockPart(openChunk.part, text)
          }
          onClose={() => setOpenPartId(null)}
        />
      ) : null}
    </div>
  );
}

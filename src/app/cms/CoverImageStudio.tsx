"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import {
  adminDeleteCoverImage,
  adminGenerateCoverImage,
  adminListCoverImages,
  adminSelectCoverImage,
  type AdminJournalPost,
  type CoverImage,
  type CoverImageFlag,
} from "@/services/api/journalAdmin";

/* -------------------------------------------------------------------------- */
/*  Cover image studio — inside the Cover media block of the CMS editor        */
/*                                                                            */
/*  A second way to fill the SAME `cover_image_url` the manual upload fills.   */
/*  The model reads the post, writes a brief, draws it, and the file lands in  */
/*  the same R2 bucket. Upload is untouched and stays the primary path for a   */
/*  cover the founder already has.                                            */
/*                                                                            */
/*  Every attempt is kept server-side, and that history IS the undo: a click   */
/*  on an earlier thumbnail puts it back on the post. That is the whole        */
/*  reason Regenerate can be offered without a confirm dialog.                 */
/*                                                                            */
/*  CMS-ONLY. Nothing under /blog reads these candidates — the public site     */
/*  sees only cover_image_url / cover_alt on the post itself.                  */
/* -------------------------------------------------------------------------- */

const FLAG_COPY: Record<CoverImageFlag, string> = {
  construct: "uses retired score vocabulary, reword the alt text before publishing",
};

const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background transition hover:bg-foreground/90 disabled:opacity-40";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40";
const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition focus:border-foreground/30 focus:outline-none";

/** The wait is 10-30s. A bare spinner for that long reads as broken, so the
 *  label changes once: it is a timed story, not real progress, and that is
 *  enough to make the wait legible. */
const DRAW_STAGES: ReadonlyArray<{ at: number; label: string }> = [
  { at: 0, label: "Writing the brief…" },
  { at: 3000, label: "Drawing…" },
];

function useDrawStatus(active: boolean): string {
  const [label, setLabel] = useState(DRAW_STAGES[0].label);
  useEffect(() => {
    if (!active) {
      setLabel(DRAW_STAGES[0].label);
      return;
    }
    const timers = DRAW_STAGES.filter((s) => s.at > 0).map((s) =>
      window.setTimeout(() => setLabel(s.label), s.at)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active]);
  return label;
}

/** A refusal from the safety system fails identically on a retry of the same
 *  brief, and a dead kill switch is not going to come back this minute. Only
 *  a transient draw failure earns a retry button. */
function isRetryable(code: string | undefined, status: number): boolean {
  if (code === "IMAGE_REJECTED" || code === "INVALID_INPUT") return false;
  if (code === "DISABLED") return false;
  if (status === 401) return false;
  return true;
}

export default function CoverImageStudio({
  password,
  postId,
  postTitle,
  postBody,
  currentImageUrl,
  onCoverChanged,
}: {
  password: string;
  /** null while the post is unsaved — there is nothing to draw against. */
  postId: string | null;
  postTitle: string;
  postBody: string;
  /** The post's live cover, so the strip can ring the attempt that is on it. */
  currentImageUrl: string | null;
  /** The server echo after a draw or a select. The parent adopts ONLY the
   *  cover fields from it, so unsaved title/body edits are never clobbered. */
  onCoverChanged: (post: AdminJournalPost) => void;
}) {
  const [items, setItems] = useState<CoverImage[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; retryable: boolean } | null>(
    null
  );
  /** The image drew and stored but could not be written onto the post. It is
   *  real and paid for, so it stays in the strip with a warning. */
  const [attachWarning, setAttachWarning] = useState<string | null>(null);
  const [fromFallbackBrief, setFromFallbackBrief] = useState(false);

  const drawing = busy === "generate";
  const drawStatus = useDrawStatus(drawing);

  // Load the post's existing attempts. The strip is server-held, so it must
  // survive a CMS reload — this is what makes that true.
  useEffect(() => {
    if (!postId) {
      setItems([]);
      return;
    }
    let live = true;
    void adminListCoverImages(password, postId).then((r) => {
      if (!live) return;
      // A failure here is not worth an error banner: the founder did not ask
      // for the strip, they opened a post. The draw button still works.
      if (r.ok) setItems(r.data);
    });
    return () => {
      live = false;
    };
  }, [password, postId]);

  // Anything post-scoped is meaningless once a different post is open.
  useEffect(() => {
    setNotes("");
    setError(null);
    setAttachWarning(null);
    setFromFallbackBrief(false);
  }, [postId]);

  const selected =
    items.find((i) => currentImageUrl && i.imageUrl === currentImageUrl) ?? null;

  const hasText = postTitle.trim().length > 0 || postBody.trim().length > 0;
  const canDraw = !!postId && hasText;
  const disabledReason = !postId
    ? "Save the post before drawing its cover."
    : !hasText
      ? "Write a title or a body first, the cover is drawn from what the post says."
      : undefined;

  const draw = useCallback(async () => {
    if (!postId || busy) return;
    setBusy("generate");
    setError(null);
    setAttachWarning(null);
    const r = await adminGenerateCoverImage(password, {
      postId,
      // Empty is meaningful: the backend deliberately draws a DIFFERENT scene
      // on a bare Regenerate. Never substitute a hidden "make it different".
      notes,
      // Refine what is on screen. Without this, selecting an older attempt and
      // then regenerating would silently refine the newest one instead, and
      // "darker" would not mean the cover the founder is looking at.
      parentId: selected?.id,
    });
    setBusy(null);
    if (!r.ok) {
      setError({
        text: r.message,
        retryable: isRetryable(r.code, r.status),
      });
      return;
    }
    // The strip comes back whole on every draw — re-render from it rather than
    // firing a second list call.
    setItems(r.data.items);
    setFromFallbackBrief(r.data.briefSource === "fallback");
    if (r.data.attachError) setAttachWarning(r.data.attachError);
    if (r.data.post) onCoverChanged(r.data.post);
    // The note deliberately STAYS in the box: steers stack ("darker" → "darker,
    // and no hands"), and each one applies to the previous brief.
  }, [busy, notes, onCoverChanged, password, postId, selected]);

  async function select(item: CoverImage) {
    if (busy) return;
    setBusy(`sel:${item.id}`);
    setError(null);
    const r = await adminSelectCoverImage(password, item.id);
    setBusy(null);
    if (!r.ok) {
      setError({ text: r.message, retryable: isRetryable(r.code, r.status) });
      return;
    }
    // Selecting is also the retry for a failed attach, so a success clears it.
    setAttachWarning(null);
    if (r.data.post) onCoverChanged(r.data.post);
  }

  async function remove(item: CoverImage) {
    if (busy) return;
    setBusy(`del:${item.id}`);
    setError(null);
    const r = await adminDeleteCoverImage(password, item.id);
    setBusy(null);
    if (!r.ok) {
      setError({ text: r.message, retryable: isRetryable(r.code, r.status) });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const flagged = items.filter((i) => i.flags.length > 0);
  // The brief behind what is on the post, else the newest attempt.
  const briefOf = selected ?? items[0] ?? null;

  return (
    <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Draw a cover
        </span>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={1}
        placeholder="darker, no hands, less literal"
        aria-label="Notes to steer the next attempt"
        className={`${INPUT_CLS} resize-y text-[13px]`}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void draw()}
          disabled={!canDraw || busy !== null}
          title={disabledReason}
          className={BTN_PRIMARY}
        >
          {drawing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : null}
          {drawing
            ? drawStatus
            : items.length > 0
              ? "Regenerate"
              : "Draw a cover"}
        </button>
        {!drawing && items.length > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {notes.trim()
              ? "Applies your note to the cover on screen."
              : "No note draws a different scene."}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg bg-destructive/10 px-2.5 py-2">
          <p className="text-[12px] text-destructive">{error.text}</p>
          {error.retryable ? (
            <button
              type="button"
              onClick={() => void draw()}
              disabled={busy !== null}
              className={`${BTN_GHOST} mt-2`}
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {/* The image exists and was paid for; it is in the strip. Say what went
          wrong and point at the fix, which is a click on the thumbnail. */}
      {attachWarning ? (
        <p className="mt-3 rounded-lg bg-amber-100 px-2.5 py-2 text-[11px] text-amber-800">
          {attachWarning} The image is in the strip below, click it to put it on
          the post.
        </p>
      ) : null}

      {/* Explains an oddly literal cover without the founder having to guess. */}
      {fromFallbackBrief ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Drew from a basic brief, the brief writer was unavailable.
        </p>
      ) : null}

      {/* Flags warn, they never withhold the attempt. */}
      {flagged.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1">
          {Array.from(new Set(flagged.flatMap((i) => i.flags))).map((f) => (
            <li
              key={f}
              className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] text-amber-800"
            >
              {FLAG_COPY[f]}
            </li>
          ))}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {items.map((item) => {
              const isOn = !!currentImageUrl && item.imageUrl === currentImageUrl;
              return (
                <div key={item.id} className="group relative shrink-0">
                  <button
                    type="button"
                    onClick={() => void select(item)}
                    disabled={busy !== null || isOn}
                    title={item.notes || item.prompt}
                    aria-pressed={isOn}
                    className={`block h-16 w-20 overflow-hidden rounded-lg border-2 transition disabled:cursor-default ${
                      isOn
                        ? "border-foreground"
                        : "border-transparent hover:border-foreground/40"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.altText || "Generated cover attempt"}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  {busy === `sel:${item.id}` ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                      <Loader2
                        className="h-4 w-4 animate-spin text-foreground"
                        aria-hidden
                      />
                    </span>
                  ) : null}
                  {item.flags.length > 0 ? (
                    <span
                      className="absolute left-1 top-1 h-2 w-2 rounded-full bg-amber-500 ring-1 ring-background"
                      title={item.flags.map((f) => FLAG_COPY[f]).join(" · ")}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    disabled={busy !== null}
                    aria-label="Remove this attempt"
                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-foreground text-background group-hover:flex disabled:opacity-40"
                  >
                    <X className="h-2.5 w-2.5" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>

          {/* The fastest way to understand why an image came out wrong, and
              what makes the notes box legible. */}
          {briefOf && briefOf.prompt ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                The brief
              </summary>
              <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                {briefOf.prompt}
              </p>
              {briefOf.revisedPrompt ? (
                <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                  <span className="uppercase tracking-wider">What it drew: </span>
                  {briefOf.revisedPrompt}
                </p>
              ) : null}
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

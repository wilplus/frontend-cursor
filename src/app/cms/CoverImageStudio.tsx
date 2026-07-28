"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import {
  adminDeleteCoverImage,
  adminGenerateCoverImage,
  adminListCoverImages,
  adminSelectCoverImage,
  type AdminJournalPost,
  type AdminResult,
  type CoverImage,
  type CoverImageFlag,
  type GenerateCoverResult,
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

/** The wait is 23s for a first draw and 98s for a steered one, measured against
 *  the live API. A bare spinner over that reads as broken, so the label keeps
 *  moving: it is a timed story, not real progress, and that is what keeps a
 *  90-second draw from looking like a hang. */
const DRAW_STAGES: ReadonlyArray<{ at: number; label: string }> = [
  { at: 0, label: "Writing the brief…" },
  { at: 3_000, label: "Drawing…" },
  { at: 35_000, label: "Still drawing…" },
  { at: 75_000, label: "Taking a while, hold on…" },
];

/* -- surviving a capped request ---------------------------------------------
 *
 * Vercel caps how long one request may run, and a steered regenerate measured
 * 98s. On a plan we cannot raise, the connection therefore dies while the
 * backend is still drawing — and the backend does not care: it finishes the
 * image, stores it, inserts the attempt and attaches the cover, all
 * server-side, with nobody holding the response.
 *
 * So the draw does not depend on the response arriving. It also watches the
 * strip, and takes the new attempt whichever way it turns up first. That is
 * what makes this work without paying for a longer request — and it is why a
 * timed-out draw must never be reported as a failure: the image is real. */
const POLL_AFTER_MS = 20_000; // nothing can have landed before the fastest draw
const POLL_EVERY_MS = 6_000;
const GIVE_UP_MS = 240_000; // ~2.5x the slowest measured draw

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A dropped connection, not a verdict. The backend may still be drawing, so
 *  these must NOT end the draw — they only mean the answer will never come. */
function isTransportFailure(code: string | undefined, status: number): boolean {
  return (
    code === "UPSTREAM_TIMEOUT" ||
    code === "PROXY_ERROR" ||
    status === 0 ||
    status === 502 ||
    status === 504
  );
}

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

/** Milliseconds since the draw started, ticking. The ONE honest number on the
 *  progress panel — everything else there is an estimate. */
function useElapsedMs(active: boolean): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) {
      setMs(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => setMs(Date.now() - started), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return ms;
}

/** How full the bar is. There is no real progress to report — the backend does
 *  not stream one — so this is a decay curve against the measured draws (23s
 *  fast, 98s steered) that APPROACHES but never reaches full. It exists to show
 *  the thing is alive and roughly how far in it is; the honest elapsed counter
 *  sits next to it, and the bar is hidden from assistive tech so no invented
 *  percentage is ever announced. */
const PROGRESS_TAU_MS = 45_000;
const PROGRESS_CEILING = 92;

function progressPct(ms: number): number {
  return PROGRESS_CEILING * (1 - Math.exp(-ms / PROGRESS_TAU_MS));
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
  const elapsedMs = useElapsedMs(drawing);

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

    // What the strip held BEFORE the draw. Anything new that appears while we
    // wait is the image this draw produced.
    const before = new Set(items.map((i) => i.id));
    const startedAt = Date.now();

    // Fired, not awaited: the outcome of the draw must not hinge on this
    // promise, because a capped request can kill it while the image is still
    // being made. A plain object holder rather than a `let`, so the value read
    // inside the loop is not narrowed to its initial null.
    const pending: { result: AdminResult<GenerateCoverResult> | null } = {
      result: null,
    };
    void adminGenerateCoverImage(password, {
      postId,
      // Empty is meaningful: the backend deliberately draws a DIFFERENT scene
      // on a bare Regenerate. Never substitute a hidden "make it different".
      notes,
      // Refine what is on screen. Without this, selecting an older attempt and
      // then regenerating would silently refine the newest one instead, and
      // "darker" would not mean the cover the founder is looking at.
      parentId: selected?.id,
    }).then(
      (r) => {
        pending.result = r;
      },
      () => {
        pending.result = {
          ok: false,
          status: 0,
          message: "Network error. Try again.",
        };
      }
    );

    const finish = () => setBusy(null);

    while (Date.now() - startedAt < GIVE_UP_MS) {
      const r = pending.result;
      if (r) {
        if (r.ok) {
          // The strip comes back whole on every draw — re-render from it
          // rather than firing a second list call.
          setItems(r.data.items);
          setFromFallbackBrief(r.data.briefSource === "fallback");
          if (r.data.attachError) setAttachWarning(r.data.attachError);
          if (r.data.post) onCoverChanged(r.data.post);
          finish();
          return;
        }
        // A refusal, a bad request or a dead switch is a real answer, and no
        // amount of watching the strip will improve it.
        if (!isTransportFailure(r.code, r.status)) {
          setError({ text: r.message, retryable: isRetryable(r.code, r.status) });
          finish();
          return;
        }
        // Otherwise the connection died, not the draw. Keep watching.
      }

      if (Date.now() - startedAt > POLL_AFTER_MS) {
        const list = await adminListCoverImages(password, postId);
        if (list.ok) {
          const fresh = list.data.find((i) => !before.has(i.id));
          if (fresh) {
            setItems(list.data);
            // The backend already put this on the post; we simply never saw
            // the echo. Selecting is idempotent — it re-attaches the same
            // image and hands back the post row we are missing.
            const attach = await adminSelectCoverImage(password, fresh.id);
            if (attach.ok && attach.data.post) onCoverChanged(attach.data.post);
            finish();
            return;
          }
        }
      }

      await sleep(POLL_EVERY_MS);
    }

    setError({
      text: "The drawing never finished. If it turns up, it will be in the strip below.",
      retryable: true,
    });
    finish();
    // The note deliberately STAYS in the box: steers stack ("darker" → "darker,
    // and no hands"), and each one applies to the previous brief.
  }, [busy, items, notes, onCoverChanged, password, postId, selected]);

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
        rows={4}
        placeholder="darker, no hands, less literal"
        aria-label="Notes to steer the next attempt"
        className={`${INPUT_CLS} resize-y text-[13px] leading-relaxed`}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void draw()}
          disabled={!canDraw || busy !== null}
          className={BTN_PRIMARY}
        >
          {drawing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : null}
          {/* Static while drawing: the moving stage label lives in the panel
              below, and a button whose text keeps changing length jumps. */}
          {drawing ? "Drawing…" : items.length > 0 ? "Regenerate" : "Draw a cover"}
        </button>
        {!drawing && items.length > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {notes.trim()
              ? "Applies your note to the cover on screen."
              : "No note draws a different scene."}
          </span>
        ) : null}
      </div>

      {/* WHY the button is dead, on screen. This used to be a `title` tooltip
          only — which browsers largely refuse to show on a disabled control, so
          the button read as simply broken. */}
      {!drawing && disabledReason ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{disabledReason}</p>
      ) : null}

      {/* The draw runs 23-98s. Without something visibly alive for that long it
          reads as a hang, or as never having started at all. */}
      {drawing ? (
        <div className="mt-3 rounded-xl border border-border bg-background px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[12px] text-foreground"
              aria-live="polite"
              role="status"
            >
              {drawStatus}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.floor(elapsedMs / 1000)}s
            </span>
          </div>
          <div
            className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
              style={{ width: `${progressPct(elapsedMs)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            You can leave this open, the cover lands on the post by itself.
          </p>
        </div>
      ) : null}

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

      {items.length > 0 || drawing ? (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {/* The slot the new attempt will drop into, at the head of the
                strip where it will actually appear. On a FIRST draw this is
                the only thing on screen that shows the request went out. */}
            {drawing ? (
              <div
                className="flex h-16 w-20 shrink-0 animate-pulse items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted"
                aria-hidden
              >
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  aria-hidden
                />
              </div>
            ) : null}
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

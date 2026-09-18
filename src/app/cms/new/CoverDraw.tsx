"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  adminGenerateCoverImage,
  adminListCoverImages,
  adminSelectCoverImage,
  type AdminResult,
  type CoverImage,
  type GenerateCoverResult,
} from "@/services/api/journalAdmin";
import { LANE_INPUT } from "./LaneShell";

/* -------------------------------------------------------------------------- */
/*  Draw the cover from a description — the lane's cover step                   */
/*                                                                            */
/*  The SAME generator the two-column editor's CoverImageStudio uses, reduced  */
/*  to the one thing a lane step may ask: what should the cover be. The author */
/*  types it, the backend briefs and draws it, and the image lands on the post */
/*  as its cover and its alt text without leaving the screen.                 */
/*                                                                            */
/*  Two deliberate differences from the studio:                               */
/*                                                                            */
/*  1. `fresh: true`. The studio's box is a STEER on the picture already on    */
/*     screen ("darker, no hands"). This box says what the cover IS, so every  */
/*     draw briefs from the essay plus these words. Without it, a second       */
/*     description arrives as the previous brief with an edit applied.        */
/*  2. No attempt strip. A lane screen asks one thing; the history is server-  */
/*     held and the full strip — with every earlier attempt and one-click undo */
/*     — is on the post in the editor the moment the lane finishes.           */
/*                                                                            */
/*  CMS-ONLY. Nothing public reads these candidates.                          */
/* -------------------------------------------------------------------------- */

/** The backend truncates at 500 (`_MAX_NOTES_CHARS`). Cap here too, so the
 *  author never types a sentence that is silently cut server-side. */
const MAX_NOTES = 500;

/** Measured against the live API (see CoverImageStudio): ~23s for a first
 *  draw. A bare spinner over that reads as broken, so the label keeps moving.
 *  It is a timed story, not real progress. */
const DRAW_STAGES: ReadonlyArray<{ at: number; label: string }> = [
  { at: 0, label: "Writing the brief…" },
  { at: 3_000, label: "Drawing…" },
  { at: 35_000, label: "Still drawing…" },
  { at: 75_000, label: "Taking a while, hold on…" },
];

/* -- surviving a capped request ----------------------------------------------
 * Vercel caps how long one request may run. When it dies, the backend does not
 * care: it finishes the image, stores it, inserts the attempt and attaches it
 * to the post, with nobody holding the response. So the draw does not depend on
 * the response arriving — it also watches the post's attempts and takes the new
 * one whichever way it turns up first. A timed-out draw is NEVER reported as a
 * failure: the image is real and it is paid for. */
const POLL_AFTER_MS = 20_000;
const POLL_EVERY_MS = 6_000;
const GIVE_UP_MS = 240_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A dropped connection, not a verdict. These must not end the draw. */
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
      window.setTimeout(() => setLabel(s.label), s.at),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active]);
  return label;
}

export type EnsurePost = () => Promise<{ id: string | null; message: string | null }>;

export function CoverDraw({
  password,
  ensurePost,
  onDrawn,
  onBusyChange,
}: {
  password: string;
  /** Saves the lane draft as an unpublished post if it is not saved yet, and
   *  hands back its id. The generator briefs from a POST, not from a draft in
   *  sessionStorage. */
  ensurePost: EnsurePost;
  /** The drawn cover and the alt text the model wrote for it. */
  onDrawn: (imageUrl: string, altText: string) => void;
  /** The step's CTA is disabled while a draw runs: moving on mid-draw would
   *  leave the founder on another screen when the cover lands. */
  onBusyChange: (busy: boolean) => void;
}) {
  const [notes, setNotes] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [drew, setDrew] = useState(false);
  const status = useDrawStatus(drawing);

  // A draw outlives the step when the author backs out mid-wait. Nothing is
  // lost server-side; this only stops the writes into an unmounted tree.
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const draw = useCallback(async () => {
    const description = notes.trim();
    if (!description || drawing) return;

    setDrawing(true);
    onBusyChange(true);
    setError(null);
    setFlagged(false);

    const stop = () => {
      if (!live.current) return;
      setDrawing(false);
      onBusyChange(false);
    };

    // The generator draws for a post. The lane has not written one yet, so the
    // first draw does — as a DRAFT, never published.
    const saved = await ensurePost();
    if (!saved.id) {
      stop();
      if (live.current) {
        setError(saved.message ?? "Could not save the post before drawing.");
      }
      return;
    }
    const postId = saved.id;

    // What this post already had. Anything new that appears while we wait is
    // what this draw produced.
    const listed = await adminListCoverImages(password, postId);
    const before = new Set<string>(
      (listed.ok ? listed.data : []).map((i: CoverImage) => i.id),
    );
    const startedAt = Date.now();

    // Fired, not awaited: the outcome must not hinge on this promise, because
    // a capped request can kill it while the image is still being made.
    const pending: { result: AdminResult<GenerateCoverResult> | null } = { result: null };
    void adminGenerateCoverImage(password, {
      postId,
      notes: description,
      // See the header: this box says what the cover IS.
      fresh: true,
    }).then(
      (r) => { pending.result = r; },
      () => { pending.result = { ok: false, status: 0, message: "Network error. Try again." }; },
    );

    const land = (image: CoverImage) => {
      if (!live.current) return;
      setFlagged(image.flags.includes("construct"));
      setDrew(true);
      onDrawn(image.imageUrl, image.altText);
    };

    while (Date.now() - startedAt < GIVE_UP_MS) {
      const r = pending.result;
      if (r) {
        if (r.ok) {
          if (r.data.image) land(r.data.image);
          if (r.data.attachError && live.current) {
            // The image drew and is stored — it is real. Say where it is
            // rather than letting the founder pay for another one.
            setError(
              "The cover drew but could not be saved onto the post. It is kept — open the post in the editor and pick it there.",
            );
          }
          stop();
          return;
        }
        // A refusal, a bad request or a dead switch is a real answer, and no
        // amount of watching the list will improve it.
        if (!isTransportFailure(r.code, r.status)) {
          if (live.current) setError(r.message);
          stop();
          return;
        }
        // Otherwise the connection died, not the draw. Keep watching.
      }

      if (Date.now() - startedAt > POLL_AFTER_MS) {
        const list = await adminListCoverImages(password, postId);
        if (list.ok) {
          const fresh = list.data.find((i: CoverImage) => !before.has(i.id));
          if (fresh) {
            land(fresh);
            // The backend already put this on the post; we simply never saw the
            // echo. Selecting is idempotent and re-attaches the same image.
            void adminSelectCoverImage(password, fresh.id);
            stop();
            return;
          }
        }
      }

      await sleep(POLL_EVERY_MS);
    }

    if (live.current) {
      setError(
        "The drawing never finished. If it turns up it will be on the post in the editor — look there before drawing another.",
      );
    }
    stop();
    // The description deliberately STAYS in the box: a refused or lost draw is
    // reworded, not retyped.
  }, [drawing, ensurePost, notes, onBusyChange, onDrawn, password]);

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Or describe the cover
        </span>
        {notes.length >= 380 ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {notes.length}/{MAX_NOTES}
          </span>
        ) : null}
      </div>

      <textarea
        rows={2}
        value={notes}
        maxLength={MAX_NOTES}
        onChange={(event) => setNotes(event.target.value)}
        // Read by LaneShell's Enter listener: this box handles its own Enter,
        // so the lane must not also step forward on the same press.
        data-owns-enter="true"
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return;
          if (event.nativeEvent.isComposing) return;
          event.preventDefault();
          void draw();
        }}
        placeholder="A woman alone on an empty stage at dawn, seen from the last row, warm low light"
        className={`${LANE_INPUT} resize-none leading-relaxed`}
        aria-label="Describe the cover"
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void draw()}
          disabled={drawing || !notes.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background transition disabled:opacity-30"
        >
          {drew ? "Draw again" : "Draw it"}
        </button>
        {drawing ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {status}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-[9px] bg-destructive/5 px-2.5 py-2 text-[12.5px] text-destructive">
          {error}
        </p>
      ) : null}

      {/* CONSTRUCT fence: the backend flags generated copy that reached for the
          retired score vocabulary. It is warned about, never swallowed. */}
      {flagged ? (
        <p className="rounded-[9px] bg-[#fdf4e3] px-2.5 py-2 text-[12.5px] text-[#7a5410]">
          The alt text uses retired score vocabulary — reword it below before publishing.
        </p>
      ) : null}
    </div>
  );
}

# BUILD PROMPT — draw the cover from a description, let Enter walk the lane, and stop refusing real video

Paste everything below the line into the coding agent. It is self-contained.

Clickable prototype of the finished screen (simulated draw, every outcome switchable):
<https://claude.ai/artifact/VWgzPDejdoSngqjkcDQVyd>

---

## TASK

Repo: **frontend-cursor** (Next.js App Router). Branch: **`claude/optimistic-goodall-nvn5x0`**.

Three changes to the CMS authoring lane (`/cms/new/…`):

1. **A drawing box.** A small text box on the cover step where the author describes the
   cover they want, one button draws it through the cover generator that already exists,
   and the result lands on the post as its cover, alt text included — without leaving the
   step.
2. **Enter is the CTA.** Enter moves the lane on from any step, exactly as tapping **Next**
   does. A long text box keeps its newline; the drawing box uses Enter to draw.
3. **A live bug: the lane refuses real video.** A 19-second phone clip uploaded on the
   exercise lane's first screen is rejected with *"That clip is too big. Keep it under a
   minute."* — a limit that does not apply to this upload path, reported as a length problem
   it does not have. Root cause and fix in §THE 19-SECOND CLIP.

**FRONTEND ONLY. No backend change, no new BFF route, no new endpoint.** Everything this
needs already exists and is already deployed — see §WHAT ALREADY EXISTS.

### The fourth ask — the close X — is already shipped, do not build it

The founder also asked for "a close X on the top right like everywhere else in the app."
**It is already there** and has been since the lane landed (PR #366): `LaneShell.tsx`, the
`aria-label="Close"` button in the chrome row, wired to `onClose` → `router.push("/cms")` in
`page.client.tsx`. It renders on **every** step of **both** lanes, including this one. Do not
add a second one. Your only job here is not to break it: after your change, the X must still
be the right-hand item in the chrome row on every step, and Enter must never trigger it.

Read `CLAUDE.md` before you start and emit the WILLAB DECISION FILTER block. **The verdict is
already settled — restate it, do not re-litigate it:**

```
VERDICT:  JUSTIFIED-SCAFFOLDING
CATEGORY: SCAFFOLDING
WHY:      /cms is the founder-only authoring surface, not an F1 read path. It passes as the
          named unblocker of the journal-publishing work already in flight: the cover
          generator shipped for the two-column editor only, so the one-action-per-screen
          lane (PR #366) is the one authoring path that cannot reach it, and the cover step
          is a dead end unless the founder already has a file. Enter-to-advance removes a
          mouse round-trip from every screen of a six-to-eight screen lane. The upload guard
          is a defect, not a feature: the exercise lane exists to accept a clip filmed on a
          phone ("sort of like adding tiktoks", founder 2026-09-16) and today it rejects
          every one of them, so that lane cannot be used for the thing it was built for.
FENCES:   clear. AC-9 untouched (no score, verdict or number is surfaced anywhere in this
          change). CONSTRUCT is actively defended: the generator's `construct` flag on
          generated alt text is SURFACED as a warning on this screen (see `CoverDraw.tsx`), it
          is never swallowed. LIVE LOOP untouched — this is the CMS, not record→Take.
          New copy is listed in §COPY for founder sign-off before merge.
LOCKS:    clear. L1 — Ideal Text is not involved; a journal cover is not a presentation
          document. L2/L3 — no Candidate, no Manager, no label provenance in this path.
REDIRECT: n/a
```

---

## THE SEVEN RULES THAT ARE NOT NEGOTIABLE

1. **NO BACKEND CHANGE.** `POST /v2/internal/journal/image/generate` already takes
   `{password, post_id, notes, parent_id, fresh, attach}` and already attaches the drawn
   image to the post by default. The BFF route at
   `src/app/api/v2/internal/journal/image/generate/route.ts` already carries
   `maxDuration = 180` and a 175s abort. Use them as they are.
2. **NEVER LOSE A DRAWN IMAGE.** A draw costs real money and the backend finishes it even
   when the request dies. A dropped connection (status `0`/`502`/`504`, or code
   `UPSTREAM_TIMEOUT`/`PROXY_ERROR`) is **not** a failed draw: keep watching the post's
   image list and take the new attempt when it appears. This is the whole reason
   `CoverImageStudio.tsx` has a poll loop; the same rule applies here. Never report a
   timeout as "it failed".
3. **NEVER SEND `attach: false`.** The point of the feature is that the cover lands on the
   post instantly. Leave `attach` absent — the backend defaults it to true.
4. **THE UPLOAD PATH STAYS EXACTLY AS IT IS.** "Choose a file" and "Or paste a URL" are
   untouched and remain the primary way in. The drawing box is an addition below them.
5. **IMAGE TAB ONLY.** The generator makes an image. Rendering it on the video or audio tab
   would let a founder attach an image URL to a post whose `media_url` is a video and break
   its cover contract. Render the box only when `draft.coverKind === "image"`.
6. **NEVER GUARD A DIRECT-TO-STORAGE UPLOAD WITH A BFF LIMIT.** `MAX_UPLOAD_BYTES`
   (4.3 MB, `useCoachVideoRecorder.ts`) exists because the COACH video BFF buffers the body
   through a Vercel function. The CMS presigns and PUTs straight to R2 and never touches
   that function. The only cap that applies here is the backend's per-kind one, which the
   presign response already carries as `max_bytes`. Enforce that number; never hardcode it.
7. **ENTER NEVER SUBMITS A TEXTAREA, AND NEVER EATS AN IME COMPOSITION.** A Polish, Japanese
   or Chinese author commits a composition with Enter. Advancing on that press eats the word
   *and* walks the screen. Guard on `isComposing` / `keyCode === 229`.

---

## WHAT ALREADY EXISTS (read these before writing anything)

| What | Where | Note |
|---|---|---|
| The lane chrome (back, progress, **close X**) | `src/app/cms/new/LaneShell.tsx` | You add `onEnter` here |
| The lane brain (steps, save, navigation) | `src/app/cms/new/page.client.tsx` | `savePost()` at ~line 128 is what `ensurePost` reuses |
| The cover step UI | `src/app/cms/new/LaneSteps.tsx` → `CoverStep` | You add one slot |
| Step definitions | `src/app/cms/new/laneDraft.ts` | Post lane: cover is **step 2 of 6**, right after Title |
| The cover generator client | `src/services/api/journalAdmin.ts` → `adminGenerateCoverImage`, `adminListCoverImages`, `adminSelectCoverImage` | Already typed, already mapped |
| The same feature, built for the other editor | `src/app/cms/CoverImageStudio.tsx` | **Read it.** Its stage labels, transport-failure test and poll loop are proven against the live API — reuse the reasoning |
| The BFF route | `src/app/api/v2/internal/journal/image/generate/route.ts` | 180s ceiling, 175s abort, honest timeout body |
| The backend | `backend-cursor` `routes/journal.py:638`, `services/journal_image.py` | `notes` is capped at 500 chars (`_MAX_NOTES_CHARS`) |
| The exercise lane's record/upload screen | `src/app/cms/new/RecordStep.tsx` → `put()` | Where the 19-second clip dies |
| The upload client | `src/services/api/journalAdmin.ts` → `adminPresign`, `uploadToStorage` | Presigned **direct-to-R2**. Its own comment: *"NEVER routed through the BFF"* |
| The presign | `backend-cursor` `routes/journal.py:383`, `services/journal_media.py` | Serves `max_bytes` **and** the exact `headers` to PUT with. Video cap **500 MB** by default (`JOURNAL_MAX_VIDEO_MB`), types `video/mp4`, `video/quicktime`, `video/webm` |
| The limit that does NOT apply here | `src/hooks/useCoachVideoRecorder.ts` → `MAX_UPLOAD_BYTES` | 4.3 MB, and it belongs to the **coach** video BFF |

### The one thing that makes this non-trivial

`adminGenerateCoverImage` needs a **`post_id`**, and the backend refuses a post with neither
title nor body (`routes/journal.py`: *"This post has no title or body yet — there is nothing
to draw from"*). In the lane, `draft.postId` is `null` until the author finishes — nothing has
been written yet.

So the first draw **saves the post as a draft first**, keeps the returned id in the lane draft,
and draws against it. The post lane asks for the title on step 1, so by the cover step there is
always a title to brief from. A second draw reuses the id.

Consequences to accept, deliberately:

- An author who starts a lane, draws a cover and then abandons it leaves an **unpublished
  draft post** in `/cms`. That is the same state the two-column editor leaves behind, it is
  visible, and it is deletable. It is the price of drawing before publishing.
- If the auto-slug collides with an existing post, the create returns 409. The post lane has
  no address field, so say what actually helps: change the title.

---

## MECHANISM — what one draw does

```
author types "a lit stage seen from the last row, nobody on it"
        │
        ├─ draft.postId == null ?  → savePost(draft, publish=false) → patch({postId})
        │                            (title + slug already exist; cover_kind is "image")
        │
        ├─ remember the post's current image ids (the "before" set)
        │
        ├─ adminGenerateCoverImage(password, { postId, notes: description, fresh: true })
        │      fresh:true → brief from the essay + THIS description.
        │      Without it the backend refines the PREVIOUS brief, and a new
        │      description arrives as "the last picture, with a stage added".
        │      That is right for the studio's steer box. It is wrong here:
        │      this box asks what the cover IS, not how to nudge the last one.
        │
        ├─ answer arrives  → image.imageUrl + image.altText → patch the draft
        │  request dies    → poll adminListCoverImages until an id outside "before"
        │                    appears → that is this draw → patch the draft
        │  400 refusal     → show the reason, no retry (the same words fail the same way)
        │
        └─ the backend has ALREADY written the cover onto the post (attach defaults true).
           The lane patches its own draft to match, so the later savePost sends the same URL.
```

---

## FILES, PART ONE — the drawing box and Enter

### 1. NEW — `src/app/cms/new/laneKeys.ts`

Pure. The decision is the part worth testing; a window listener is not.

```ts
/* -------------------------------------------------------------------------- */
/*  What Enter means inside a lane (founder 2026-09-18)                        */
/*                                                                            */
/*  A lane is six or eight screens asking for one thing each, and until now    */
/*  the only way past any of them was the mouse. Enter now does what the CTA   */
/*  does.                                                                     */
/*                                                                            */
/*  Kept pure and separate from LaneShell on purpose: every rule below is a    */
/*  case someone will hit on real hardware — an IME commit, a modifier, a      */
/*  focused button — and a rule you cannot unit-test is a rule that rots.      */
/* -------------------------------------------------------------------------- */

export interface EnterContext {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  /** True while an input method editor is mid-composition. */
  isComposing: boolean;
  /** Upper-case tag name of whatever has focus; "" when nothing does. */
  tagName: string;
  isContentEditable: boolean;
  /** The focused element handles Enter itself (the drawing box does). */
  ownsEnter: boolean;
}

/** True when this key press should move the lane on. */
export function enterAdvances(c: EnterContext): boolean {
  if (c.key !== "Enter" || c.altKey) return false;

  // A Polish, Japanese or Chinese author COMMITS a composition with Enter.
  // Advancing on that press eats the word and walks the screen at once.
  if (c.isComposing) return false;

  // The element asked for this key. Enter there means "draw", and the step
  // must not also move on underneath the request that just went out.
  if (c.ownsEnter) return false;

  // A focused button or link already fires on Enter natively. Advancing too
  // would do both things from one press — Skip AND Next, for instance.
  if (c.tagName === "BUTTON" || c.tagName === "A") return false;

  const modified = c.metaKey || c.ctrlKey;

  // A long text box keeps its newline: the author is writing a body, not
  // answering a question. The modifier is the deliberate way past it, and it
  // is the idiom the Lounge composer already uses (Lounge.tsx:1384).
  if (c.tagName === "TEXTAREA" || c.isContentEditable) return modified;

  if (c.shiftKey) return false;
  return true;
}
```

### 2. EDIT — `src/app/cms/new/LaneShell.tsx`

Add `onEnter` to the shell. **Nothing else in this file changes** — the back button, the
progress dashes and the close X stay exactly as they are.

```diff
 "use client";

-import type { ReactNode } from "react";
+import { useEffect, useRef, type ReactNode } from "react";
 import { ChevronLeft, X } from "lucide-react";
+import { enterAdvances } from "./laneKeys";
```

```diff
 export function LaneShell({
   step,
   total,
   dark,
   onBack,
   onClose,
+  onEnter,
   children,
   footer,
 }: {
   step: number;
   total: number;
   dark?: boolean;
   onBack: () => void;
   onClose: () => void;
+  /** Enter does what the CTA does. Omit it and Enter does nothing — which is
+   *  what the camera screen wants, since it deliberately has no CTA. */
+  onEnter?: () => void;
   children: ReactNode;
   footer: ReactNode;
 }) {
+  // Bound on WINDOW, not on the column. The founder walks a lane without ever
+  // clicking into a field on screens whose only control is a picker, so the
+  // press lands on <body> and a handler bound to the content never sees it.
+  // The ref keeps the listener bound once instead of on every parent render.
+  const enter = useRef(onEnter);
+  useEffect(() => {
+    enter.current = onEnter;
+  });
+  const enterEnabled = !!onEnter;
+  useEffect(() => {
+    if (!enterEnabled) return;
+    function onKeyDown(event: KeyboardEvent) {
+      const el = document.activeElement as HTMLElement | null;
+      const advance = enterAdvances({
+        key: event.key,
+        shiftKey: event.shiftKey,
+        altKey: event.altKey,
+        metaKey: event.metaKey,
+        ctrlKey: event.ctrlKey,
+        // keyCode 229 is Safari's IME press: it reports no isComposing.
+        isComposing: event.isComposing || event.keyCode === 229,
+        tagName: el?.tagName ?? "",
+        isContentEditable: el?.isContentEditable ?? false,
+        ownsEnter: el?.dataset?.ownsEnter === "true",
+      });
+      if (!advance) return;
+      event.preventDefault();
+      enter.current?.();
+    }
+    window.addEventListener("keydown", onKeyDown);
+    return () => window.removeEventListener("keydown", onKeyDown);
+  }, [enterEnabled]);
+
   return (
```

### 3. NEW — `src/app/cms/new/CoverDraw.tsx`

```tsx
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

      <p className="text-[12px] text-muted-foreground">
        Enter draws. Shift and Enter starts a new line.
      </p>

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
```

### 4. EDIT — `src/app/cms/new/LaneSteps.tsx`

One slot. The steps file stays dumb — it still knows nothing about navigation, saving or
which lane it is in.

```diff
 "use client";

+import type { ReactNode } from "react";
 import { Lock } from "lucide-react";
```

```diff
-export function CoverStep({ draft, patch, onUpload, busy }: {
-  draft: LaneDraft; patch: Patch; onUpload: (file: File) => void; busy: boolean;
-}) {
+export function CoverStep({ draft, patch, onUpload, busy, draw }: {
+  draft: LaneDraft; patch: Patch; onUpload: (file: File) => void; busy: boolean;
+  /** The drawing box. A slot rather than a prop bundle, so this file keeps
+   *  knowing nothing about the password or about saving. */
+  draw?: ReactNode;
+}) {
```

```diff
       <LaneField label="Or paste a URL">
```

…and immediately **above** that `LaneField`, after the preview/dropzone block:

```diff
+      {/* Image only: the generator makes an image, and attaching one to a
+          video post would break the cover its media_url belongs to. */}
+      {draft.coverKind === "image" ? draw : null}
       <LaneField label="Or paste a URL">
```

### 5. EDIT — `src/app/cms/new/page.client.tsx`

```diff
 import { LaneCta, LaneHeading, LaneQuiet, LaneShell } from "./LaneShell";
+import { CoverDraw } from "./CoverDraw";
 import { RecordStep } from "./RecordStep";
```

```diff
   const [uploading, setUploading] = useState(false);
+  const [drawing, setDrawing] = useState(false);
   const [said, setSaid] = useState<string | null>(null);
```

Add `ensurePost` next to `uploadCover` (it reuses `savePost`, which is already in this file):

```tsx
  /** The cover generator draws for a POST — it reads the title to write the
   *  brief and attaches the result server-side. The lane has written nothing
   *  yet, so the first draw saves the draft as an UNPUBLISHED post and keeps
   *  its id, which later steps then update rather than duplicate. */
  const ensurePost = useCallback(async () => {
    if (!draft) return { id: null as string | null, message: "Nothing to save yet." };
    if (draft.postId) return { id: draft.postId, message: null as string | null };
    const saved = await savePost(draft, false);
    if (saved.id) patch({ postId: saved.id });
    // The post lane has no address field, so "that slug is taken" is not
    // actionable as written. Say what the author can actually do.
    if (!saved.id && /slug|address/i.test(saved.message ?? "")) {
      return { id: null, message: "A post already lives at that address. Change the title, then draw again." };
    }
    return saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, patch]);
```

Wire the slot in the `cover` case of the `body` memo:

```diff
       case "cover":
-        return <CoverStep draft={draft} patch={patch} onUpload={(f) => void uploadCover(f)} busy={uploading} />;
+        return (
+          <CoverStep
+            draft={draft}
+            patch={patch}
+            onUpload={(f) => void uploadCover(f)}
+            busy={uploading}
+            draw={
+              <CoverDraw
+                password={password}
+                ensurePost={ensurePost}
+                onDrawn={(imageUrl, altText) =>
+                  patch({
+                    coverKind: "image",
+                    coverUrl: imageUrl,
+                    // The model writes alt text FOR the image it just drew, so
+                    // it replaces whatever described the previous one.
+                    ...(altText ? { coverAlt: altText } : {}),
+                  })
+                }
+                onBusyChange={setDrawing}
+              />
+            }
+          />
+        );
```

…and add `ensurePost` to that memo's dependency array (it already carries the
`react-hooks/exhaustive-deps` disable comment; keep the list honest anyway).

Finally, the shell: Enter, and the CTA held while a draw runs.

```diff
     <LaneShell
       step={step}
       total={steps.length}
       dark={dark}
       onBack={() => (step > 1 ? go(step - 1) : router.push("/cms/new"))}
       onClose={() => router.push("/cms")}
+      // The camera screen deliberately has no CTA, so Enter has nothing to do
+      // there. Everywhere else Enter is the CTA — including Publish on the
+      // last screen, which is what the button under the thumb does too.
+      onEnter={
+        dark || busy || uploading || drawing
+          ? undefined
+          : () => (last ? void finish(true) : next())
+      }
       footer={
         <>
           {dark ? null : (
             <LaneCta
               onClick={() => (last ? void finish(true) : next())}
-              disabled={busy || uploading}
+              disabled={busy || uploading || drawing}
               dark={dark}
             >
               {busy ? "Saving…" : last ? "Publish" : "Next"}
             </LaneCta>
           )}
```

---

## THE 19-SECOND CLIP — root cause

**Reported:** AirDropped a 19-second clip from an iPhone, picked it on
`/cms/new/exercise/1` (**Show the exercise** → ••• → **Upload a file**), got
*"That clip is too big. Keep it under a minute."*

**What is actually happening** — `RecordStep.tsx`, the first lines of `put()`:

```ts
if (file.size > MAX_UPLOAD_BYTES) {          // 4_300_000
  setError("That clip is too big. Keep it under a minute.");
  return;
}
```

Three separate things are wrong with those four lines.

1. **The limit belongs to a different pipeline.** `MAX_UPLOAD_BYTES` is exported by
   `useCoachVideoRecorder.ts`, and its own comment says why it is 4.3 MB: *"the binding
   limit is NOT the BE's storage ceiling — it's the coach-video BFF, which buffers the whole
   body via `req.formData()` on a Vercel serverless function whose request body caps at
   ~4.5 MB."* **This lane never touches that function.** It calls `adminPresign` and then
   `uploadToStorage`, which PUTs the bytes **straight to R2** — `journalAdmin.ts` states the
   rule in as many words: *"NEVER routed through the BFF: Vercel's ~4.5MB serverless body
   limit 413s real media."* The guard is a limit from a path this upload does not use.
2. **The real cap is served and thrown away.** The presign response carries
   `max_bytes` — `services/journal_media.py`, `_DEFAULT_MAX_MB = {"image": 10, "audio": 50,
   "video": 500}`, overridable per environment with `JOURNAL_MAX_VIDEO_MB`. The FE's
   `PresignResult` maps `upload_url`, `public_url` and `fields`, and **drops `max_bytes`**.
   So the one number that is true is discarded and a wrong one is hardcoded in its place.
   A 19-second phone clip is tens of MB. Against 500 MB it is nothing; against 4.3 MB it is
   refused. **Nothing else stops it** — R2 takes the bytes whatever their size, because the
   presign signs the key and the content type, not a length. So the cap cannot simply be
   deleted: it has to be replaced with the served one.
3. **The message blames the wrong thing.** Size and duration are different limits, and
   `MAX_DURATION_SEC = 60` applies only to the **in-app recorder**, which auto-stops. No
   duration limit exists for an uploaded file at all. So a 19-second clip was told to be
   shorter than a minute, which it already was — the founder cannot act on that sentence
   because it is not true.

**A fourth defect, found on the way in and fixed by the same change.** `presign_put` signs
`ContentType` and returns `headers: {"Content-Type": ct}` with the comment *"the PUT must
send it back verbatim or R2 rejects the request with SignatureDoesNotMatch."* The FE drops
`headers` too and PUTs `file.type || "application/octet-stream"` instead, while `RecordStep`
presigns `file.type || "video/webm"`. Two different fallbacks for the same file: any file
whose MIME type the OS did not set (drag-and-drop, some pickers) presigns one type and
uploads another, R2 refuses it, and the author is told *"The upload did not finish."* Send
the signed headers back verbatim, and derive the content type once.

---

## FILES, PART TWO — the upload fix

### 6. EDIT — `src/services/api/journalAdmin.ts`

Stop throwing away what the presign serves.

```diff
 export interface PresignResult {
   uploadUrl: string;
   publicUrl: string;
   /** Extra form fields for a POST-policy upload; absent = plain PUT. */
   fields: Record<string, string> | null;
+  /** Exactly the headers the PUT must carry. ContentType is part of the
+   *  signature, so anything else is a SignatureDoesNotMatch that surfaces as
+   *  "the upload did not finish". */
+  headers: Record<string, string> | null;
+  /** The backend's per-kind cap (JOURNAL_MAX_VIDEO_MB etc, 500 MB for video
+   *  by default). The presign does NOT enforce it — R2 takes whatever is
+   *  PUT — so the caller must, and must never hardcode a number instead. */
+  maxBytes: number | null;
 }
```

```diff
     (d): PresignResult | null => {
       const r = (d ?? {}) as Record<string, unknown>;
       const uploadUrl = typeof r.upload_url === "string" ? r.upload_url : "";
       const publicUrl = typeof r.public_url === "string" ? r.public_url : "";
       if (!uploadUrl || !publicUrl) return null;
       const fields =
         r.fields && typeof r.fields === "object"
           ? (r.fields as Record<string, string>)
           : null;
-      return { uploadUrl, publicUrl, fields };
+      const headers =
+        r.headers && typeof r.headers === "object"
+          ? (r.headers as Record<string, string>)
+          : null;
+      const maxBytes =
+        typeof r.max_bytes === "number" && r.max_bytes > 0 ? r.max_bytes : null;
+      return { uploadUrl, publicUrl, fields, headers, maxBytes };
     }
```

```diff
     const res = await fetch(presign.uploadUrl, {
       method: "PUT",
-      headers: { "Content-Type": file.type || "application/octet-stream" },
+      // The SIGNED headers, verbatim. Reconstructing them from the File is the
+      // silent killer: a picker that reports no MIME type makes the caller
+      // presign one type and PUT another, and R2 answers SignatureDoesNotMatch
+      // — which reached the author as "The upload did not finish."
+      headers: presign.headers ?? {
+        "Content-Type": file.type || "application/octet-stream",
+      },
       body: file,
     });
```

### 7. NEW — `src/app/cms/new/laneMediaUpload.ts`

Pure, and the same shape as the existing `audioUploadValidation.ts`: a function that returns
the message or `null`.

```ts
/* -------------------------------------------------------------------------- */
/*  What the CMS may upload, and what to say when it may not                   */
/*                                                                            */
/*  These files go STRAIGHT to R2 on a presigned PUT — they never transit the  */
/*  BFF, so Vercel's ~4.5 MB body limit is not the constraint here and a guard */
/*  borrowed from a BFF path (MAX_UPLOAD_BYTES, the coach recorder's) refuses  */
/*  ordinary phone video for no reason. The only real limits are the           */
/*  backend's: a per-kind MIME allowlist, and a per-kind size cap served with  */
/*  the presign itself (JOURNAL_MAX_VIDEO_MB and friends, 500 MB for video by  */
/*  default). The cap is served rather than hardcoded so the founder can move  */
/*  it without a deploy — so this file must never contain the number.          */
/*                                                                            */
/*  Mirrors services/journal_media.py `_ALLOWED`. If that list changes, this   */
/*  one changes with it; being out of date here costs a clear message, never   */
/*  a wrong upload, because the presign refuses anything outside its own list. */
/* -------------------------------------------------------------------------- */

export type MediaKind = "image" | "video" | "audio";

const ALLOWED: Record<MediaKind, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav"],
};

/** How the sentence names the thing, and what a person calls those formats. */
const NOUN: Record<MediaKind, string> = {
  image: "an image",
  video: "a video",
  audio: "audio",
};
const SPOKEN: Record<MediaKind, string> = {
  image: "JPEG, PNG, WebP, AVIF or GIF",
  video: "MP4, MOV or WebM",
  audio: "MP3, M4A, WAV, OGG or WebM",
};

/** Extension → MIME, for the pickers that set no type on the File. An
 *  AirDropped .mov arriving with an empty `type` is the case that bites. */
const BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", gif: "image/gif",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime",
  qt: "video/quicktime", webm: "video/webm",
  mp3: "audio/mpeg", m4a: "audio/mp4", weba: "audio/webm", ogg: "audio/ogg",
  wav: "audio/wav",
};

/** ONE content type for both the presign and the PUT. Two separately derived
 *  values is a signature mismatch waiting for the first file without a type. */
export function contentTypeFor(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? "";
}

/** A message when this file cannot be published as `kind`, else null. */
export function unsupportedMessage(contentType: string, kind: MediaKind): string | null {
  if (ALLOWED[kind].includes(contentType)) return null;
  return `That file is not ${NOUN[kind]} we can publish. Use ${SPOKEN[kind]}.`;
}

const mb = (bytes: number) => Math.max(1, Math.round(bytes / (1024 * 1024)));

/** A message when the file is past the cap the presign served, else null.
 *  `maxBytes` null (an older backend that serves no cap) means no check —
 *  never a guessed number. */
export function oversizeMessage(bytes: number, maxBytes: number | null): string | null {
  if (!maxBytes || bytes <= maxBytes) return null;
  return `That file is ${mb(bytes)} MB and the limit is ${mb(maxBytes)} MB.`;
}
```

### 8. EDIT — `src/app/cms/new/RecordStep.tsx`

```diff
-import {
-  MAX_UPLOAD_BYTES,
-  isCoachVideoRecordingSupported,
-  useCoachVideoRecorder,
-} from "@/hooks/useCoachVideoRecorder";
+import {
+  isCoachVideoRecordingSupported,
+  useCoachVideoRecorder,
+} from "@/hooks/useCoachVideoRecorder";
 import { adminPresign, uploadToStorage } from "@/services/api/journalAdmin";
+import {
+  contentTypeFor,
+  oversizeMessage,
+  unsupportedMessage,
+} from "./laneMediaUpload";
```

```diff
   async function put(file: File) {
-    if (file.size > MAX_UPLOAD_BYTES) {
-      setError("That clip is too big. Keep it under a minute.");
-      return;
-    }
+    // DELIBERATELY NOT MAX_UPLOAD_BYTES. That 4.3 MB ceiling is the COACH
+    // video BFF's — it buffers the body through a Vercel function. This lane
+    // presigns and PUTs straight to R2 and never touches it, so the cap here
+    // is the backend's (500 MB for video by default), served with the presign.
+    // The old guard refused every clip filmed on a phone and blamed its length.
+    const contentType = contentTypeFor(file);
+    const wrongType = unsupportedMessage(contentType, "video");
+    if (wrongType) {
+      setError(wrongType);
+      return;
+    }
     setUploading(true);
     setError(null);
     const presigned = await adminPresign(password, {
       filename: file.name,
-      contentType: file.type || "video/webm",
+      // The same value the PUT will send back: see uploadToStorage.
+      contentType,
       kind: "video",
     });
     if (!presigned.ok || !presigned.data) {
       setUploading(false);
       setError(presigned.ok ? "Could not prepare the upload." : presigned.message);
       return;
     }
+    // The only thing enforcing the cap: R2 would take the bytes regardless.
+    const tooBig = oversizeMessage(file.size, presigned.data.maxBytes);
+    if (tooBig) {
+      setUploading(false);
+      setError(tooBig);
+      return;
+    }
     const sentOk = await uploadToStorage(presigned.data, file);
```

Nothing else in this file changes. The in-app recorder keeps its 60-second auto-stop and its
bitrate ceiling — those are about **recording**, and they are why a recorded clip is ~3.5 MB.

### 9. EDIT — `src/app/cms/new/page.client.tsx` (`uploadCover`, the cover file picker)

Same bug class, opposite sign: the cover picker has **no** guard at all, so a 40 MB image is
uploaded past a 10 MB cap nobody checks.

```diff
   async function uploadCover(file: File) {
-    setUploading(true);
     const kind = draft?.coverKind ?? "image";
+    const contentType = contentTypeFor(file);
+    const wrongType = unsupportedMessage(contentType, kind);
+    if (wrongType) { setSaid(wrongType); return; }
+    setUploading(true);
     const presigned = await adminPresign(password, {
       filename: file.name,
-      contentType: file.type || "application/octet-stream",
+      contentType,
       kind: kind as JournalCoverKind,
     });
     if (!presigned.ok || !presigned.data) {
       setUploading(false);
       setSaid(presigned.ok ? "Could not prepare the upload." : presigned.message);
       return;
     }
+    const tooBig = oversizeMessage(file.size, presigned.data.maxBytes);
+    if (tooBig) { setUploading(false); setSaid(tooBig); return; }
     const ok = await uploadToStorage(presigned.data, file);
```

…with `import { contentTypeFor, oversizeMessage, unsupportedMessage } from "./laneMediaUpload";`
added at the top. `kind` is already `"image" | "video" | "audio"`, which is `MediaKind`.

### 10. OPTIONAL, same three lines — `src/app/cms/page.tsx` → `pickFile` (~line 515)

The two-column editor's cover picker has the identical gap (`file.type ||
"application/octet-stream"`, no size check). It is not what the founder hit, so it is fine to
leave for a follow-up — but if you take it, it is the exact same three edits as §9 and it
belongs in a **separate commit**, not mixed into the lane work.

---

## COPY — every new user-visible string (founder sign-off before merge)

`/cms` is the founder-only authoring surface, not product copy, but the LIVE LOOP fence says
copy is signed off, not assumed. These are all of them:

| Where | String |
|---|---|
| Box label | `Or describe the cover` |
| Placeholder | `A woman alone on an empty stage at dawn, seen from the last row, warm low light` |
| Button | `Draw it` / `Draw again` |
| Hint | `Enter draws. Shift and Enter starts a new line.` |
| Waiting (reused verbatim from `CoverImageStudio`) | `Writing the brief…` · `Drawing…` · `Still drawing…` · `Taking a while, hold on…` |
| Attach failed | `The cover drew but could not be saved onto the post. It is kept — open the post in the editor and pick it there.` |
| Gave up | `The drawing never finished. If it turns up it will be on the post in the editor — look there before drawing another.` |
| Slug clash | `A post already lives at that address. Change the title, then draw again.` |
| Construct flag | `The alt text uses retired score vocabulary — reword it below before publishing.` |
| **Removed** (it was wrong) | ~~`That clip is too big. Keep it under a minute.`~~ |
| Wrong file type | `That file is not a video we can publish. Use MP4, MOV or WebM.` (and the image / audio wordings in `laneMediaUpload.ts`) |
| Genuinely oversize | `That file is 620 MB and the limit is 500 MB.` — both numbers, the limit read from the presign |

House style: no em-dashes in new copy beyond the spaced dashes above, which match the
existing CMS strings. Everything else on the screen is unchanged.

---

## TESTS

### NEW — `src/app/cms/new/laneKeys.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { enterAdvances, type EnterContext } from "./laneKeys";

const press = (over: Partial<EnterContext> = {}): EnterContext => ({
  key: "Enter",
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
  isComposing: false,
  tagName: "INPUT",
  isContentEditable: false,
  ownsEnter: false,
  ...over,
});

describe("Enter is the CTA", () => {
  it("advances from a one-line field", () => {
    expect(enterAdvances(press())).toBe(true);
  });

  it("advances with nothing focused", () => {
    expect(enterAdvances(press({ tagName: "" }))).toBe(true);
  });

  it("ignores every other key", () => {
    expect(enterAdvances(press({ key: "a" }))).toBe(false);
  });
});

describe("what Enter must never do", () => {
  it("never eats an IME composition", () => {
    // The press that commits a Polish or Japanese word must not also walk the
    // screen. This is the one that bites on real hardware.
    expect(enterAdvances(press({ isComposing: true }))).toBe(false);
  });

  it("leaves a textarea its newline", () => {
    expect(enterAdvances(press({ tagName: "TEXTAREA" }))).toBe(false);
    expect(enterAdvances(press({ tagName: "TEXTAREA", metaKey: true }))).toBe(true);
    expect(enterAdvances(press({ tagName: "TEXTAREA", ctrlKey: true }))).toBe(true);
  });

  it("leaves a focused button to fire itself", () => {
    // Otherwise one press on Skip would also press Next.
    expect(enterAdvances(press({ tagName: "BUTTON" }))).toBe(false);
    expect(enterAdvances(press({ tagName: "A" }))).toBe(false);
  });

  it("stays out of the drawing box", () => {
    expect(enterAdvances(press({ tagName: "TEXTAREA", ownsEnter: true }))).toBe(false);
  });

  it("ignores Shift and Alt", () => {
    expect(enterAdvances(press({ shiftKey: true }))).toBe(false);
    expect(enterAdvances(press({ altKey: true }))).toBe(false);
  });
});
```

### NEW — `src/app/cms/new/coverDraw.test.ts`

Same source-reading idiom as `laneDraft.test.ts` (it already asserts on
`page.client.tsx` as a string), because these are wiring rules, not logic:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DRAW = readFileSync("src/app/cms/new/CoverDraw.tsx", "utf8");
const CLIENT = readFileSync("src/app/cms/new/page.client.tsx", "utf8");
const STEPS = readFileSync("src/app/cms/new/LaneSteps.tsx", "utf8");
const SHELL = readFileSync("src/app/cms/new/LaneShell.tsx", "utf8");

describe("a drawn cover is never lost", () => {
  it("treats a dead connection as a live draw, not a failure", () => {
    expect(DRAW).toContain("UPSTREAM_TIMEOUT");
    expect(DRAW).toContain("adminListCoverImages");
    expect(DRAW).toContain("adminSelectCoverImage");
  });

  it("never asks the backend to skip the attach", () => {
    expect(DRAW).not.toContain("attach: false");
  });
});

describe("the description is the brief, not a steer", () => {
  it("draws fresh every time", () => {
    expect(DRAW).toContain("fresh: true");
  });

  it("caps the description where the backend caps it", () => {
    expect(DRAW).toContain("const MAX_NOTES = 500");
  });
});

describe("the box stays where it belongs", () => {
  it("is image-only", () => {
    expect(STEPS).toContain('draft.coverKind === "image" ? draw : null');
  });

  it("holds the step's CTA while a draw runs", () => {
    expect(CLIENT).toContain("busy || uploading || drawing");
  });
});

describe("the lane chrome", () => {
  it("still closes from the top right", () => {
    expect(SHELL).toContain('aria-label="Close"');
  });

  it("gives the camera screen no Enter", () => {
    expect(CLIENT).toContain("dark || busy || uploading || drawing");
  });
});
```

### NEW — `src/app/cms/new/laneMediaUpload.test.ts`

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contentTypeFor,
  oversizeMessage,
  unsupportedMessage,
} from "./laneMediaUpload";

const fileOf = (name: string, type: string, size: number): File =>
  ({ name, type, size }) as File;

const VIDEO_CAP = 500 * 1024 * 1024; // what the presign serves by default

describe("the 19-second clip", () => {
  it("accepts a phone clip that the old 4.3 MB guard refused", () => {
    // The reported bug: 19 seconds of iPhone video, tens of MB, rejected by a
    // limit belonging to the coach BFF — a path this upload never touches.
    const clip = fileOf("IMG_4831.mov", "video/quicktime", 38 * 1024 * 1024);
    expect(unsupportedMessage(contentTypeFor(clip), "video")).toBeNull();
    expect(oversizeMessage(clip.size, VIDEO_CAP)).toBeNull();
  });

  it("reads the type off the name when the picker set none", () => {
    expect(contentTypeFor(fileOf("IMG_4831.MOV", "", 1))).toBe("video/quicktime");
    expect(contentTypeFor(fileOf("clip.mp4", "", 1))).toBe("video/mp4");
    expect(contentTypeFor(fileOf("no-extension", "", 1))).toBe("");
  });
});

describe("what it still refuses, and what it says", () => {
  it("names both numbers when a file really is too big", () => {
    const said = oversizeMessage(620 * 1024 * 1024, VIDEO_CAP);
    expect(said).toContain("620 MB");
    expect(said).toContain("500 MB");
    // Never again a length complaint about a size problem.
    expect(said).not.toMatch(/minute|shorter|length/i);
  });

  it("checks nothing when the backend served no cap", () => {
    expect(oversizeMessage(9e9, null)).toBeNull();
  });

  it("refuses a format the backend would refuse anyway, in words", () => {
    expect(unsupportedMessage("video/x-msvideo", "video")).toContain("MP4, MOV or WebM");
    expect(unsupportedMessage("application/pdf", "image")).toContain("JPEG");
  });
});

describe("the limit that does not apply here", () => {
  const RECORD = readFileSync("src/app/cms/new/RecordStep.tsx", "utf8");
  const CLIENT_SRC = readFileSync("src/app/cms/new/page.client.tsx", "utf8");
  const API = readFileSync("src/services/api/journalAdmin.ts", "utf8");

  it("is gone from the lane", () => {
    expect(RECORD).not.toContain("MAX_UPLOAD_BYTES");
    expect(RECORD).not.toContain("Keep it under a minute");
  });

  it("is replaced by the cap the presign serves", () => {
    expect(API).toContain("max_bytes");
    expect(RECORD).toContain("presigned.data.maxBytes");
    expect(CLIENT_SRC).toContain("presigned.data.maxBytes");
  });

  it("sends the signed headers back verbatim", () => {
    expect(API).toContain("presign.headers ??");
  });
});
```

### The gate

```bash
npm run test && npm run lint && npx tsc --noEmit
```

All three must be clean before the PR. `npm run check:complexity` and `npm run check:bff` if
CI runs them on this branch (no BFF route is added or changed, so `check:bff` is a no-op here).

---

## MANUAL SCRIPT (run it in this order)

1. `/cms` → unlock → **New** → **Post** → title → **Next**. You are on Cover, step 2 of 6.
2. Type a description, press **Enter**. The button reads *Drawing…* with a moving label; the
   **Next** button is held.
3. It lands: the preview shows the cover, the URL field fills, the alt text fills.
4. Press **Enter** with focus anywhere but the box → step 3. **Shift+Enter** in the excerpt
   box → a newline, no step. **⌘/Ctrl+Enter** there → step 4.
5. Walk to the last step, press **Enter** → it publishes (same as the button).
6. Open the published post in `/cms`'s two-column editor: the drawn image is on the post and
   the attempt is in the studio's strip, where earlier attempts can be reselected.
7. Back on the cover step: switch to **Video** → the drawing box is gone. Back to **Image** →
   it is back, with the description still in it.
8. The close **X** works on every step, before and after a draw.
9. **The reported bug.** `/cms/new` → **Exercise** → ••• → **Upload a file** → pick a real
   phone clip of 15–30 seconds (an AirDropped `.mov` is the exact reported case). It
   uploads and plays back. Before this change it was refused as "too big… under a minute".
10. Pick something that is not video (a PDF) → *"That file is not a video we can publish.
    Use MP4, MOV or WebM."* — no request goes out.
11. Record in-app for a few seconds → still uploads, unchanged, and the 60-second auto-stop
    still fires.

---

## OUT OF SCOPE — do not do these

- No backend or BFF change of any kind.
- No attempt strip, no thumbnails and no delete inside the lane. The strip is the editor's.
- No refactor of `CoverImageStudio.tsx`. It is a live, working surface; the ~40 duplicated
  lines of transport-failure handling are cheaper than touching it. If it is worth unifying
  later, that is its own PR with its own filter run.
- No change to `laneDraft.ts` — no new draft field is needed. `postId` already exists and is
  already persisted.
- No Escape-to-close. Enter was asked for; Escape was not, and a stray Escape while a draw is
  running is the one keystroke that would look like it cancelled a paid image.
- **No new duration limit on uploaded video.** None exists server-side, the old message
  invented one, and inventing a real one to match a wrong sentence is the wrong repair. The
  60-second auto-stop stays where it belongs: on the in-app recorder.
- **Do not change `MAX_UPLOAD_BYTES` or anything in `useCoachVideoRecorder.ts`.** That
  constant is correct for the coach path, which really does buffer through a Vercel
  function. The bug is that the CMS borrowed it, not that it is wrong.
- **Do not raise a cap on the backend.** 500 MB for video is already the default and it is
  env-tunable without a deploy.

---

## PR

Branch `claude/optimistic-goodall-nvn5x0` → PR into `main`, squash-merge after CI.
Title: `The cover step draws its own cover, Enter walks the lane, and the lane accepts real video`.

Three commits, in this order, so the bug fix can be reverted on its own:
1. `The lane stops refusing video it can actually store` (§6–§9)
2. `Enter does what the CTA does` (§1, §2, and the Enter half of §5)
3. `Describe a cover and the model draws it` (§3, §4, the rest of §5)
Stamp the PR body with:

```
FILTER: JUSTIFIED-SCAFFOLDING — cat {SCAFFOLDING} — fences {clear} — locks {clear}
        — redirect: n/a (named unblocker: the lane's cover step could not reach the
        cover generator that already shipped for the two-column editor)
```

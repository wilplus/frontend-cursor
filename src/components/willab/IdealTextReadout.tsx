"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Mic, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mergeSession } from "@/services/api/mergeSession";
import { reRecordSnippet } from "@/services/api/reRecordSnippet";
import {
  fetchIdealText,
  isUnappliedPolish,
  saveIdealUserEdit,
  type DocumentSuggestion,
  type IdealPiece,
  type IdealText,
  type KeyPoint,
} from "@/services/api/idealText";
import { sendSuggestionFeedback } from "@/services/api/suggestionFeedback";
import { decideBlock, decidePriorTake } from "@/services/api/documentDecide";
import { applyAcceptedReplacements } from "@/lib/willab/trackedChanges";
import { swapPiece } from "@/services/api/pieceSwap";
import { PieceBadgeText, PieceSwapSheet } from "./PieceBadges";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import { MarkerToolbar } from "./RichText";
import IdealReadMic from "./IdealReadMic";
import IdealTextActions from "./IdealTextActions";
import KeyPointsView from "./KeyPointsView";
import { MomentSheet, useMomentStars } from "./MomentStars";
import type { ReadoutPayload } from "./readout";

/* -------------------------------------------------------------------------- */
/*  IdealTextReadout — the post-recording screen IS the ideal text (SD)        */
/*                                                                            */
/*  Replaces the per-piece approve walker: the moment analysis lands, the      */
/*  user sees their ideal text 1.0 in THEIR OWN WORDS, one continuous text in  */
/*  paragraphs, font one step up, editable — under a grey                      */
/*  "Pending verification by the coach" badge. No Approve buttons, no "Send    */
/*  for analysis": a signed-in take is sent to the coach AUTOMATICALLY on      */
/*  arrival (mergeSession, once); a guest gets one button to save the text by  */
/*  creating an account (that is account creation, not a send step).           */
/* -------------------------------------------------------------------------- */

/** The speaker's own words, joined into paragraphs. A saved user edit wins.
 *
 *  FE-5 (P0) — this NO LONGER splices Say-It-Stronger upgrades into the text.
 *  It used to apply every upgrade unconditionally (a blind first-occurrence
 *  string replace, run sequentially over already-mutated text, ignoring the
 *  approval set the BE persists), which silently rewrote the speaker's words
 *  with no affordance to see or undo it. Under POLISH_AS_SUGGESTIONS the BE
 *  serves the verbatim words and offers each polish as an approvable star, so
 *  a client-side rewrite here would undo exactly what that feature fixes.
 *  The ONLY text mutations are now user-approved star folds. */
export function composeIdealText(payload: ReadoutPayload): string {
  const parts: string[] = [];
  if (payload.instantChunks.length > 0) {
    for (const p of payload.instantChunks) {
      const t = (p.userEditedText ?? p.text).trim();
      if (t) parts.push(t);
    }
  } else {
    for (const c of payload.fullTranscriptChunks) {
      const t = (c.userEditedText ?? c.transcript).trim();
      if (t) parts.push(t);
    }
  }
  return parts.join("\n\n");
}

export default function IdealTextReadout({
  payload,
  sessionId,
  arcId = null,
  signedIn,
  onAutoSent,
  onSignUp,
  onReRead,
}: {
  payload: ReadoutPayload;
  sessionId: string | null;
  /** The presentation this take belongs to — enables edit persistence (#214).
   *  null (guest / standalone upload) → edits stay local. */
  arcId?: string | null;
  signedIn: boolean | null;
  /** Fires once after the automatic send succeeds (review-pending bookkeeping). */
  onAutoSent: () => void;
  /** Guest path — save the text by creating an account (the signup gate). */
  onSignUp: () => void;
  /** Re-read: reading this ideal text aloud is just the next take — the host
   *  drops us back into the record flow for this presentation, and the reading
   *  sharpens the text. Absent → the re-read block hides. */
  onReRead?: () => void;
}) {
  const composed = useMemo(() => composeIdealText(payload), [payload]);
  const [text, setText] = useState(composed);
  const [editing, setEditing] = useState(false);
  // E-2 — presentation mode: swap the full read for the key-words cues. Only
  // reachable when the BE serves key_points (the toggle is otherwise hidden);
  // a version without cues falls through to the full read regardless.
  const [presentationMode, setPresentationMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const firedRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  // #214 — edit persistence: armed once the SD GET confirms the contract and
  // hands us the current version. Until then (flag OFF / guest) edits are
  // local-only, exactly the pre-#214 behavior.
  const versionRef = useRef<number | null>(null);
  // SD — the served living document: its text (the star anchors live in it),
  // verification status, and the moments entitlement. null until the GET lands
  // (or forever when the flag is OFF), and the screen stays exactly as before.
  const [sd, setSd] = useState<{
    ideal: IdealText;
    status: "unverified" | "verified";
    version: number | null;
    momentsUnlocked: boolean;
    priceCredits: number | null;
    explanationsAvailable: boolean;
    title: string | null;
    latestTakeSessionId: string | null;
    rereadDone: boolean;
    rereadProcessing: boolean | null;
    pieces: IdealPiece[] | null;
    suggestions: DocumentSuggestion[] | null;
    saved: boolean | null;
    keyPoints: KeyPoint[] | null;
  } | null>(null);
  // Bumped after a delivery re-record lands, to re-pull the SD text + stars.
  const [sdNonce, setSdNonce] = useState(0);
  // Staleness fence for the SD GET: local sd writes (a reject's echoed piece)
  // bump the generation so an in-flight GET from BEFORE the decision can
  // never land on top of them (review R-db4).
  const sdGenRef = useRef(0);
  // DISCERNMENT — the pending-swap comparison sheet's open piece.
  const [swapOpen, setSwapOpen] = useState<IdealPiece | null>(null);
  // FE-3 (bug 1c) — true once the SD fetch has RESOLVED (any outcome). Until
  // then a signed-in user sees a brief loading rather than the locally composed
  // text that then swaps to the star layer — the "stars pop in late" bug.
  const [sdSettled, setSdSettled] = useState(false);
  // State (not a ref) so arming re-runs the debounce effect — an edit typed
  // BEFORE the version fetch lands must still save once arming completes.
  const [canPersist, setCanPersist] = useState(false);
  const dirtyRef = useRef(false);
  // SEND-LATEST serialization (review R-ue2): saves run one at a time on a
  // promise chain, and each sends the text AS OF EXECUTION — overlapping PUTs
  // can therefore never commit an older edit over a newer one server-side.
  const textRef = useRef("");
  const savedTextRef = useRef<string | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const persistArmedRef = useRef(false);
  const arcIdRef = useRef<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">(
    "idle"
  );
  textRef.current = text;
  arcIdRef.current = arcId;

  // Automatic delivery — no send button. Once, when signed in with a session.
  useEffect(() => {
    if (!signedIn || !sessionId || firedRef.current) return;
    firedRef.current = true;
    void mergeSession(sessionId).then((r) => {
      if (r.kind === "sent") onAutoSent();
      else if (r.kind !== "unauthenticated") setSendFailed(true);
    });
  }, [signedIn, sessionId, onAutoSent]);

  // #214 — arm persistence AND adopt the served ideal text. The SD GET is the
  // authority: its text carries the key-moment anchors (and any folds the BE
  // already applied), so the stars can only land if we render THAT text rather
  // than the locally composed one. Adopt it only while the text is still
  // untouched — a dirty edit always wins (locked rule), and a saved user_edit
  // is what the BE serves back anyway.
  useEffect(() => {
    if (!signedIn || !arcId) return;
    let active = true;
    const gen = ++sdGenRef.current;
    void fetchIdealText(arcId).then((r) => {
      if (!active || gen !== sdGenRef.current) return;
      if (r.kind === "single") {
        versionRef.current = r.version;
        persistArmedRef.current = true;
        setCanPersist(true);
        setSd({
          ideal: r.ideal,
          status: r.status,
          version: r.version,
          momentsUnlocked: r.momentsUnlocked,
          priceCredits: r.priceCredits,
          explanationsAvailable: r.explanationsAvailable,
          title: r.title,
          latestTakeSessionId: r.latestTakeSessionId,
          rereadDone: r.rereadDone,
          rereadProcessing: r.rereadProcessing,
          pieces: r.pieces,
          suggestions: r.suggestions,
          saved: r.saved,
          keyPoints: r.keyPoints,
        });
        if (!dirtyRef.current && r.ideal.text.trim()) {
          savedTextRef.current = r.ideal.text;
          setText(r.ideal.text);
        }
      }
      // Resolve the gate whatever the outcome — flag OFF / pending must not
      // hang the screen on the loading state forever.
      setSdSettled(true);
    });
    return () => {
      active = false;
    };
  }, [signedIn, arcId, sdNonce]);

  // #214 — debounced save of a DIRTY edit (never the untouched composed text).
  // saveIdealUserEdit retries once on VERSION_SUPERSEDED with the server's
  // current version — the student's edit always wins (locked rule). Each
  // chained save reads textRef at execution, so the newest words always land
  // last; "Edit saved." shows only when the SAVED text is still the current
  // text (a newer pending edit keeps the status quiet — R-ue3).
  const enqueueSave = useCallback((aid: string) => {
    chainRef.current = chainRef.current.then(async () => {
      const t = textRef.current;
      if (savedTextRef.current === t) return;
      const r = await saveIdealUserEdit(aid, t, versionRef.current);
      if (r.ok) {
        versionRef.current = r.version ?? versionRef.current;
        savedTextRef.current = t;
        setSaveState(textRef.current === t ? "saved" : "idle");
      } else {
        setSaveState("failed");
      }
    });
  }, []);

  useEffect(() => {
    if (!dirtyRef.current || !canPersist || !arcId) return;
    const id = setTimeout(() => enqueueSave(arcId), 800);
    return () => clearTimeout(id);
  }, [text, arcId, canPersist, enqueueSave]);

  /** MASTER DOCUMENT (review R-md1) — drain the edit lane BEFORE an
   *  accept-and-freeze. Save snapshots whatever text the server holds, so a
   *  still-debounced edit (800ms) would be frozen out: the student would see
   *  "Saved. This is your script." over words the master never received.
   *  enqueueSave no-ops when nothing changed and each chained save reads
   *  textRef at execution, so running it early is safe AND always sends the
   *  newest words. Resolves false when the PUT did not land, so the caller
   *  can refuse to freeze a document it could not persist. */
  const flushEdits = useCallback(async (): Promise<boolean> => {
    const aid = arcIdRef.current;
    if (!aid || !persistArmedRef.current) return true;
    if (savedTextRef.current === textRef.current) return true;
    enqueueSave(aid);
    await chainRef.current;
    return savedTextRef.current === textRef.current;
  }, [enqueueSave]);

  // Unmount flush (R-ue3): a close inside the debounce window must not drop
  // the final edit — fire the save on the way out (the request outlives the
  // component; state setters after unmount are React no-ops).
  useEffect(
    () => () => {
      const aid = arcIdRef.current;
      if (
        aid &&
        persistArmedRef.current &&
        dirtyRef.current &&
        savedTextRef.current !== textRef.current
      ) {
        void saveIdealUserEdit(aid, textRef.current, versionRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, editing]);


  // FE-3/4/5 — a tracked-change decision. Accept = the proposal becomes the
  // text; Keep mine = the suggestion is refused and never re-offered. Both
  // ride the existing per-snippet feedback POST (the ledger remembers them),
  // and an ACCEPT reassembles the document BE-side, so we refetch.
  const decideTracked = useCallback(
    async (s: DocumentSuggestion, d: "accept" | "keep"): Promise<boolean> => {
      const accept = d === "accept";
      // Route by SOURCE — each lane has its own decision endpoint doing a
      // different server operation (§2/§3): a block upgrade must flip the
      // block's incumbent, which suggestion-feedback never does, so posting it
      // there would silently no-op the accept.
      let outcome: "ok" | "stale" | "error";
      if (s.source === "new_take") {
        if (!arcId || s.blockKey === null || !s.takeSessionId) return false;
        outcome = (
          await decideBlock(
            arcId,
            s.blockKey,
            accept ? "accept" : "keep",
            s.takeSessionId
          )
        ).kind;
      } else if (s.source === "prior_take") {
        if (!arcId) return false;
        outcome = (
          await decidePriorTake(arcId, s, accept ? "accept" : "keep")
        ).kind;
      } else {
        if (!s.snippetId || !s.takeSessionId) return false;
        const r = await sendSuggestionFeedback({
          snippetId: s.snippetId,
          sessionId: s.takeSessionId,
          target: s.kind === "bold" ? "document_bold" : "document_replace",
          action: accept ? "applied" : "dismissed",
          suggestionId: s.id,
        });
        outcome = r.saved ? "ok" : "error";
      }
      if (outcome === "error") return false;
      // 409 STALE_OFFER / NOT_PENDING — a newer take moved the offer. Silently
      // refetch (the served suggestions refresh regardless of the edit lane)
      // and treat the decision as handled.
      if (outcome === "stale") {
        setSdNonce((n) => n + 1);
        return true;
      }
      // Remember the decision on the served list so a remount never re-offers
      // it (the server agrees).
      setSd((prev) =>
        prev
          ? {
              ...prev,
              suggestions: (prev.suggestions ?? []).map((x) =>
                x.id === s.id
                  ? { ...x, status: accept ? "approved" : "dismissed" }
                  : x
              ),
            }
          : prev
      );
      if (accept) {
        // The accepted words must become the DOCUMENT, not just a painted
        // span: Copy, the editor and the user-edit PUT all read `text`. Commit
        // the fold WITHOUT marking dirty, and release the edit lane so no
        // debounce can PUT the pre-accept words back over the BE's
        // reassembly. Then refetch — the BE bumped the version (review
        // R-lt3/R-lt7).
        const base = textRef.current;
        const next = applyAcceptedReplacements(base, [s], new Set([s.id]));
        if (next !== base) {
          savedTextRef.current = next;
          setText(next);
        }
        dirtyRef.current = false;
        sdGenRef.current++; // fence any in-flight pre-decision GET
        setSdNonce((n) => n + 1);
      }
      return true;
    },
    [arcId]
  );

  // SD — the shared star layer (sheet, Approve/Revert folds, 5-credit unlock).
  const stars = useMomentStars({
    arcId: arcId ?? "",
    momentsUnlocked: sd?.momentsUnlocked ?? false,
    priceCredits: sd?.priceCredits ?? null,
    explanationsAvailable: sd?.explanationsAvailable ?? false,
    onUnlocked: () =>
      setSd((prev) => (prev ? { ...prev, momentsUnlocked: true } : prev)),
  });

  // FE-2 — every polish star on this text, and the subset still awaiting a
  // decision. 2+ pending earns the bulk control; the full list is what
  // "Undo all" walks back.
  const allPolish = useMemo(
    () => (sd?.ideal.keyMoments ?? []).filter(isUnappliedPolish),
    [sd]
  );
  const pendingPolish = useMemo(
    () => allPolish.filter((m) => !stars.isApplied(m)),
    // stars.isApplied reads appliedLocal, so track the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPolish, stars.appliedLocal]
  );

  // The one edit path — a keystroke or a toolbar wrap: mark dirty, reset the
  // save flash, update the text (the debounce effect persists it).
  const applyEdit = useCallback((next: string) => {
    dirtyRef.current = true;
    setSaveState("idle");
    setText(next);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        {/* The one status: grey now; flips to green on the ideal-text page
            once the coach verifies. */}
        <span className="rounded-lg bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
          Pending verification by the coach
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(stripRichMarkers(text)).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              });
            }}
            aria-label={copied ? "Copied" : "Copy the text"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-label={editing ? "Done editing" : "Edit the text"}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted ${
              editing ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {editing ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <PencilLine className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* FE-2 — one tap applies every smoother-version suggestion. Polish only:
          flow smoothing is mechanical, while acoustic and structural stars are
          judgment calls and stay strictly per-star. Each still POSTs
          individually, so every approval is separately recorded and revertible.
          Hidden while editing: folds live in the render layer, so approving
          behind the raw textarea would look like it did nothing (R-p1). */}
      {editing ? null : stars.bulkApplied ? (
        <button
          type="button"
          onClick={() => stars.revertAllPolish(allPolish)}
          className="self-start text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Undo all
        </button>
      ) : pendingPolish.length >= 2 ? (
        <button
          type="button"
          onClick={() => stars.approveAllPolish(pendingPolish)}
          className="self-start rounded-full border border-border px-3.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          Approve all
        </button>
      ) : null}

      {/* E-2 — full ↔ key-words toggle. Hidden unless the BE serves cues. */}
      {!editing && sd?.keyPoints && sd.keyPoints.length > 0 ? (
        <div className="mb-3 inline-flex self-start rounded-full border border-border bg-muted p-0.5 text-[12px] font-medium">
          <button
            type="button"
            onClick={() => setPresentationMode(false)}
            className={`rounded-full px-3 py-1 transition-colors ${
              presentationMode
                ? "text-muted-foreground"
                : "bg-background text-foreground shadow-sm"
            }`}
          >
            Full text
          </button>
          <button
            type="button"
            onClick={() => setPresentationMode(true)}
            className={`rounded-full px-3 py-1 transition-colors ${
              presentationMode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Key words
          </button>
        </div>
      ) : null}

      {editing ? (
        <div className="flex flex-col gap-2">
          {/* Bold / underline / italic / orange — wraps the selection in the
              shared marker contract; renders in the read view + everywhere. */}
          <MarkerToolbar
            textareaRef={editorRef}
            value={text}
            onChange={applyEdit}
          />
          <textarea
            ref={editorRef}
            value={text}
            onChange={(e) => applyEdit(e.target.value)}
            className="w-full resize-none overflow-hidden rounded-2xl border border-primary bg-background px-4 py-4 text-[17px] leading-relaxed outline-none"
          />
        </div>
      ) : signedIn && arcId && !sdSettled ? (
        // FE-3 — hold until the served text + its stars are in hand, so they
        // land together instead of the text rendering then stars popping in.
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          Putting your ideal text together…
        </p>
      ) : sd && presentationMode && sd.keyPoints && sd.keyPoints.length > 0 ? (
        // E-2 — key-words presentation mode: the verbatim cues, each labelled
        // by its block. Tapping one returns to the full read.
        <KeyPointsView
          keyPoints={sd.keyPoints}
          onExit={() => setPresentationMode(false)}
        />
      ) : sd ? (
        // SD — the SAME star layer as the notebook: grey suggestion stars to
        // Approve, orange coach-verified stars behind the unlock.
        // DISCERNMENT — the same star text, with each paragraph wearing its
        // piece's version pill (badges hide on any paragraph/piece mismatch).
        <PieceBadgeText
          text={text}
          ideal={sd.ideal}
          // MASTER DOCUMENT — after a save the script is clean: the take
          // badges go (the pending state is resolved server-side).
          pieces={sd.saved === true ? null : sd.pieces}
          // LIVING TRANSCRIPT — when the BE serves span-anchored tracked
          // changes they render the words (strikes, proposals, advice stars)
          // and the version pills still compose on top; absent → today's
          // star/quote view, unchanged.
          suggestions={sd.suggestions}
          onDecideTracked={decideTracked}
          onMomentTap={(m) => void stars.openMoment(m)}
          foldFor={stars.foldFor}
          sdStars
          textSizeClass="text-[17px]"
          onOpenSwap={setSwapOpen}
        />
      ) : (
        <p className="whitespace-pre-line text-[17px] leading-relaxed text-foreground">
          {text}
        </p>
      )}

      {saveState === "saved" ? (
        <p className="text-[12px] text-muted-foreground">Edit saved.</p>
      ) : saveState === "failed" ? (
        <p className="text-[12px] text-muted-foreground">
          Couldn&apos;t save your edit just now. It stays here; keep typing and
          it retries.
        </p>
      ) : null}

      {sendFailed ? (
        <p className="text-[12px] text-muted-foreground">
          Couldn&apos;t reach your coach just now. Your text is safe; delivery
          retries when you reopen it.
        </p>
      ) : null}

      {/* FE-6 — a guest's edits are local-only (persistence arms on the SD
          fetch, which needs auth), so the CTA must not promise saving. */}
      {signedIn === false ? (
        <Button
          type="button"
          onClick={onSignUp}
          className="h-12 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
        >
          Create an account to keep this text
        </Button>
      ) : sd && arcId && onReRead ? (
        // FE-D — the ONE two-state mic: reread_done false → record the reading
        // IN PLACE (recording_kind "read", paired to the latest spoken take);
        // true → "Record another take" into the regular record flow. FE-6 —
        // the take nudge sits under it on the 1st/2nd version only.
        <>
          {sd.saved !== null ? (
            // MASTER DOCUMENT (FE-3) — Save → re-read (gated) → next take.
            <IdealTextActions
              arcId={arcId}
              version={sd.version}
              title={sd.title}
              latestTakeSessionId={sd.latestTakeSessionId}
              rereadDone={sd.rereadDone}
              rereadProcessing={sd.rereadProcessing}
              saved={sd.saved}
              // The freeze waits for the edit lane (R-md1).
              onBeforeSave={flushEdits}
              onSaved={() => {
                // The server now holds the student's newest words AND has
                // frozen them, so the local edit lane is settled — release it
                // or the refetch below refuses to adopt the served text.
                dirtyRef.current = false;
                savedTextRef.current = null;
                setSdNonce((n) => n + 1);
              }}
              onNewTake={onReRead}
              onReadUploaded={() => setSdNonce((n) => n + 1)}
            />
          ) : (
            <IdealReadMic
              arcId={arcId}
              version={sd.version}
              title={sd.title}
              latestTakeSessionId={sd.latestTakeSessionId}
              rereadDone={sd.rereadDone}
              rereadProcessing={sd.rereadProcessing}
              onNewTake={onReRead}
              onReadUploaded={() => setSdNonce((n) => n + 1)}
            />
          )}
          {sd.version === 1 || sd.version === 2 ? (
            <p className="max-w-xs self-center text-center text-[12px] leading-relaxed text-muted-foreground">
              Your ideal text gets sharper with more takes. Three is where it
              really lands. Record another when you&apos;re ready.
            </p>
          ) : null}
        </>
      ) : onReRead ? (
        // Flag OFF / no SD payload — the plain small mic into the record flow.
        <div className="mt-1 flex flex-col items-center gap-2 border-t border-border pt-4">
          <Button
            type="button"
            onClick={onReRead}
            variant="outline"
            className="h-10 rounded-full px-5 text-[14px] font-medium"
          >
            <Mic className="mr-2 h-4 w-4" aria-hidden />
            continue refining ideal text
          </Button>
        </div>
      ) : null}

      {/* DISCERNMENT — accept lands the challenger (the BE reassembles →
          refetch the whole document); reject pins the incumbent (apply the
          echoed piece locally, the glow dies). Both 409s (a newer take moved
          the offer mid-view) refetch SILENTLY — never an error surface. */}
      <PieceSwapSheet
        piece={swapOpen}
        onClose={() => setSwapOpen(null)}
        onDecide={async (action) => {
          const p = swapOpen;
          if (!p?.challenger || !arcId) return false;
          const r = await swapPiece({
            arcId,
            pieceKey: p.pieceKey,
            action,
            challengerSnippetId: p.challenger.snippetId,
          });
          if (r.kind === "error") return false;
          setSwapOpen(null);
          if (r.kind === "stale" || action === "accept" || r.piece === null) {
            // The master text changed under us (accept reassembled it; stale
            // means a newer take already did). The user's decision here IS
            // the newer intent, so release the local edit lane — otherwise a
            // dirty flag would block adoption of the accepted text and the
            // next keystroke would PUT the stale words back (review R-db6).
            dirtyRef.current = false;
            savedTextRef.current = null;
            setSdNonce((n) => n + 1);
          } else {
            const echoed = r.piece;
            sdGenRef.current++; // fence out any in-flight pre-decision GET
            setSd((prev) =>
              prev
                ? {
                    ...prev,
                    pieces: (prev.pieces ?? []).map((x) =>
                      x.pieceKey === echoed.pieceKey ? echoed : x
                    ),
                  }
                : prev
            );
          }
          return true;
        }}
      />
      <MomentSheet
        moment={stars.momentOpen}
        momentContent={stars.momentContent}
        applied={stars.momentOpen ? stars.isApplied(stars.momentOpen) : false}
        onClose={stars.closeMoment}
        onApprove={() => stars.momentOpen && stars.approveMoment(stars.momentOpen)}
        onRevert={() => stars.momentOpen && stars.revertMoment(stars.momentOpen)}
        onBuy={stars.buyMoments}
        onReRecord={
          arcId
            ? async (snippetId, takeSessionId, audio, durationSec) => {
                const r = await reRecordSnippet({
                  snippetId,
                  takeSessionId,
                  topic: sd?.title ?? null,
                  audio,
                  durationSec,
                });
                // Re-pull the served text so the improved snippet + new version
                // flow in; leave the sheet open on its success confirmation.
                if (r.ok) setSdNonce((n) => n + 1);
                return r.ok;
              }
            : undefined
        }
      />
    </div>
  );
}

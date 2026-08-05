"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ListPlus, Mic, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mergeSession } from "@/services/api/mergeSession";
import { reRecordSnippet } from "@/services/api/reRecordSnippet";
import {
  fetchIdealText,
  isUnappliedPolish,
  keyPointTintRanges,
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
import {
  alignVariantBlocksWithPieces,
  fetchBlockVariants,
  selectBlockVariant,
  type BlockVariant,
  type VariantBlock,
} from "@/services/api/blockVariants";
import { BlockVariantSheet } from "./BlockVariantPicker";
import { PieceBadgeText, PieceSwapSheet } from "./PieceBadges";
import { useArcDeckRef } from "./useArcDeckRef";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import MarkedEditor from "./MarkedEditor";
import MarkedParagraphs from "./MarkedParagraphs";
import IdealTextHeading from "./IdealTextHeading";
import OverlayCloseButton from "./OverlayCloseButton";
import DocumentArranger from "./DocumentArranger";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";
import IdealTextActions from "./IdealTextActions";
import { MomentSheet, useMomentStars } from "./MomentStars";
import type { ReadoutPayload } from "./readout";

/* -------------------------------------------------------------------------- */
/*  IdealTextReadout — the post-recording screen IS the ideal text (SD)        */
/*                                                                            */
/*  Replaces the per-piece approve walker: the moment analysis lands, the      */
/*  user sees their ideal text 1.0 in THEIR OWN WORDS, one continuous text in  */
/*  paragraphs, font one step up, editable — under a grey                      */
/*  "Pending verification" badge. No Approve buttons, no "Send                 */
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
  onClose,
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
  /** Founder 2026-07-30 — the host's way out, drawn in THIS screen's head
   *  beside the title, the way the ideal-text overlay draws its own. The host
   *  stops drawing its bare header when it passes this, so the ✕ moves rather
   *  than duplicating. Absent → no ✕ (a host with its own exit). */
  onClose?: () => void;
}) {
  const composed = useMemo(() => composeIdealText(payload), [payload]);
  const [text, setText] = useState(composed);
  const [editing, setEditing] = useState(false);
  // T1 · 1.2 — the add/move mode: tap a gap to add a part, drag one to move
  // it. A sibling of the textarea, never a step before recording.
  const [arranging, setArranging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const firedRef = useRef(false);
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
    explanationsAvailable: boolean;
    title: string | null;
    latestTakeSessionId: string | null;
    pieces: IdealPiece[] | null;
    suggestions: DocumentSuggestion[] | null;
    saved: boolean | null;
    keyPoints: KeyPoint[] | null;
    /** The arc's deck PDF (slide-per-paragraph read). Safe-ahead: null until
     *  the BE echoes presentation_ref; useArcDeckRef then falls back. */
    presentationRef: string | null;
    /** T1 · 1.2 — the served text IS the student's edit. Drives the star
     *  fence below (an edited document carries no honest anchors). */
    userEdited: boolean;
    /** T1 · 1.2 — a superseded edit the BE offers back (pending BE; null on
     *  every payload today, and the local buffer covers it). */
    priorEdit: { text: string; version: number | null } | null;
    /** The BE's gate on a new official take. null (absent) never gates. */
    canRecordTake: boolean | null;
  } | null>(null);
  // Bumped after a delivery re-record lands, to re-pull the SD text + stars.
  const [sdNonce, setSdNonce] = useState(0);
  // Staleness fence for the SD GET: local sd writes (a reject's echoed piece)
  // bump the generation so an in-flight GET from BEFORE the decision can
  // never land on top of them (review R-db4).
  const sdGenRef = useRef(0);
  // DISCERNMENT — the pending-swap comparison sheet's open piece.
  const [swapOpen, setSwapOpen] = useState<IdealPiece | null>(null);
  // BLOCK_VARIANTS — the picker pool and its open sheet. null = feature off
  // (the GET 404s) / not loaded: nothing new renders. The timeline lives on
  // the notebook overlay only (§8.2); this screen carries just the picker.
  const [variantBlocks, setVariantBlocks] = useState<VariantBlock[] | null>(
    null
  );
  const [pickerBlock, setPickerBlock] = useState<VariantBlock | null>(null);
  // Staleness fence for the pool GET (same rule as the SD GET).
  const variantsGenRef = useRef(0);

  /** BLOCK_VARIANTS — pull the picker pool AFTER the document GET (§5
   *  order). 404 = off → clear; a read FAILURE keeps the previous pool
   *  (append-only — every id in it stays valid; an empty picker lies). */
  const refreshVariants = useCallback(() => {
    const aid = arcIdRef.current;
    if (!aid) return;
    const gen = ++variantsGenRef.current;
    void fetchBlockVariants(aid).then((v) => {
      if (gen !== variantsGenRef.current) return;
      if (v.kind === "off") setVariantBlocks(null);
      else if (v.kind === "ready") setVariantBlocks(v.blocks);
    });
  }, []);
  // FE-3 (bug 1c) — true once the SD fetch has RESOLVED (any outcome). Until
  // then a signed-in user sees a brief loading rather than the locally composed
  // text that then swaps to the star layer — the "stars pop in late" bug.
  const [sdSettled, setSdSettled] = useState(false);
  // State (not a ref) so arming re-runs the debounce effect — an edit typed
  // BEFORE the version fetch lands must still save once arming completes.
  const [canPersist, setCanPersist] = useState(false);
  const dirtyRef = useRef(false);
  // A render-visible mirror of dirtyRef: the star fence has to react to a
  // local edit, and a ref cannot re-render.
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback((v: boolean) => {
    dirtyRef.current = v;
    setDirty(v);
  }, []);
  // T1 · 1.2 — a newer version assembled while the student was typing. Their
  // words are HELD here, never re-sent automatically (that would overwrite
  // the take that just landed), and offered back for one tap.
  const [superseded, setSuperseded] = useState<string | null>(null);
  // 409 NOTHING_TO_EDIT — nothing is assembled yet, so the edit affordances
  // have nothing to act on and hide entirely.
  const [editLocked, setEditLocked] = useState(false);
  // 400 INVALID_INPUT — past the document ceiling. The words stay on screen.
  const [tooLong, setTooLong] = useState(false);
  // SEND-LATEST serialization (review R-ue2): saves run one at a time on a
  // promise chain, and each sends the text AS OF EXECUTION — overlapping PUTs
  // can therefore never commit an older edit over a newer one server-side.
  const textRef = useRef("");
  const savedTextRef = useRef<string | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  // The exact document the BE refused (400) — never re-sent unchanged, and
  // never mistaken for a saved one.
  const invalidTextRef = useRef<string | null>(null);
  const persistArmedRef = useRef(false);
  const arcIdRef = useRef<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">(
    "idle"
  );
  textRef.current = text;
  arcIdRef.current = arcId;

  // BLOCK_VARIANTS — a different arc = a fresh pool; the chips must never
  // render one arc's blocks against another arc's paragraphs.
  useEffect(() => {
    variantsGenRef.current++;
    setVariantBlocks(null);
    setPickerBlock(null);
  }, [arcId]);

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
          explanationsAvailable: r.explanationsAvailable,
          title: r.title,
          latestTakeSessionId: r.latestTakeSessionId,
          pieces: r.pieces,
          suggestions: r.suggestions,
          saved: r.saved,
          keyPoints: r.keyPoints,
          presentationRef: r.presentationRef,
          userEdited: r.userEdited,
          priorEdit: r.priorEdit,
          canRecordTake: r.canRecordTake,
        });
        // A document exists again → the edit affordances come back.
        if (r.ideal.text.trim()) setEditLocked(false);
        if (!dirtyRef.current && r.ideal.text.trim()) {
          savedTextRef.current = r.ideal.text;
          setText(r.ideal.text);
        }
        // BLOCK_VARIANTS — refresh the pool AFTER the document landed (§5
        // order), and only on the SD lane (the pool only exists where the
        // master model does).
        refreshVariants();
      }
      // Resolve the gate whatever the outcome — flag OFF / pending must not
      // hang the screen on the loading state forever.
      setSdSettled(true);
    });
    return () => {
      active = false;
    };
  }, [signedIn, arcId, sdNonce, refreshVariants]);

  // #214 — debounced save of a DIRTY edit (never the untouched composed text).
  // Each chained save reads textRef at execution, so the newest words always
  // land last; "Edit saved." shows only when the SAVED text is still the
  // current text (a newer pending edit keeps the status quiet — R-ue3).
  //
  // T1 · 1.2 — VERSION_SUPERSEDED is no longer retried against the server's
  // current version. That retry re-sent pre-take words over the text a
  // just-landed take had assembled. Now: hold the words, adopt the new
  // version, offer the words back. Nothing dropped, nothing clobbered.
  const enqueueSave = useCallback(
    (aid: string) => {
      chainRef.current = chainRef.current.then(async () => {
        const t = textRef.current;
        if (savedTextRef.current === t) return;
        // The exact document the BE already refused — don't re-send it on
        // every keystroke. Any other words get a fresh attempt.
        if (invalidTextRef.current === t) return;
        const r = await saveIdealUserEdit(aid, t, versionRef.current);
        if (r.ok) {
          versionRef.current = r.version ?? versionRef.current;
          savedTextRef.current = t;
          invalidTextRef.current = null;
          setTooLong(false);
          setSaveState(textRef.current === t ? "saved" : "idle");
          // BLOCK_VARIANTS (§5) — a saved edit also lands block-level in
          // the pool, so the picker may have grown a "My edit" entry.
          refreshVariants();
          return;
        }
        if (r.reason === "superseded") {
          setSuperseded(t);
          if (r.currentVersion !== null) versionRef.current = r.currentVersion;
          // Release the edit lane so the refetch below may adopt the NEW
          // text, and so no debounce can PUT these words back over it.
          markDirty(false);
          savedTextRef.current = null;
          setSaveState("idle");
          sdGenRef.current++; // fence any in-flight pre-supersede GET
          setSdNonce((n) => n + 1);
          return;
        }
        if (r.reason === "nothingToEdit") {
          setEditLocked(true);
          setSaveState("idle");
          return;
        }
        if (r.reason === "invalid") {
          // Keep the words on screen and stop retrying THESE words. Marking
          // them saved instead would be a lie the master-document freeze
          // believes: flushEdits would report success over a document the
          // server never took.
          invalidTextRef.current = t;
          setTooLong(true);
          setSaveState("idle");
          return;
        }
        setSaveState("failed");
      });
    },
    [markDirty, refreshVariants]
  );

  /** BLOCK_VARIANTS — pick one variant for one block (fear 3). Same edit-
   *  lane release as a swap accept: the user's pick IS the newer intent, so
   *  no debounce may PUT the pre-select words back over the reassembled
   *  document. ok/gone/stale all close and refetch silently (§9); only a
   *  transport failure keeps the sheet open on its retry line. */
  const selectVariant = useCallback(
    async (block: VariantBlock, variant: BlockVariant): Promise<boolean> => {
      const aid = arcIdRef.current;
      // Display-only rows never render a select button; belt-and-braces.
      if (!aid || block.blockKey === null || !variant.variantId) return true;
      const r = await selectBlockVariant(aid, block.blockKey, variant.variantId);
      if (r.kind === "error") return false;
      setPickerBlock(null);
      markDirty(false);
      savedTextRef.current = null;
      setSdNonce((n) => n + 1);
      return true;
    },
    [markDirty]
  );

  /** T1 · 1.2 — put the student's held version back, on top of whatever the
   *  new take assembled. The ONLY path that sends `reapplied`, and the only
   *  path that lets a pre-take edit win over a newer version: because the
   *  student asked for it, having seen the new text first. */
  const reapplyEdit = useCallback(async () => {
    const aid = arcIdRef.current;
    const words = sd?.priorEdit?.text ?? superseded;
    if (!aid || !words) return;
    // On the SAME lane as the debounced saves: a `prior_edit` served straight
    // from a GET can be re-applied while an ordinary save is still in flight,
    // and the two must not race for the version stamp.
    const run = chainRef.current.then(() =>
      saveIdealUserEdit(aid, words, versionRef.current, { reapplied: true })
    );
    chainRef.current = run.then(
      () => undefined,
      () => undefined
    );
    const r = await run;
    if (!r.ok) {
      if (r.reason === "invalid") setTooLong(true);
      else if (r.reason === "superseded") {
        // Another take landed in between. Re-stamp and leave the offer up:
        // one more tap re-applies against the newest version.
        if (r.currentVersion !== null) versionRef.current = r.currentVersion;
        sdGenRef.current++;
        setSdNonce((n) => n + 1);
      } else setSaveState("failed");
      return;
    }
    versionRef.current = r.version ?? versionRef.current;
    savedTextRef.current = words;
    markDirty(false);
    setText(words);
    setSuperseded(null);
    sdGenRef.current++;
    setSdNonce((n) => n + 1);
  }, [markDirty, sd?.priorEdit, superseded]);

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
        markDirty(false);
        sdGenRef.current++; // fence any in-flight pre-decision GET
        setSdNonce((n) => n + 1);
      }
      return true;
    },
    [arcId, markDirty]
  );

  // SLIDES — the arc's deck, for the slide-per-paragraph reading view.
  const deckRef = useArcDeckRef(arcId, sd?.presentationRef ?? null, sdSettled);

  // SD — the shared star layer (sheet, Approve/Revert folds, moments unlock).
  const stars = useMomentStars({
    arcId: arcId ?? "",
    momentsUnlocked: sd?.momentsUnlocked ?? false,
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

  // FE-7 — the key-point ranges the full read may accent. Computed against the
  // text ACTUALLY on screen, not the served one: an accepted tracked change or
  // a local edit shifts every offset after it, and a cue verified against stale
  // text would tint the wrong words. keyPointTintRanges re-verifies each slice
  // and drops silently on any mismatch, so an edit simply retires the cues it
  // moved rather than mispainting them.
  const tint = useMemo(
    () => keyPointTintRanges(text, sd?.keyPoints ?? null),
    [text, sd]
  );

  // The one edit path — a keystroke, a toolbar wrap, an add or a move: mark
  // dirty, reset the save flash, update the text (the debounce effect
  // persists it). Add/move go through here too, so the whole joined document
  // rides the same single save lane.
  const applyEdit = useCallback(
    (next: string) => {
      markDirty(true);
      setSaveState("idle");
      setText(next);
    },
    [markDirty]
  );

  // T1 · 1.2 — the star fence. While the document is the student's edit, the
  // BE serves no decoration, and re-anchoring stars into edited words
  // client-side would attach a coach's read to a sentence they never saw.
  // Stars come back when the next take supersedes the edit.
  const edited = sd?.userEdited === true || dirty;
  // A held version to re-offer: the BE's `prior_edit` when it ships, else the
  // local buffer from the supersede we just handled.
  const heldEdit = sd?.priorEdit?.text ?? superseded;
  // Nothing assembled (409 NOTHING_TO_EDIT) → no edit affordances at all.
  const canEdit = !editLocked && text.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Founder 2026-07-30 — this screen is an ideal text, so it is headed
          like one: the project's name with its verification state beside it,
          the actions and the way out on the same row. It used to spend this
          band on a lone badge under an EMPTY overlay header — the one thing
          the ideal-text overlay had already been fixed not to do. The host
          hands its ✕ down here rather than drawing a second one above (the
          same "it moves, it does not duplicate" rule as the setup flow). */}
      <div className="flex items-center justify-between gap-2">
        <IdealTextHeading title={sd?.title} status={sd ? sd.status : null} />
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
          {/* T1 · 1.2 — add / move parts. Hidden while the raw editor is open
              (the textarea already owns the whole document) and whenever
              there is nothing assembled to arrange. */}
          {canEdit && !editing ? (
            <button
              type="button"
              onClick={() => setArranging((a) => !a)}
              aria-label={
                arranging
                  ? IDEAL_EDIT_COPY.arrangeDone
                  : IDEAL_EDIT_COPY.arrangeOpen
              }
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted ${
                arranging
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {arranging ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <ListPlus className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
          {canEdit && !arranging ? (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              aria-label={editing ? "Done editing" : "Edit the text"}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted ${
                editing
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {editing ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <PencilLine className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
          {onClose ? (
            <OverlayCloseButton onClick={onClose} className="ml-1" />
          ) : null}
        </div>
      </div>

      {/* T1 · 1.2 — a take landed while the student was editing. The new text
          is already on screen; their version is held and goes back with one
          tap. Never applied for them: re-applying replaces the words the new
          take assembled, which is their call. */}
      {heldEdit ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3">
          <p className="text-[13px] font-medium text-foreground">
            {IDEAL_EDIT_COPY.supersededTitle}
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {IDEAL_EDIT_COPY.supersededBody}
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => void reapplyEdit()}
              className="rounded-full bg-foreground px-4 py-1.5 text-[13px] font-medium text-background"
            >
              {IDEAL_EDIT_COPY.supersededReapply}
            </button>
            <button
              type="button"
              onClick={() => {
                setSuperseded(null);
                setSd((prev) => (prev ? { ...prev, priorEdit: null } : prev));
              }}
              className="rounded-full px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              {IDEAL_EDIT_COPY.supersededDismiss}
            </button>
          </div>
        </div>
      ) : null}

      {/* FE-2 — one tap applies every smoother-version suggestion. Polish only:
          flow smoothing is mechanical, while acoustic and structural stars are
          judgment calls and stay strictly per-star. Each still POSTs
          individually, so every approval is separately recorded and revertible.
          Hidden while editing: folds live in the render layer, so approving
          behind the raw textarea would look like it did nothing (R-p1). Same
          reason while arranging, and while the document is the student's own
          edit (no stars are drawn there at all — T1 · 1.2). */}
      {editing || arranging || edited ? null : stars.bulkApplied ? (
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

      {/* Founder 2026-07-29 — the Full text / Key words toggle is retired:
          the readout always shows the full text. */}
      {editing ? (
        // FE-1 — the editor shows STYLED text, never the marker source: a user
        // must not see "{{orange:" while editing either. Saving serializes
        // back to markers, byte-exact for any span they did not touch.
        <MarkedEditor value={text} onChange={applyEdit} textSizeClass="text-[17px]" />
      ) : signedIn && arcId && !sdSettled ? (
        // FE-3 — hold until the served text + its stars are in hand, so they
        // land together instead of the text rendering then stars popping in.
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          Putting your ideal text together…
        </p>
      ) : arranging ? (
        // T1 · 1.2 — the parts view: tap a gap to add, drag a part to move it.
        // Every action emits the whole joined document into the SAME save
        // lane the editor uses.
        <DocumentArranger text={text} onChange={applyEdit} />
      ) : sd && edited ? (
        // T1 · 1.2 — the student's own document: their words, their markers,
        // NO star layer and NO version pills. Both are anchored to machine
        // text that this document no longer is. Same renderer as the guest
        // fallback: it is the same document, minus the decoration.
        <MarkedParagraphs text={text} textSizeClass="text-[17px]" />
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
          // BLOCK_VARIANTS — the per-block picker entry (chips zip to
          // paragraphs; feature off → null → nothing new). Cross-checked
          // against the SERVED pieces via the BE-confirmed
          // block_key == piece_key join — sd.pieces, not the display
          // pieces, which a save blanks.
          variantBlocks={alignVariantBlocksWithPieces(variantBlocks, sd.pieces)}
          onOpenPicker={setPickerBlock}
          tint={tint}
          // SLIDES — each paragraph reads under the slide it was delivered
          // on (deckless arcs pass null: today's view).
          deck={deckRef ? { presentationRef: deckRef } : null}
        />
      ) : (
        // FE-1 — this fallback (no SD payload: guest, or the flag off) used to
        // print `text` raw, markers and all. It is the same document, so it
        // gets the same renderer.
        <MarkedParagraphs text={text} textSizeClass="text-[17px]" />
      )}

      {tooLong ? (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {IDEAL_EDIT_COPY.tooLong}
        </p>
      ) : saveState === "saved" ? (
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
        // MASTER DOCUMENT — Save, then the next official take. Reading the
        // text back into the mic used to sit between them; retired (founder
        // 2026-08-05). The take nudge that sat under this went with it:
        // "not text that it really lands on the 3rd time; on the bubble
        // never" — and it was no better as a standing line on the document.
        <IdealTextActions
          arcId={arcId}
          canRecordTake={sd.canRecordTake}
          saved={sd.saved}
          // The freeze waits for the edit lane (R-md1).
          onBeforeSave={flushEdits}
          onSaved={() => {
            // The server now holds the student's newest words AND has
            // frozen them, so the local edit lane is settled — release it
            // or the refetch below refuses to adopt the served text.
            markDirty(false);
            savedTextRef.current = null;
            setSdNonce((n) => n + 1);
          }}
          onNewTake={onReRead}
        />
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
            markDirty(false);
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
      {/* BLOCK_VARIANTS — the per-block picker (neutral, chronological).
          Kept visually separate from the offer sheet above BY DESIGN (§6):
          the offer pushes, the picker pulls. */}
      <BlockVariantSheet
        block={pickerBlock}
        onSelect={selectVariant}
        onClose={() => setPickerBlock(null)}
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

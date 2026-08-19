"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mergeSession } from "@/services/api/mergeSession";
import {
  fetchIdealText,
  saveIdealUserEdit,
  type DecisionHistoryEntry,
  type DocumentSuggestion,
  type Addition,
  type IdealPiece,
  type IdealText,
  type KeyPoint,
} from "@/services/api/idealText";
import { sendSuggestionFeedback } from "@/services/api/suggestionFeedback";
import { decideBlock, decidePriorTake } from "@/services/api/documentDecide";
import { applyAcceptedReplacements } from "@/lib/willab/trackedChanges";
import { swapPiece } from "@/services/api/pieceSwap";
import {
  fetchBlockVariants,
  selectBlockVariant,
  type BlockVariant,
  type VariantBlock,
} from "@/services/api/blockVariants";
import { BlockVariantSheet } from "./BlockVariantPicker";
import { PieceSwapSheet } from "./PieceBadges";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import { useArcDeckRef } from "./useArcDeckRef";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import MarkedParagraphs from "./MarkedParagraphs";
import IdealTextHeading from "./IdealTextHeading";
import OverlayCloseButton from "./OverlayCloseButton";
import ProcessingWait from "./ProcessingWait";
import AdditionsPanel from "./AdditionsPanel";
import { setPartLock } from "@/services/api/partLock";
import {
  autoLockTouched,
  lockTargetAt,
  partsToText,
  reconcileParts,
  updatePart,
  type Part,
} from "@/lib/willab/documentParts";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";
import IdealTextActions from "./IdealTextActions";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
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
  analysisPending = false,
}: {
  payload: ReadoutPayload;
  sessionId: string | null;
  /** The presentation this take belongs to — enables edit persistence (#214).
   *  null (guest / standalone upload) → edits stay local. */
  arcId?: string | null;
  signedIn: boolean | null;
  /** SPEC-lockin-loop §1 — the take's document is still assembling. While
   *  true this screen BLOCKS with the founder's "Working on your text" line
   *  instead of rendering the prior take's document as current (handoff §6.4
   *  S3-in-Lab); when it flips false the SD fetch re-runs and the fresh
   *  document swaps in. */
  analysisPending?: boolean;
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
  const { reload: reloadLounge } = useLoungeThreadCtx();
  const composed = useMemo(() => composeIdealText(payload), [payload]);
  const [text, setText] = useState(composed);
  const [copied, setCopied] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const firedRef = useRef(false);
  // #214 — edit persistence: armed once the SD GET confirms the contract and
  // hands us the current version. Until then (flag OFF / guest) edits are
  // local-only, exactly the pre-#214 behavior.
  const versionRef = useRef<number | null>(null);
  // The document's parts, as last served or last saved. A REF: every save site
  // reads textRef, and identity has to be readable from the serialized save
  // chain without re-creating the callback.
  const partsRef = useRef<readonly Part[] | null>(null);
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
    /** Slice 2 — the post-lock style lane + the decided-proposal history. */
    styleChanges: DocumentSuggestion[] | null;
    decisionHistory: DecisionHistoryEntry[] | null;
    saved: boolean | null;
    keyPoints: KeyPoint[] | null;
    /** The arc's deck PDF (slide-per-paragraph read). Safe-ahead: null until
     *  the BE echoes presentation_ref; useArcDeckRef then falls back. */
    presentationRef: string | null;
    /** Slide titles by index — the deck's title slot. */
    slideTitles: string[] | null;
    /** The document's stored part ids (SPEC §3.1, Step 0). null → none
     *  stored; the arranger mints locally so a part has an id from its first
     *  render either way. */
    parts: Part[] | null;
    /** MATERIAL RECOVERY — words said on a slide the script has no block for. */
    additions: Addition[];
    /** T1 · 1.2 — the served text IS the student's edit. Drives the star
     *  fence below (an edited document carries no honest anchors). */
    userEdited: boolean;
    /** The BE's gate on a new official take. null (absent) never gates. */
    canRecordTake: boolean | null;
    takeCount: number | null;
    journeyNextStepsSeen: boolean | null;
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
  // 409 NOTHING_TO_EDIT — nothing is assembled yet, so the edit affordances
  // have nothing to act on and hide entirely.
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
    // SPEC-lockin-loop §1 (W4's rule, applied here) — a fetch during the
    // document phase would come back with the PRIOR take's document and this
    // screen would adopt it as current (handoff §6.4 S3-in-Lab: "fetches
    // instantly and never re-pulls"). Hold instead; the flip of
    // `analysisPending` re-runs this effect and fetches the fresh one.
    if (analysisPending) return;
    let active = true;
    const gen = ++sdGenRef.current;
    void fetchIdealText(arcId).then((r) => {
      if (!active || gen !== sdGenRef.current) return;
      if (r.kind === "single") {
        versionRef.current = r.version;
        // Adopt the server's identity for this document. null = none stored,
        // and the arranger mints locally on first render.
        partsRef.current = r.parts;
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
          styleChanges: r.styleChanges,
          decisionHistory: r.decisionHistory,
          saved: r.saved,
          keyPoints: r.keyPoints,
          presentationRef: r.presentationRef,
          slideTitles: r.slideTitles,
          parts: r.parts,
          additions: r.additions,
          userEdited: r.userEdited,
          canRecordTake: r.canRecordTake,
          takeCount: r.takeCount,
          journeyNextStepsSeen: r.journeyNextStepsSeen,
        });
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
  }, [signedIn, arcId, analysisPending, sdNonce, refreshVariants]);

  // #214 — debounced save of a DIRTY edit (never the untouched composed text).
  // Each chained save reads textRef at execution, so the newest words always
  // land last; "Edit saved." shows only when the SAVED text is still the
  // current text (a newer pending edit keeps the status quiet — R-ue3).
  //
  // T1 · 1.2 — VERSION_SUPERSEDED is no longer retried against the server's
  // current version. That retry re-sent pre-take words over the text a
  // just-landed take had assembled. Now: hold the words, adopt the new
  // version, offer the words back. Nothing dropped, nothing clobbered.
  // PARTS (SPEC §3.1, Step 0) — the document's identity, reconciled against
  // the EXACT text about to be sent. Every save site reads textRef, which a
  // late keystroke can move after the arranger computed its list; deriving
  // here rather than storing a list means text and parts can never disagree,
  // which is what the BE refuses the pair for.
  //
  // Reconcile (not re-split) so a paragraph the student did not touch KEEPS
  // its id — those ids are what PR 3 hangs locks on.
  const partsFor = useCallback((t: string): Part[] => {
    // AUTO-LOCK ("typed = committed"): the parts this edit touched go up
    // locked, judged against the last served/saved baseline. The BE pins
    // locked paragraphs across takes, which is what retired the
    // superseded-edit card.
    const next = autoLockTouched(
      reconcileParts(t, partsRef.current ?? []),
      partsRef.current
    );
    partsRef.current = next;
    return next;
  }, []);

  const enqueueSave = useCallback(
    (aid: string) => {
      chainRef.current = chainRef.current.then(async () => {
        const t = textRef.current;
        if (savedTextRef.current === t) return;
        // The exact document the BE already refused — don't re-send it on
        // every keystroke. Any other words get a fresh attempt.
        if (invalidTextRef.current === t) return;
        const r = await saveIdealUserEdit(aid, t, versionRef.current, { parts: partsFor(t) });
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
          // A take landed mid-edit. The refetch below returns the COMPOSED
          // document — typed paragraphs arrive pinned inside it — so there
          // is nothing to hold and offer back.
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
          // Nothing is assembled — there is no document to write into. Stop
          // retrying; the lock modal reports the refusal to whoever asked.
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
    [markDirty, partsFor, refreshVariants]
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
        void saveIdealUserEdit(aid, textRef.current, versionRef.current, {
          parts: partsFor(textRef.current),
        });
      }
    },
    [partsFor]
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
            s.takeSessionId,
            { quote: s.quote, proposedText: s.proposedText, whyKey: s.why }
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
          // PROPOSAL HISTORY (slice 2) — the ledger keeps the texts.
          quote: s.quote,
          proposedText: s.proposedText,
          whyKey: s.why,
          source: s.source === "coach_revision" ? "coach_revision" : undefined,
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

  const undoTracked = useCallback(
    async (s: DocumentSuggestion): Promise<boolean> => {
      if (s.source === "new_take" || s.source === "prior_take") return false;
      if (!s.snippetId || !s.takeSessionId) return false;
      const result = await sendSuggestionFeedback({
        snippetId: s.snippetId,
        sessionId: s.takeSessionId,
        target: s.kind === "bold" ? "document_bold" : "document_replace",
        action: "reverted",
        suggestionId: s.id,
        quote: s.quote,
        proposedText: s.proposedText,
        whyKey: s.why,
        source: s.source === "coach_revision" ? "coach_revision" : undefined,
      });
      if (!result.saved) return false;
      sdGenRef.current++;
      setSdNonce((n) => n + 1);
      return true;
    },
    []
  );

  // SLIDES — the arc's deck, for the slide-per-paragraph reading view.
  const deckRef = useArcDeckRef(arcId, sd?.presentationRef ?? null, sdSettled);

  // Founder 2026-08-11 — the polish-star bulk lane, the per-star taps and
  // the key-point tint retired with the stars; proposals decide one at a
  // time in the deck's REVIEW modal.

  // The one edit path — a keystroke, a toolbar wrap, an add or a move: mark
  // dirty, reset the save flash, update the text (the debounce effect
  // persists it). Add/move go through here too, so the whole joined document
  // rides the same single save lane.
  // SPEC §4 — lock or unlock one section. The ECHO is the document currently
  // on screen: a lock is a claim about SPECIFIC WORDS, and the server refuses
  // one made against a document that has moved (a take assembled, the coach
  // verified) rather than settling a paragraph the student never read.
  // SPEC-lockin-loop §2 — the "Lock in" tap from the decide popover,
  // addressed by rendered paragraph index. Resolution happens AT TAP TIME
  // against the words on screen: the parts are re-derived from the current
  // text (ids kept where words match), the index→part claim is verified
  // (lockTargetAt refuses a mismatch rather than guessing), and the echo
  // lets the server refuse a document that moved. `seedParts` covers the
  // never-manually-edited document, which has no server-stored identity.
  const lockParagraph = useCallback(
    async (
      at: number,
      paragraphText: string
    ): Promise<"ok" | "blocked" | "failed"> => {
      const aid = arcIdRef.current;
      if (!aid) return "failed";
      const parts = reconcileParts(textRef.current, partsRef.current ?? []);
      partsRef.current = parts;
      const target = lockTargetAt(parts, at, paragraphText);
      if (!target) return "failed";
      if (target.locked) return "ok"; // already settled — nothing to write
      const r = await setPartLock(aid, target.id, true, textRef.current, {
        seedParts: parts,
      });
      if (r.kind === "undecided") return "blocked";
      if (r.kind === "stale") {
        sdGenRef.current++;
        setSdNonce((n) => n + 1);
        return "failed";
      }
      if (r.kind === "error") return "failed";
      partsRef.current = (partsRef.current ?? []).map((p) =>
        p.id === target.id ? { ...p, locked: true } : p
      );
      // Refetch so the layer filter sees the lock — open offers on this
      // paragraph stop being served, which the student just asked for.
      setSdNonce((n) => n + 1);
      return "ok";
    },
    []
  );

  // MATERIAL RECOVERY — accept promotes the candidate block into the master
  // document; "Not now" deletes the offer, and the same words may honestly be
  // offered again if said in a later take. Both route through the block decide
  // endpoint the upgrade lane already uses.
  const decideAddition = useCallback(
    async (addition: Addition, accept: boolean): Promise<boolean> => {
      const aid = arcIdRef.current;
      if (!aid) return false;
      const r = await decideBlock(
        aid,
        addition.blockKey,
        accept ? "accept" : "keep",
        addition.takeSessionId
      );
      if (r.kind === "error") return false;
      // Stale counts as handled: a newer take moved the offer, and the refetch
      // brings whatever replaced it.
      sdGenRef.current++;
      setSdNonce((n) => n + 1);
      return true;
    },
    []
  );

  const applyEdit = useCallback(
    (next: string, parts?: readonly Part[] | null) => {
      markDirty(true);
      setSaveState("idle");
      setText(next);
      // THE LOCK-AFTER-EDIT BUG (founder 2026-08-15: "when I have edited the
      // text after the styling and I am trying to lock it in, it doesnt lock
      // in").
      //
      // `textRef` was written in exactly ONE place — the render body — so it
      // did not exist yet as far as this call's own caller was concerned.
      // `deckLockPart` calls applyEdit and then flushEdits on the very next
      // line, and every save site reads textRef, so the whole lane ran on the
      // PRE-EDIT document:
      //
      //   • flushEdits's fast path compares savedTextRef to textRef. On a
      //     freshly served document those two are the SAME string (the adopt
      //     sets them together), so the guard read "already saved", returned
      //     true without sending anything, and deckLockPart reported "ok";
      //   • deckLockPart then cleared the dirty flag — which is the only
      //     thing keeping the 800ms debounce alive — and refetched, so the
      //     server's text came back over the student's words;
      //   • and the auto-lock that was supposed to ride that same PUT
      //     ("typed = committed") never happened, because the PUT never
      //     happened. The chunk came back unlocked, wearing its old words.
      //
      // Styling made it visible rather than causing it: applyStyle nulls
      // savedTextRef and refetches, so a lock landing before that refetch took
      // the other branch — enqueueSave ran and PUT the stale pre-edit
      // document, reporting success over words the student never wrote.
      //
      // So the ref moves WITH the state, on the same line as its peer below.
      // partsRef was always updated synchronously here; textRef being the odd
      // one out is the entire defect. The render-body assignment stays as the
      // backstop and simply re-asserts the same string.
      textRef.current = next;
      // The arranger already carried ids through the operation — adopt them
      // so the save lane does not have to re-derive identity from position,
      // which is the one thing a reorder makes impossible.
      if (parts) partsRef.current = parts;
    },
    [markDirty]
  );

  // THE STYLE LANE (slice 2): apply a post-lock emphasis. Outside the ≤3
  // budget — styleLane marks the ledger row lane:style, which the spend
  // counter excludes. The fold bakes server-side; the refetch brings it in.
  const applyStyle = useCallback(
    async (s: DocumentSuggestion): Promise<boolean> => {
      if (!s.snippetId || !s.takeSessionId) return false;
      const r = await sendSuggestionFeedback({
        snippetId: s.snippetId,
        sessionId: s.takeSessionId,
        target: "document_bold",
        action: "applied",
        suggestionId: s.id,
        quote: s.quote,
        whyKey: s.why,
        styleLane: true,
      });
      if (!r.saved) return false;
      setSd((prev) =>
        prev
          ? {
              ...prev,
              styleChanges: (prev.styleChanges ?? []).map((x) =>
                x.id === s.id ? { ...x, status: "approved" as const } : x
              ),
            }
          : prev
      );
      markDirty(false);
      savedTextRef.current = null;
      sdGenRef.current++;
      setSdNonce((n) => n + 1);
      return true;
    },
    [markDirty]
  );

  // THE DECK's lock (slice 1a): commit the modal's draft when it changed —
  // the edit rides the one save lane (auto-lock "typed = committed" marks
  // the touched part locked in the same PUT) and the flush confirms it —
  // else the plain part-lock with seeding.

  /* UNDO A LOCK (founder 2026-08-15) — "Discard" on a locked chunk.
   *
   * The exact inverse of `lockParagraph`, and deliberately a mirror of it
   * rather than a new path: same identity resolution (position + words via
   * `lockTargetAt`, never the part id — see the note there), same stale
   * handling, same refetch. Only the boolean flips.
   *
   * `seedParts` is NOT sent. Seeding exists so a first lock can adopt a
   * client-minted identity on a document the server has no parts for; a
   * chunk that is already locked is proof the server has that identity
   * stored, so there is nothing to seed and nothing to adopt.
   *
   * Refetches for the same reason the lock does, in reverse: an unlocked
   * paragraph becomes eligible for offers again, and the layer filter has to
   * be told. */
  const unlockParagraph = useCallback(
    async (chunk: DeckChunk): Promise<"ok" | "blocked" | "failed"> => {
      const aid = arcIdRef.current;
      if (!aid) return "failed";
      const parts = reconcileParts(textRef.current, partsRef.current ?? []);
      partsRef.current = parts;
      const target = lockTargetAt(parts, chunk.paragraphIndex, chunk.part.text);
      if (!target) return "failed";
      if (!target.locked) return "ok"; // already open — nothing to write
      const r = await setPartLock(aid, target.id, false, textRef.current);
      if (r.kind === "stale") {
        sdGenRef.current++;
        setSdNonce((n) => n + 1);
        return "failed";
      }
      if (r.kind === "error" || r.kind === "undecided") return "failed";
      partsRef.current = (partsRef.current ?? []).map((pt) =>
        pt.id === target.id ? { ...pt, locked: false } : pt
      );
      setSdNonce((n) => n + 1);
      return "ok";
    },
    []
  );

  const deckLockPart = useCallback(
    async (
      chunk: DeckChunk,
      newText: string
    ): Promise<"ok" | "blocked" | "failed"> => {
      // BY POSITION + WORDS — see the note in IdealTextOverlay: a part id
      // minted by the deck cannot be found in a list this host minted
      // separately, which is what failed every lock on a document with no
      // stored parts.
      const at = chunk.paragraphIndex;
      const parts = reconcileParts(textRef.current, partsRef.current ?? []);
      partsRef.current = parts;
      if (at < 0 || at >= parts.length) return "failed";
      const trimmed = newText.trim();
      if (trimmed && trimmed !== chunk.part.text.trim()) {
        const next = updatePart(parts, at, trimmed);
        applyEdit(partsToText(next), next);
        const ok = await flushEdits();
        if (!ok) return "failed";
        // Saved AND auto-locked in the same PUT — the lane is settled, so
        // release it and re-pull (locks + fresh suggestions flow in).
        markDirty(false);
        setSdNonce((n) => n + 1);
        return "ok";
      }
      return lockParagraph(at, chunk.part.text);
    },
    [applyEdit, flushEdits, lockParagraph, markDirty]
  );

  const deckEditSlide = useCallback(
    async (edits: Array<{ chunk: DeckChunk; text: string }>): Promise<boolean> => {
      if (edits.length === 0) return true;
      let next = reconcileParts(textRef.current, partsRef.current ?? []);
      for (const { chunk, text } of edits) {
        const at = chunk.paragraphIndex;
        if (at < 0 || at >= next.length || !text.trim()) return false;
        next = updatePart(next, at, text.trim());
      }
      applyEdit(partsToText(next), next);
      const ok = await flushEdits();
      if (ok) {
        markDirty(false);
        setSdNonce((nonce) => nonce + 1);
      }
      return ok;
    },
    [applyEdit, flushEdits, markDirty]
  );

  // SPEC-lockin-loop §1 — THE BLOCKING SCREEN. While the document assembles
  // the old text is INACCESSIBLE: no reading it, no copying it, no editing
  // it — "no browse-with-banner". Only the way out stays, because the block
  // is on the text, not on leaving. When the settle probe clears the marker
  // the host flips `analysisPending`, the SD effect refetches, and the FRESH
  // document renders through the normal path below.
  //
  // NOTHING ELSE ON THE WAITING SCREEN (founder 2026-08-12: "that surface is
  // not necessary; it is the old button surfacing — please clear it so that
  // there is only one waiting screen without anything like that").
  //
  // A "Record the next take" button used to sit under the wait. It was added
  // on 2026-08-11 to answer "I can not just jump for the next take" — but the
  // real cause of that complaint was the stale-mic bug (the mic parked on
  // {status:"stopped"}, so entering lab_recording bounced straight back into
  // the waiting screen on the previous take's blob). That is fixed at the
  // source now, in LabOverlay: every entry cancels the mic first and the
  // stop→processing branch claims each blob once. With the door working, a
  // second door beside it is just the old surface showing through.
  //
  // The block itself stays: while the document assembles the old text is
  // INACCESSIBLE — no reading it, no copying it, no editing it, "no
  // browse-with-banner" (SPEC-lockin-loop §1). Only the way out remains,
  // because the block is on the text, not on leaving.
  if (analysisPending) {
    return (
      <div className="flex flex-1 flex-col">
        {onClose ? (
          <div className="flex items-center justify-end">
            <OverlayCloseButton onClick={onClose} />
          </div>
        ) : null}
        <div className="flex flex-1 flex-col items-center justify-start gap-6 pt-1 sm:pt-3">
          {/* THE SAME waiting screen the pipeline phase shows, and the ONLY
              thing on it. It was once its own "Working on your text" line,
              and that copy is deleted rather than kept as a variant — the
              wait is one wait, and a second waiting screen that still exists
              is one that comes back. */}
          <ProcessingWait markSize={36} />
        </div>
      </div>
    );
  }

  return (
    // `min-h-0` so the deck below can shrink into the space the header and
    // the actions leave — without it a flex child refuses to go under its
    // content height and the screen grows a second scroll.
    <div
      data-ideal-text-wheel-owner
      className="flex min-h-0 flex-1 flex-col gap-4 overscroll-none"
    >
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
          {/* NO EDIT PENCIL (founder 2026-08-11: "The edits should not be in
              the top bar"). This screen heads itself like the notebook does,
              and the notebook's pencils are gone: editing is a CHUNK act —
              click the chunk's lock, edit it in the modal. */}
          {onClose ? (
            <OverlayCloseButton onClick={onClose} className="ml-1" />
          ) : null}
        </div>
      </div>


      {/* Founder 2026-07-29 — the Full text / Key words toggle is retired:
          the readout always shows the full text. */}
      {signedIn && arcId && !sdSettled ? (
        // FE-3 — hold until the served text + its stars are in hand, so they
        // land together instead of the text rendering then stars popping in.
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          Putting your ideal text together…
        </p>
      ) : sd ? (
        // THE TRANSCRIPT REVIEW DECK (founder 2026-08-11) — replaces the
        // star/tracked/badged paragraph stack. A user-edited or mid-edit
        // document rides the same deck: its parts and locks are real; while
        // the local edit is DIRTY the served suggestion spans no longer
        // anchor this text, so none are painted until the save round-trips
        // (the same never-mispaint rule the old layer followed).
        // NO FRAME, NO CAP (founder 2026-08-11): the stroke and the 70vh
        // ceiling boxed the one thing on the page worth reading. The deck
        // owns its own snap-scrolling, so it takes the height it is given
        // and the text gets the room.
        // `min-h-0`, not a floor: the deck takes the height that is LEFT.
        // A minimum here is what pushed the page past the viewport and gave
        // the screen a second scroll (founder 2026-08-11).
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TranscriptReviewDeck
            chrome="stage"
            document={text}
            parts={partsRef.current ?? sd.parts}
            suggestions={dirty ? [] : (sd.suggestions ?? [])}
            pieceSlideIndexes={
              sd.pieces?.map((p) => p.slideIndex ?? null) ?? null
            }
            slideTitles={sd.slideTitles ?? undefined}
            presentationRef={deckRef}
            onAccept={(s) => decideTracked(s, "accept")}
            onUndoAccept={undoTracked}
            onKeepMine={(s) => decideTracked(s, "keep")}
            onLockPart={deckLockPart}
            onEditSlide={deckEditSlide}
            onUnlockPart={unlockParagraph}
            coachMoments={(sd.ideal.keyMoments ?? []).map((m) => ({
              snippetId: m.snippetId,
              anchor: m.anchor,
              hasExplanation: m.hasExplanation === true,
              reviewStatus: m.reviewStatus ?? null,
            }))}
            arcId={arcId}
            styleChanges={dirty ? [] : sd.styleChanges}
            decisionHistory={sd.decisionHistory}
            onApplyStyle={applyStyle}
          />
        </div>
      ) : (
        // FE-1 — this fallback (no SD payload: guest, or the flag off) used to
        // print `text` raw, markers and all. It is the same document, so it
        // gets the same renderer.
        <MarkedParagraphs text={text} textSizeClass="text-[17px]" />
      )}

      {/* MATERIAL RECOVERY — words the speaker SAID on a slide their script
          has no block for. Below the document, not inside it: there is nothing
          in the text to anchor to, which is exactly why forcing it into the
          tracked-change shape made it reach nobody. */}
      {sd && arcId && sd.additions.length > 0 ? (
        <AdditionsPanel
          additions={sd.additions}
          onDecide={decideAddition}
          textSizeClass="text-[17px]"
        />
      ) : null}

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
          takeCount={sd.takeCount}
          journeyNextStepsSeen={sd.journeyNextStepsSeen}
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
          onSeeNextSteps={() => {
            void reloadLounge();
            onClose?.();
          }}
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
    </div>
  );
}

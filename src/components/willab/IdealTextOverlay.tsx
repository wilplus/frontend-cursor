"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Lock,
  Presentation,
  Sparkles,
} from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import OverlayCloseButton from "./OverlayCloseButton";
import ProcessingWait from "./ProcessingWait";
import LoadingState from "./LoadingState";
import FeedbackOverlay from "./FeedbackOverlay";
import { useBackDismiss } from "./useBackDismiss";
import { RichText } from "./RichText";
import IdealTextHeading from "./IdealTextHeading";
import MarkedParagraphs from "./MarkedParagraphs";
import {
  type Addition,
  fetchIdealTextCore,
  fetchIdealTextEnrichment,
  fetchIdealTextForDisplay,
  mergeIdealTextEnrichment,
  saveIdealUserEdit,
  segmentIdealText,
  type DecisionHistoryEntry,
  type IdealKeyMomentLink,
  type DocumentSuggestion,
  type IdealPiece,
  type KeyPoint,
  type IdealText,
  type MomentSuggestion,
  type IdealTextResult,
} from "@/services/api/idealText";
import { sendSuggestionFeedback } from "@/services/api/suggestionFeedback";
import { decideBlock, decidePriorTake } from "@/services/api/documentDecide";
import { swapPiece } from "@/services/api/pieceSwap";
import {
  fetchBlockVariants,
  fetchIdealTextRevisions,
  restoreIdealTextRevision,
  selectBlockVariant,
  type BlockVariant,
  type IdealTextRevision,
  type VariantBlock,
} from "@/services/api/blockVariants";
import {
  BlockVariantSheet,
  RevisionTimelineSheet,
  TimelineEntryButton,
} from "./BlockVariantPicker";
import { PieceSwapSheet } from "./PieceBadges";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { useVisibleLearningExposure } from "@/hooks/useVisibleLearningExposure";
import type { LearningExposureHandle } from "@/services/api/learningExposures";
import type { LockResult } from "./DeckChunkModal";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import { useArcDeckRef } from "./useArcDeckRef";
import IdealTextActions from "./IdealTextActions";
import PresentMode from "./PresentMode";
import ExportFormatDialog from "./ExportFormatDialog";
import type { PresentationExportFormat } from "@/lib/willab/presentationDocument";
import AdditionsPanel from "./AdditionsPanel";
import {
  setPartLock,
  setPartRootPhrase,
  type RootPhraseSpan,
} from "@/services/api/partLock";
import {
  lockTargetAt,
  withPartRootPhrase,
  partsToText,
  reconcileParts,
  updatePart,
  type Part,
} from "@/lib/willab/documentParts";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";
import { useLoungeThreadCtx } from "./LoungeThreadContext";

/* -------------------------------------------------------------------------- */
/*  IdealTextOverlay — the user's ideal-text NOTEBOOK (delivery layer)         */
/*                                                                            */
/*  The purple bubble's destination: the coach-approved one-block ideal text   */
/*  in a big, clean reading view. Bolded openings (coach key phrases),         */
/*  underlined key moments — tapping one asks "Go to this moment?" and         */
/*  deep-links into the feedback page anchored at that moment. Copy + Edit;    */
/*  edits save to the user's PERSONAL copy (never the coach canonical — L1).   */
/*  Paywalled: locked (402) renders the unlock panel; pending = coach still    */
/*  working.                                                                   */
/* -------------------------------------------------------------------------- */

export type IdealTextLaunchMode = "notebook" | "presentation" | "export";

export default function IdealTextOverlay({
  arcId,
  analysisPending = false,
  initialMode = "notebook",
  onClose,
  onReadAloud,
}: {
  arcId: string;
  /** W4/W5 — true while a take for this arc is still analysing. While true
   *  the overlay shows its LOADING state instead of fetching (a fetch now
   *  would return LAST take's document and render it as if it were this
   *  take's); when it flips false the overlay fetches fresh. This is the
   *  routing half of the lifecycle lock: the old behaviour was a silent
   *  no-op tap in the Lounge, which enforced the order but led nowhere. */
  analysisPending?: boolean;
  /** Chat completion actions can open the same document directly in its
   *  read-only delivery or export surface. */
  initialMode?: IdealTextLaunchMode;
  onClose: () => void;
  /** The host closes this overlay into the record flow for the NEXT official
   *  take of this presentation. Receives the current version as a take-count
   *  hint for the arc seed. Optional: without it the CTA hides.
   *  (Named for the retired "read it aloud" lane; it is the next-take route
   *  now — kept as-is so the two call sites don't churn.) */
  onReadAloud?: (version: number | null) => void;
}) {
  // D-3 invariant — the device Back gesture closes THIS overlay (LIFO with the
  // nested FeedbackOverlay, which pushes its own entry on top).
  useBackDismiss(onClose);
  // Founder 2026-07-29 — the notebook is ALWAYS the live, editable document.
  // The old "historical" read-only step (FE-3b, ?version) is gone: a version
  // bubble is a history marker, not a frozen destination.
  const [status, setStatus] = useState<
    "loading" | "ready" | "instant" | "pending" | "error"
  >("loading");
  const [ideal, setIdeal] = useState<IdealText | null>(null);
  const [refetchNonce, setRefetchNonce] = useState(0);
  // Staleness fence for the GET (same rule as the readout, review R-db4).
  const fetchGenRef = useRef(0);
  /** The arc we are currently HOLDING a document for. Distinguishes a first
   *  load (nothing on screen — the loader is honest) from a refetch of the
   *  document already showing (it must not blank). Keyed by arc, so opening a
   *  different project still gets its loader. */
  const loadedArcRef = useRef<string | null>(null);
  // SD (single-deliverable) — the living-document state: verification status,
  // version, and whether the moments unlock has run.
  // Voice Album is a separate personal surface, outside project editing.
  const { reload: reloadLounge } = useLoungeThreadCtx();
  const [sd, setSd] = useState<{
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
     *  stored, and the arranger mints locally so a part has an id from its
     *  first render either way. */
    parts: Part[] | null;
    /** MATERIAL RECOVERY — words said on a slide the script has no block for. */
    additions: Addition[];
    /** T1 · 1.2 — the served text IS the student's edit → no star layer. */
    userEdited: boolean;
    /** The BE's gate on a new official take. null (absent) never gates. */
    canRecordTake: boolean | null;
    takeCount: number | null;
    journeyNextStepsSeen: boolean | null;
    learningExposures: LearningExposureHandle[];
  } | null>(null);

  useVisibleLearningExposure({
    handles: sd?.learningExposures ?? [],
    visibilityKey: `ideal-text:${arcId}:${sd?.version ?? "unknown"}`,
    enabled: status === "ready" && ideal !== null && sd !== null,
  });
  // DISCERNMENT — the pending-swap comparison sheet's open piece.
  const [swapOpen, setSwapOpen] = useState<IdealPiece | null>(null);
  // BLOCK_VARIANTS — the picker pool, the revision timeline, and their open
  // sheets. null = feature off (the GET 404s) / not loaded: nothing new
  // renders anywhere.
  const [variantBlocks, setVariantBlocks] = useState<VariantBlock[] | null>(
    null,
  );
  const [revisions, setRevisions] = useState<IdealTextRevision[] | null>(null);
  const [pickerBlock, setPickerBlock] = useState<VariantBlock | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  // Staleness fence for the variants/revisions GETs (same rule as the
  // document GET): a select/restore bumps the generation so an in-flight
  // pre-write read can never land on top of the post-write pool.
  const variantsGenRef = useRef(0);

  /** BLOCK_VARIANTS — pull the picker pool, then the timeline, AFTER the
   *  document GET (§5 refetch order). 404 = feature off → clear (render
   *  nothing new, never an error). A read FAILURE keeps the previous pool:
   *  the pool is append-only so every id in it stays valid, and an empty
   *  picker would lie (§4.1). */
  const refreshVariants = useCallback(() => {
    const gen = ++variantsGenRef.current;
    void fetchBlockVariants(arcId).then((v) => {
      if (gen !== variantsGenRef.current) return;
      if (v.kind === "off") {
        setVariantBlocks(null);
        setRevisions(null);
        return;
      }
      if (v.kind !== "ready") return;
      setVariantBlocks(v.blocks);
      void fetchIdealTextRevisions(arcId).then((rv) => {
        if (gen !== variantsGenRef.current) return;
        if (rv.kind === "ready") setRevisions(rv.revisions);
        else if (rv.kind === "off") setRevisions(null);
      });
    });
  }, [arcId]);

  // A different arc = a fresh pool; nothing renders until ITS reads land.
  useEffect(() => {
    variantsGenRef.current++;
    setVariantBlocks(null);
    setRevisions(null);
    setPickerBlock(null);
    setTimelineOpen(false);
  }, [arcId]);
  // Notebook state: the personal copy wins for display once saved.
  const [notes, setNotes] = useState<string | null>(null);
  // PRESENT MODE (founder 2026-08-05) — the fullscreen, X-only,
  // scroll-through-the-deck read. Read-only; recording stays in the Lab.
  const [presenting, setPresenting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportChooserOpen, setExportChooserOpen] = useState(false);
  const [exportFormat, setExportFormat] =
    useState<PresentationExportFormat | null>(null);
  const initialModeAppliedRef = useRef(false);
  useEffect(() => {
    initialModeAppliedRef.current = false;
    setPresenting(false);
    setExporting(false);
    setExportChooserOpen(false);
    setExportFormat(null);
  }, [arcId, initialMode]);
  useEffect(() => {
    if (
      initialModeAppliedRef.current ||
      !sd ||
      (status !== "ready" && status !== "instant")
    )
      return;
    initialModeAppliedRef.current = true;
    if (initialMode === "presentation") setPresenting(true);
    if (initialMode === "export") setExportChooserOpen(true);
  }, [initialMode, sd, status]);
  const [tooLong, setTooLong] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // The version every PUT is stamped with, advanced SYNCHRONOUSLY on each
  // answer so a queued second save can never re-send the version the first
  // one just consumed. Armed by the SD fetch; until then there is nothing to
  // stamp and no edit may persist.
  const versionRef = useRef<number | null>(null);
  const versionArmedRef = useRef(false);
  // The document's parts, as last served or last saved. A REF, not state:
  // every write already re-renders through `sd`/`ideal`, and identity must be
  // readable by the serialized save chain without re-creating the callback
  // (which would let two quick arrangements capture different lists).
  const partsRef = useRef<readonly Part[] | null>(null);
  // Saves run one at a time (same rule as the readout's edit lane).
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    /* Founder 2026-07-30 — THE FULL-SCREEN LOADER IS FOR THE FIRST LOAD ONLY.
     *
     * This effect used to `setStatus("loading")` on every run, and it runs on
     * every `refetchNonce` bump. The read poll bumps that nonce every 3
     * SECONDS for as long as a reading is being analysed, so the whole
     * document was being wiped to a centred animation and restored, over and
     * over, while the user sat on "Finishing up your reading…". The only
     * loading state that flow is allowed is that small line at the bottom.
     *
     * So: the loader shows when there is genuinely nothing to show — a
     * different document, or this one before its first payload. A refetch of
     * the document already on screen leaves it there and swaps the text only
     * once the new payload is fully in hand, which is also what stops the
     * reader losing their place mid-paragraph. */
    const firstLoad = loadedArcRef.current !== arcId;
    if (firstLoad) setStatus("loading");
    // W4 — a fetch during analysis would come back with LAST take's document
    // and show it as current. Hold in the loading state instead; this effect
    // re-runs when `analysisPending` flips false and fetches the fresh one.
    // W5 falls out of the same dependency: if the analysis completes while
    // the document is OPEN, the flip triggers a refetch of the new version
    // (which, per the first-load rule above, swaps in place — no blank).
    if (analysisPending) {
      if (firstLoad) loadedArcRef.current = null;
      return;
    }
    const gen = ++fetchGenRef.current;
    const read = firstLoad ? fetchIdealTextForDisplay : fetchIdealTextCore;
    const applySingle = (
      r: Extract<IdealTextResult, { kind: "single" }>,
      refreshDocumentVariants: boolean,
    ) => {
      setIdeal(r.ideal);
      setNotes(null);
      setSd({
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
        learningExposures: r.learningExposures,
      });
      versionRef.current = r.version;
      versionArmedRef.current = true;
      partsRef.current = r.parts ?? reconcileParts(r.ideal.text);
      setStatus("ready");
      if (refreshDocumentVariants) {
        refreshVariants();
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => {
            performance.mark("willab.ideal_text.core_painted");
          });
        }
      }
    };
    void read(arcId).then(async (r) => {
      if (!active || gen !== fetchGenRef.current) return;
      /* A REFETCH that did not come back with a document keeps the one we are
       * already showing. Replacing a good document with "couldn't load this"
       * because one poll tick lost the network is the same wipe as above,
       * wearing a different word — and the next tick is three seconds away.
       * On a first load there is nothing to protect, so the honest failure
       * shows exactly as before. */
      const usable =
        r.kind === "single" || r.kind === "ready" || r.kind === "instant";
      if (!firstLoad && !usable) return;
      if (r.kind === "historical" || r.kind === "historicalUnavailable") {
        // Unreachable without a ?version request; keep the load honest.
        setStatus("error");
        return;
      }
      if (usable) loadedArcRef.current = arcId;
      if (r.kind === "single") {
        // Paint the immutable core first. Optional feedback and controls are
        // attached only when they return for this exact snapshot.
        applySingle(r, true);
        if (r.documentSnapshotId) {
          const enrichment = await fetchIdealTextEnrichment(
            arcId,
            r.documentSnapshotId,
          );
          if (!active || gen !== fetchGenRef.current) return;
          if (enrichment.kind === "ready") {
            let merged = mergeIdealTextEnrichment(r, enrichment);
            applySingle(merged, false);
            const retryable = Object.entries(enrichment.sections)
              .filter(([, section]) => section.retryable)
              .map(([name]) => name);
            if (retryable.length) {
              const retry = await fetchIdealTextEnrichment(
                arcId,
                r.documentSnapshotId,
                retryable,
              );
              if (!active || gen !== fetchGenRef.current) return;
              if (retry.kind === "ready") {
                merged = mergeIdealTextEnrichment(merged, retry);
                applySingle(merged, false);
              }
            }
          } else if (enrichment.kind === "stale") {
            // Never mix revisions. Pull the new core while keeping the
            // already-painted document visible until it arrives.
            setRefetchNonce((value) => value + 1);
            return;
          }
        }
      } else if (r.kind === "ready") {
        setIdeal(r.ideal);
        setNotes(r.ideal.notes);
        setStatus("ready");
      } else if (r.kind === "instant") {
        // The free machine draft — same reading view plus the polishing banner;
        // no personal-notes editing (that stays a perfected-lane feature).
        setIdeal(r.ideal);
        setNotes(null);
        setStatus("instant");
      } else {
        setStatus(r.kind);
      }
    });
    return () => {
      active = false;
    };
  }, [arcId, analysisPending, refetchNonce, refreshVariants]);

  const displayText = notes ?? ideal?.text ?? "";

  /** T1 · 1.2 — persist the WHOLE resulting document after an add, a move, a
   *  removal or a textarea edit. The document renders first (optimistically)
   *  and the server answer only ever reconciles it, so the student never
   *  waits on a round trip to see their own words.
   *
   *  VERSION_SUPERSEDED is NOT retried against the new version: a take landed
   *  while they were editing, so we adopt the fresh text and HOLD their words
   *  for a one-tap re-apply. Resolves true when the words are safe (saved, or
   *  held for re-apply), false when the caller should keep its editor open. */
  // SPEC §4 — lock or unlock one section. The echo is the document on screen:
  // a lock is a claim about SPECIFIC WORDS, and the server refuses one made
  // against a document that has moved rather than settling a paragraph the
  // student never read.
  const toggleLock = useCallback(
    async (
      part: Part,
      locked: boolean,
    ): Promise<"ok" | "blocked" | "failed"> => {
      const r = await setPartLock(arcId, part.id, locked, displayText);
      if (r.kind === "undecided") return "blocked";
      if (r.kind === "error") return "failed";
      if (r.kind === "stale") {
        setRefetchNonce((n) => n + 1);
        return "failed";
      }
      partsRef.current = (partsRef.current ?? []).map((p) =>
        p.id === part.id ? { ...p, locked } : p,
      );
      setRefetchNonce((n) => n + 1);
      return "ok";
    },
    [arcId, displayText],
  );

  // SPEC-lockin-loop §2 — the Accept→"Lock it" tap, addressed by rendered
  // paragraph index. Resolved AT TAP TIME against the words on screen
  // (lockTargetAt refuses a mismatch rather than guessing); `seedParts`
  // covers the DoD flow, where a student who never manually edited has no
  // server-stored identity to lock against.
  const lockParagraph = useCallback(
    async (at: number, paragraphText: string): Promise<LockResult> => {
      const parts = reconcileParts(displayText, partsRef.current ?? []);
      partsRef.current = parts;
      const target = lockTargetAt(parts, at, paragraphText);
      if (!target) return { outcome: "failed", rootPhraseProposal: null };
      const r = await setPartLock(arcId, target.id, true, displayText, {
        seedParts: parts,
      });
      if (r.kind === "undecided") {
        return { outcome: "blocked", rootPhraseProposal: null };
      }
      if (r.kind === "stale") {
        setRefetchNonce((n) => n + 1);
        return { outcome: "failed", rootPhraseProposal: null };
      }
      if (r.kind === "error") {
        return { outcome: "failed", rootPhraseProposal: null };
      }
      partsRef.current = (partsRef.current ?? []).map((p) =>
        p.id === target.id ? { ...p, locked: true } : p,
      );
      // Refetch so the layer filter sees the lock — open offers on this
      // paragraph stop being served, which the student just asked for.
      setRefetchNonce((n) => n + 1);
      return { outcome: "ok", rootPhraseProposal: r.rootPhraseProposal };
    },
    [arcId, displayText],
  );

  /* UNDO A LOCK (founder 2026-08-15) — "Discard" on a locked chunk.
   *
   * The exact inverse of `lockParagraph` above, and deliberately a mirror of
   * it rather than a new path: same identity resolution (position + words via
   * `lockTargetAt`, never the part id), same stale handling, same refetch.
   * Only the boolean flips.
   *
   * `seedParts` is NOT sent. Seeding exists so a FIRST lock can adopt a
   * client-minted identity on a document the server has no parts for; a chunk
   * that is already locked proves the server holds that identity, so there is
   * nothing to seed. */
  const unlockParagraph = useCallback(
    async (chunk: DeckChunk): Promise<"ok" | "blocked" | "failed"> => {
      const parts = reconcileParts(displayText, partsRef.current ?? []);
      partsRef.current = parts;
      const target = lockTargetAt(parts, chunk.paragraphIndex, chunk.part.text);
      if (!target) return "failed";
      if (!target.locked) return "ok"; // already open — nothing to write
      const r = await setPartLock(arcId, target.id, false, displayText);
      if (r.kind === "stale") {
        setRefetchNonce((n) => n + 1);
        return "failed";
      }
      if (r.kind === "error" || r.kind === "undecided") return "failed";
      partsRef.current = (partsRef.current ?? []).map((p) =>
        p.id === target.id ? { ...p, locked: false } : p,
      );
      setRefetchNonce((n) => n + 1);
      return "ok";
    },
    [arcId, displayText],
  );

  // MATERIAL RECOVERY — accept promotes the candidate block into the master;
  // "Not now" drops the offer, and the same words may be offered again if said
  // in a later take. Routes through the block-decide endpoint already in use.
  const decideAddition = useCallback(
    async (addition: Addition, accept: boolean): Promise<boolean> => {
      const r = await decideBlock(
        arcId,
        addition.blockKey,
        accept ? "accept" : "keep",
        addition.takeSessionId,
      );
      if (r.kind === "error") return false;
      setRefetchNonce((n) => n + 1);
      return true;
    },
    [arcId],
  );

  const saveDocument = useCallback(
    async (
      next: string,
      nextParts?: readonly Part[] | null,
    ): Promise<boolean> => {
      if (!versionArmedRef.current) return false;
      // PARTS (SPEC §3.1, Step 0). The arranger hands its parts straight
      // through, ids intact. The TEXTAREA lane does not have any — so
      // reconcile against what we hold, which keeps the id of every paragraph
      // the student did not touch. Re-minting them all would discard the locks
      // PR 3 will hang on those ids, on paragraphs that never changed.
      // Editing and committing are separate decisions. A typed paragraph is
      // saved here but stays evolvable until the explicit post-feedback lock.
      const parts = reconcileParts(next, nextParts ?? partsRef.current ?? []);
      partsRef.current = parts;
      const before = ideal?.text ?? "";
      setIdeal((prev) => (prev ? { ...prev, text: next } : prev));
      setTooLong(false);
      setSaveFailed(false);
      // Serialized, and stamped from versionRef rather than sd.version: two
      // quick actions would otherwise race, and the second would arrive with
      // the version the FIRST one just consumed — a 409 that looks exactly
      // like a take landing when nothing of the sort happened.
      const run = chainRef.current.then(() =>
        saveIdealUserEdit(arcId, next, versionRef.current, { parts }),
      );
      chainRef.current = run.then(
        () => undefined,
        () => undefined,
      );
      const r = await run;
      if (r.ok) {
        versionRef.current = r.version ?? versionRef.current;
        setSd((prev) =>
          prev
            ? { ...prev, version: versionRef.current, userEdited: true }
            : prev,
        );
        // BLOCK_VARIANTS (§5) — a saved edit also lands block-level in the
        // pool, so the picker may have grown a "My edit" entry.
        refreshVariants();
        return true;
      }
      if (r.reason === "superseded") {
        // A take landed mid-edit. Under per-part persistence the refetch
        // below returns the COMPOSED document — the typed paragraphs arrive
        // pinned inside it — so there is nothing to hold and offer back.
        if (r.currentVersion !== null) versionRef.current = r.currentVersion;
        setSd((prev) =>
          prev ? { ...prev, version: versionRef.current } : prev,
        );
        fetchGenRef.current++; // fence any in-flight pre-supersede GET
        setRefetchNonce((n) => n + 1); // adopt the NEW version's text
        return true;
      }
      if (r.reason === "nothingToEdit") {
        // Nothing is assembled — there was no document to edit. Put back what
        // was on screen; the caller reports the refusal (there is no
        // header-level edit mode left to retire).
        setIdeal((prev) => (prev ? { ...prev, text: before } : prev));
        return false;
      }
      if (r.reason === "invalid") {
        setTooLong(true);
        return false; // the words stay on screen, unsaved
      }
      setSaveFailed(true);
      return false;
    },
    [arcId, ideal?.text, refreshVariants],
  );

  // THE DECK's lock: save the modal draft first when it changed, then call the
  // explicit paragraph-lock endpoint. Editing and committing are deliberately
  // separate transitions; both retain the same Paragraph identity.
  const deckLockPart = useCallback(
    async (chunk: DeckChunk, newText: string): Promise<LockResult> => {
      // BY POSITION + WORDS, never by part id. The deck derives identity from
      // the SERVED parts and this host from whatever it last held; when the
      // backend has none stored — every document never manually edited — the
      // two mint independent uuids and an id lookup here can never match.
      // That is what failed every lock on a fresh arc. The index is provable
      // (both splits are the same scanner over the same string) and
      // lockParagraph re-verifies the words before it writes.
      const at = chunk.paragraphIndex;
      const trimmed = newText.trim();
      if (trimmed && trimmed !== chunk.part.text.trim()) {
        const parts = reconcileParts(displayText, partsRef.current ?? []);
        partsRef.current = parts;
        if (at < 0 || at >= parts.length) {
          return { outcome: "failed", rootPhraseProposal: null };
        }
        const next = updatePart(parts, at, trimmed);
        const nextText = partsToText(next);
        const ok = await saveDocument(nextText, next);
        if (!ok) return { outcome: "failed", rootPhraseProposal: null };
        const target = next[at];
        const result = await setPartLock(arcId, target.id, true, nextText, {
          seedParts: next,
        });
        if (result.kind === "undecided") {
          return { outcome: "blocked", rootPhraseProposal: null };
        }
        if (result.kind !== "ok") {
          if (result.kind === "stale") setRefetchNonce((n) => n + 1);
          return { outcome: "failed", rootPhraseProposal: null };
        }
        partsRef.current = next.map((part) =>
          part.id === target.id ? { ...part, locked: true } : part,
        );
        setRefetchNonce((n) => n + 1);
        return {
          outcome: "ok",
          rootPhraseProposal: result.rootPhraseProposal,
        };
      }
      return lockParagraph(at, chunk.part.text);
    },
    [arcId, displayText, saveDocument, lockParagraph],
  );

  const deckKeepEvolving = useCallback(
    async (
      chunk: DeckChunk,
      newText: string,
    ): Promise<"ok" | "blocked" | "failed"> => {
      const at = chunk.paragraphIndex;
      let next = reconcileParts(displayText, partsRef.current ?? []);
      if (at < 0 || at >= next.length) return "failed";
      const trimmed = newText.trim();
      if (!trimmed) return "failed";
      if (trimmed !== next[at].text.trim()) {
        next = updatePart(next, at, trimmed);
        if (!(await saveDocument(partsToText(next), next))) return "failed";
      }
      const textEcho = partsToText(next);
      const target = next[at];
      const result = await setPartLock(arcId, target.id, false, textEcho, {
        reason: "keep_evolving",
      });
      if (result.kind !== "ok") {
        if (result.kind === "stale") setRefetchNonce((n) => n + 1);
        return "failed";
      }
      partsRef.current = next.map((part) =>
        part.id === target.id
          ? {
              ...part,
              locked: false,
              rootPhrase: null,
              rootStart: null,
              rootEnd: null,
            }
          : part,
      );
      setRefetchNonce((n) => n + 1);
      return "ok";
    },
    [arcId, displayText, saveDocument],
  );

  const deckSetRootPhrase = useCallback(
    async (
      chunk: DeckChunk,
      phrase: RootPhraseSpan | null,
    ): Promise<boolean> => {
      const parts = reconcileParts(displayText, partsRef.current ?? []);
      const target = parts[chunk.paragraphIndex];
      if (!target) return false;
      const ok = await setPartRootPhrase(arcId, target.id, displayText, phrase);
      if (!ok) return false;
      const nextParts = withPartRootPhrase(parts, target.id, phrase);
      partsRef.current = nextParts;
      // Refetch remains the reconciliation path, but the server-confirmed
      // choice is projected into the rendered state in the same interaction.
      setSd((prev) => (prev ? { ...prev, parts: nextParts } : prev));
      setRefetchNonce((n) => n + 1);
      return true;
    },
    [arcId, displayText],
  );

  const deckEditSlide = useCallback(
    async (
      edits: Array<{ chunk: DeckChunk; text: string }>,
    ): Promise<boolean> => {
      if (edits.length === 0) return true;
      let next = reconcileParts(displayText, partsRef.current ?? []);
      for (const { chunk, text } of edits) {
        const at = chunk.paragraphIndex;
        if (at < 0 || at >= next.length || !text.trim()) return false;
        next = updatePart(next, at, text.trim());
      }
      return saveDocument(partsToText(next), next);
    },
    [displayText, saveDocument],
  );

  /** BLOCK_VARIANTS — pick one variant for one block (fear 3: mix & match).
   *  Non-destructive always (the displaced text heals back into the pool),
   *  silent by design (no bubble — the student did it themselves, in place):
   *  the refetch is the update. ok/gone/stale all close the sheet and
   *  refetch in §5 order; only a transport failure keeps it open on the
   *  retry line. */
  const selectVariant = useCallback(
    async (block: VariantBlock, variant: BlockVariant): Promise<boolean> => {
      // Display-only rows never render a select button; belt-and-braces.
      if (block.blockKey === null || !variant.variantId) return true;
      const r = await selectBlockVariant(
        arcId,
        block.blockKey,
        variant.variantId,
      );
      if (r.kind === "error") return false;
      setPickerBlock(null);
      // ok → the document reassembled synchronously inside the POST. gone /
      // stale → the pool changed under us (rare) — the same silent recovery,
      // never an error toast (§9). Either way: document GET first, then the
      // pool + timeline (the main effect chains them).
      fetchGenRef.current++;
      setRefetchNonce((n) => n + 1);
      return true;
    },
    [arcId],
  );

  /** BLOCK_VARIANTS — restore (fear 2): repoint the head at what `revision`
   *  recorded. The head that comes back is a NEW revision — restore is
   *  itself history, and itself undoable. Never presented as deletion. */
  const restoreRevision = useCallback(
    async (revision: number): Promise<boolean> => {
      const r = await restoreIdealTextRevision(arcId, revision);
      if (r.kind === "error") return false;
      setTimelineOpen(false);
      // gone (flag off / revision unknown) refetches silently too — the
      // timeline hides itself if the feature went away.
      fetchGenRef.current++;
      setRefetchNonce((n) => n + 1);
      return true;
    },
    [arcId],
  );

  // The held version to offer back: the BE's `prior_edit` once it ships, else
  // the local buffer from the supersede we just handled.

  // FE-3/4/5 — a tracked-change decision. Accept = the proposal becomes the
  // text; Keep mine = the suggestion is refused and never re-offered. Both
  // ride the existing per-snippet feedback POST (the ledger remembers them).
  const decideTracked = async (
    s: DocumentSuggestion,
    d: "accept" | "keep",
  ): Promise<boolean> => {
    const accept = d === "accept";
    // Route by SOURCE — each lane has its own decision endpoint (§2/§3); a
    // block upgrade posted to suggestion-feedback would never flip the block.
    let outcome: "ok" | "stale" | "error";
    if (s.source === "new_take") {
      if (s.blockKey === null || !s.takeSessionId) return false;
      outcome = (
        await decideBlock(
          arcId,
          s.blockKey,
          accept ? "accept" : "keep",
          s.takeSessionId,
          { quote: s.quote, proposedText: s.proposedText, whyKey: s.why },
        )
      ).kind;
    } else if (s.source === "prior_take") {
      outcome = (await decidePriorTake(arcId, s, accept ? "accept" : "keep"))
        .kind;
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
      });
      outcome = r.saved ? "ok" : "error";
    }
    if (outcome === "error") return false;
    // 409 STALE_OFFER / NOT_PENDING — silently refetch, treat as handled.
    if (outcome === "stale") {
      fetchGenRef.current++;
      setRefetchNonce((n) => n + 1);
      return true;
    }
    setSd((prev) =>
      prev
        ? {
            ...prev,
            suggestions: (prev.suggestions ?? []).map((x) =>
              x.id === s.id
                ? { ...x, status: accept ? "approved" : "dismissed" }
                : x,
            ),
          }
        : prev,
    );
    // An accept reassembles the document BE-side (version bump) — pull it.
    if (accept) {
      fetchGenRef.current++; // fence any in-flight pre-decision GET
      setRefetchNonce((n) => n + 1);
    }
    return true;
  };

  const undoTracked = async (s: DocumentSuggestion): Promise<boolean> => {
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
    fetchGenRef.current++;
    setRefetchNonce((n) => n + 1);
    return true;
  };

  // Legacy post-lock emphasis rows remain reversible for already-created
  // records. New root styling uses the explicit exact-span root endpoint.
  const applyStyle = async (s: DocumentSuggestion): Promise<boolean> => {
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
              x.id === s.id ? { ...x, status: "approved" as const } : x,
            ),
          }
        : prev,
    );
    fetchGenRef.current++;
    setRefetchNonce((n) => n + 1);
    return true;
  };

  // SLIDES — the arc's deck, for the slide-per-paragraph reading view.
  // Resolved only under SD (the legacy lanes have no piece structure to
  // attach slides to), after the GET settles.
  const deckRef = useArcDeckRef(
    arcId,
    sd?.presentationRef ?? null,
    status === "ready" && sd !== null,
  );

  // Founder 2026-08-11 — the whole star layer is gone: the bulk polish lane,
  // the per-star taps, the moment sheet and its folds. Feedback reaches the
  // student as chunk proposals in the deck, decided one at a time.

  function copyText() {
    void navigator.clipboard
      ?.writeText(stripRichMarkers(displayText))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      });
  }

  return (
    <div
      data-ideal-text-wheel-owner
      className="fixed inset-0 z-40 flex flex-col overscroll-none bg-background"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        {/* The project's name and its verification state, both from the shared
            head — the post-recording readout mounts the SAME one, so the two
            ideal-text screens cannot head themselves differently again. */}
        <IdealTextHeading title={sd?.title} status={sd ? sd.status : null} />
        <div className="flex items-center gap-2.5">
          {status === "ready" && sd ? (
            <>
              <button
                type="button"
                onClick={() => setPresenting(true)}
                aria-label="Use Presentation Mode"
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Presentation className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Presentation Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setExportChooserOpen(true)}
                aria-label="Export"
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Download className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Export</span>
              </button>
            </>
          ) : null}
          {/* BLOCK_VARIANTS — the timeline entry (§8.2). Only when the
              timeline has rows: an empty list is a real state (pre-migration
              arc) and hides it entirely (§4.3). */}
          {status === "ready" && sd && revisions && revisions.length > 0 ? (
            <TimelineEntryButton onOpen={() => setTimelineOpen(true)} />
          ) : null}
          {status === "ready" || status === "instant" ? (
            <button
              type="button"
              onClick={copyText}
              aria-label={copied ? "Copied" : "Copy the text"}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
          {/* NO EDIT PENCIL (founder 2026-08-11, verbatim: "The edits should
              not be in the top bar"). Editing a chunk is a CHUNK act now: you
              click the chunk's lock and edit it in the modal that opens, in
              front of the words you are changing. The two pencils that used to
              sit here — the chunked editor and the legacy personal-notes
              editor — opened a whole-document mode from a header button, which
              is a second, competing edit lane over the same text. Both are
              gone, and with them every branch they were the only entry to. */}
          <OverlayCloseButton onClick={onClose} />
        </div>
      </div>

      {status === "ready" && sd && ideal ? (
        // THE TRANSCRIPT REVIEW DECK (founder 2026-08-11) — replaces the
        // star/tracked/badged paragraph stack: chunk states + one lock per
        // chunk, REVIEW/EDITOR modals on the existing decide/lock lanes.
        // A user-edited document rides the same deck (its parts and locks
        // are real; there are simply no suggestions left to wait on).
        <div className="flex min-h-0 flex-1 flex-col">
          {tooLong ? (
            <p className="px-5 pt-3 text-[12px] leading-relaxed text-muted-foreground">
              {IDEAL_EDIT_COPY.tooLong}
            </p>
          ) : saveFailed ? (
            <p className="px-5 pt-3 text-[12px] leading-relaxed text-muted-foreground">
              Couldn&apos;t save your edit just now. It stays here; change
              something and it retries.
            </p>
          ) : null}
          <TranscriptReviewDeck
            chrome="stage"
            document={displayText}
            parts={sd.parts}
            suggestions={sd.suggestions ?? []}
            pieceSlideIndexes={
              sd.pieces?.map((p) => p.slideIndex ?? null) ?? null
            }
            slideTitles={sd.slideTitles ?? undefined}
            presentationRef={deckRef}
            onAccept={(s) => decideTracked(s, "accept")}
            onUndoAccept={undoTracked}
            onKeepMine={(s) => decideTracked(s, "keep")}
            onLockPart={deckLockPart}
            onKeepEvolving={deckKeepEvolving}
            onSetRootPhrase={deckSetRootPhrase}
            onEditSlide={deckEditSlide}
            onUnlockPart={unlockParagraph}
            coachMoments={(ideal?.keyMoments ?? []).map((m) => ({
              snippetId: m.snippetId,
              anchor: m.anchor,
              hasExplanation: m.hasExplanation === true,
              reviewStatus: m.reviewStatus ?? null,
            }))}
            arcId={arcId}
            styleChanges={sd.styleChanges}
            decisionHistory={sd.decisionHistory}
            onApplyStyle={applyStyle}
          />
          {/* MATERIAL RECOVERY — below the deck, same reasoning as before:
              nothing in the text to anchor to. */}
          {sd.additions.length > 0 ? (
            <div
              data-ideal-text-wheel-native
              className="max-h-[30vh] shrink-0 overflow-y-auto border-t border-border px-5 py-3"
            >
              <AdditionsPanel
                additions={sd.additions}
                onDecide={decideAddition}
                textSizeClass="text-[16px]"
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="scrollbar-none flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 py-8">
            {status === "loading" ? (
              analysisPending ? (
                // SPEC-lockin-loop §1 — THE BLOCKING SCREEN. This wait is not
                // an ordinary load: the old text is deliberately inaccessible
                // while the take's document assembles. It used to carry its own
                // "Working on your text" line; that copy is DELETED and both
                // phases of the wait now render the one waiting screen (founder
                // 2026-08-11), so the wait never changes its subject halfway
                // through. When the settle probe clears the marker,
                // `analysisPending` flips and the fetch effect pulls the fresh
                // document into this same view.
                <div className="flex flex-1 flex-col items-center justify-start pt-1 sm:pt-3">
                  <ProcessingWait
                    progress={{ stage: "document_assembly", percent: null }}
                  />
                </div>
              ) : (
                <LoadingState placement="surface" />
              )
            ) : status === "pending" ? (
              <p className="py-16 text-center text-[15px] leading-relaxed text-muted-foreground">
                Your coach is still shaping your ideal text. It lands here the
                moment it&apos;s approved.
              </p>
            ) : status === "error" ? (
              <p className="py-16 text-center text-[15px] leading-relaxed text-muted-foreground">
                Couldn&apos;t load your ideal text. Try again in a moment.
              </p>
            ) : status === "instant" && ideal ? (
              <div className="flex flex-col gap-5">
                {/* The persistent instant banner — this text is a free DRAFT the
                  machine assembled; the coach-perfected version replaces it
                  on this same screen once the coach approves it. */}
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                  <Sparkles
                    className="h-4 w-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <p className="text-[13px] leading-relaxed text-foreground">
                    Instant draft. Your coach is polishing the full version.
                  </p>
                </div>
                {/* The free machine draft: the words and their markers, and
                  nothing else. It used to carry the star layer; stars are
                  gone (founder 2026-08-11) and this lane has no decisions of
                  its own — the coach's version arrives on the deck. */}
                <MarkedParagraphs
                  text={displayText}
                  textSizeClass="text-[18px]"
                />
              </div>
            ) : ideal ? (
              <div className="flex flex-col gap-4">
                {/* The verification badge moved into the header (above) — a row
                  of its own was a band of vertical space for one word. */}
                {/* Founder 2026-08-11 — the star lane's Approve-all is retired
                  with the stars: every proposal now decides one at a time
                  through the deck's REVIEW modal. */}

                {tooLong ? (
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    {IDEAL_EDIT_COPY.tooLong}
                  </p>
                ) : saveFailed ? (
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    Couldn&apos;t save your edit just now. It stays here; change
                    something and it retries.
                  </p>
                ) : null}

                {/* Legacy (non-SD) payload — a plain, star-free read. The SD
                  lane renders the deck above; this fading lane keeps its
                  words and markers, nothing else (founder 2026-08-11: no
                  stars anywhere). */}
                <p className="whitespace-pre-line text-[18px] leading-relaxed text-foreground">
                  <RichText text={displayText} />
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* The PERSISTENT bottom control. Reading the text out loud used to sit
          here as a second, gated mic; it is retired (founder 2026-08-05 — it
          brought no value to the coach or the user). What remains is one lane:
          take after take, each an official recording. */}
      {status === "ready" && sd && onReadAloud ? (
        <div className="shrink-0 bg-background px-4 pb-4">
          {/* MASTER DOCUMENT — Save, then the next official take. */}
          <IdealTextActions
            arcId={arcId}
            canRecordTake={sd.canRecordTake}
            takeCount={sd.takeCount}
            journeyNextStepsSeen={sd.journeyNextStepsSeen}
            saved={sd.saved}
            onSaved={() => setRefetchNonce((n) => n + 1)}
            onNewTake={() => onReadAloud(sd.version)}
            onSeeNextSteps={() => {
              void reloadLounge();
              onClose();
            }}
          />
        </div>
      ) : null}

      {/* PRESENT MODE — fullscreen, over everything. Nothing but the X. */}
      {presenting ? (
        <PresentMode
          text={displayText}
          pieces={sd?.pieces ?? null}
          presentationRef={deckRef}
          slideTitles={sd?.slideTitles ?? null}
          onClose={() => setPresenting(false)}
        />
      ) : null}
      {exportChooserOpen ? (
        <ExportFormatDialog
          onClose={() => setExportChooserOpen(false)}
          onSelect={(format) => {
            setExportFormat(format);
            setExportChooserOpen(false);
            setExporting(true);
          }}
        />
      ) : null}
      {exporting && exportFormat ? (
        <PresentMode
          text={displayText}
          pieces={sd?.pieces ?? null}
          presentationRef={deckRef}
          slideTitles={sd?.slideTitles ?? null}
          exportFormat={exportFormat}
          onClose={() => {
            setExporting(false);
            setExportFormat(null);
          }}
        />
      ) : null}

      {/* DISCERNMENT — accept lands the challenger (BE reassembles → full
          refetch); reject pins the incumbent (apply the echoed piece, the
          glow dies). Both 409s refetch SILENTLY — never an error surface. */}
      <PieceSwapSheet
        piece={swapOpen}
        onClose={() => setSwapOpen(null)}
        onDecide={async (action) => {
          const p = swapOpen;
          if (!p?.challenger) return false;
          const r = await swapPiece({
            arcId,
            pieceKey: p.pieceKey,
            action,
            challengerSnippetId: p.challenger.snippetId,
          });
          if (r.kind === "error") return false;
          setSwapOpen(null);
          if (r.kind === "stale" || action === "accept" || r.piece === null) {
            setRefetchNonce((n) => n + 1);
          } else {
            const echoed = r.piece;
            fetchGenRef.current++; // fence out any in-flight pre-decision GET
            setSd((prev) =>
              prev
                ? {
                    ...prev,
                    pieces: (prev.pieces ?? []).map((x) =>
                      x.pieceKey === echoed.pieceKey ? echoed : x,
                    ),
                  }
                : prev,
            );
          }
          return true;
        }}
      />
      {/* BLOCK_VARIANTS — the per-block picker (neutral, chronological — the
          student browses and chooses) and the revision timeline with restore.
          Kept separate from the offer sheet above BY DESIGN (§6): the offer
          pushes, the picker pulls. */}
      <BlockVariantSheet
        block={pickerBlock}
        onSelect={selectVariant}
        onClose={() => setPickerBlock(null)}
      />
      <RevisionTimelineSheet
        open={timelineOpen}
        revisions={revisions ?? []}
        onRestore={restoreRevision}
        onClose={() => setTimelineOpen(false)}
      />
    </div>
  );
}

/* NotebookEditor lived here — a whole-document textarea behind the header's
 * second pencil, saving through the legacy personal-notes PUT. It went out
 * with that pencil (founder 2026-08-11: "The edits should not be in the top
 * bar"). Its one non-legacy job — editing the SD document — is what the
 * deck's chunk modal does now: per chunk, in front of the words. */

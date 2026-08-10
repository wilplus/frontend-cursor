"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ListPlus,
  Lock,
  Mic,
  PencilLine,
  Play,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MediaPlayer from "@/components/results/MediaPlayer";
import OverlayCloseButton from "./OverlayCloseButton";
import LoadingState from "./LoadingState";
import FeedbackOverlay from "./FeedbackOverlay";
import { useBackDismiss } from "./useBackDismiss";
import { RichText } from "./RichText";
import MarkedEditor from "./MarkedEditor";
import IdealTextHeading from "./IdealTextHeading";
import {
  MomentSheet,
  MomentStarText,
  useMomentStars,
  type LocalFold,
} from "./MomentStars";
import {
  type Addition,
  fetchIdealText,
  isUnappliedPolish,
  saveIdealNotes,
  saveIdealUserEdit,
  segmentIdealText,
  type IdealKeyMomentLink,
  type DocumentSuggestion,
  type IdealPiece,
  type KeyPoint,
  type IdealText,
  type MomentSuggestion,
} from "@/services/api/idealText";
import {
  fetchMomentExplanation,
  unlockMoments,
  type MomentExplanationResult,
} from "@/services/api/momentExplanation";
import { sendSuggestionFeedback } from "@/services/api/suggestionFeedback";
import { decideBlock, decidePriorTake } from "@/services/api/documentDecide";
import { reRecordSnippet } from "@/services/api/reRecordSnippet";
import { swapPiece } from "@/services/api/pieceSwap";
import {
  alignVariantBlocksWithPieces,
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
import { PieceBadgeText, PieceSwapSheet } from "./PieceBadges";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import { useArcDeckRef } from "./useArcDeckRef";
import IdealTextActions from "./IdealTextActions";
import PresentMode from "./PresentMode";
import DocumentArranger from "./DocumentArranger";
import AdditionsPanel from "./AdditionsPanel";
import { setPartLock } from "@/services/api/partLock";
import {
  autoLockTouched,
  reconcileParts,
  type Part,
} from "@/lib/willab/documentParts";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";

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

export default function IdealTextOverlay({
  arcId,
  analysisPending = false,
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
  // Confidence-game entry navigates to /game (its own page, over from /chat).
  const router = useRouter();
  const [sd, setSd] = useState<{
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
  } | null>(null);
  // DISCERNMENT — the pending-swap comparison sheet's open piece.
  const [swapOpen, setSwapOpen] = useState<IdealPiece | null>(null);
  // BLOCK_VARIANTS — the picker pool, the revision timeline, and their open
  // sheets. null = feature off (the GET 404s) / not loaded: nothing new
  // renders anywhere.
  const [variantBlocks, setVariantBlocks] = useState<VariantBlock[] | null>(
    null
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
  // A different arc = a fresh document; clear any local moment folds.
  useEffect(() => {
    stars.resetFolds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arcId]);

  // Notebook state: the personal copy wins for display once saved.
  const [notes, setNotes] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // T1 · 1.2 — add/move mode.
  const [arranging, setArranging] = useState(false);
  // PRESENT MODE (founder 2026-08-05) — the fullscreen, X-only,
  // scroll-through-the-deck read. Read-only; recording stays in the Lab.
  const [presenting, setPresenting] = useState(false);
  const [tooLong, setTooLong] = useState(false);
  const [editLocked, setEditLocked] = useState(false);
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

  // The tapped key moment awaiting "Go to this moment?" confirmation.
  const [momentAsk, setMomentAsk] = useState<IdealKeyMomentLink | null>(null);
  // The open feedback deep-link (stacked over this overlay).
  const [feedbackTarget, setFeedbackTarget] =
    useState<IdealKeyMomentLink | null>(null);

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
    void fetchIdealText(arcId).then((r) => {
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
        // SD — the ONE living text: both statuses free to read; the only paid
        // thing is opening the key moments. Renders through the ready view
        // with the SD chrome (status chip, read-aloud CTA, moment behavior).
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
          saved: r.saved,
          keyPoints: r.keyPoints,
          presentationRef: r.presentationRef,
          parts: r.parts,
          additions: r.additions,
          userEdited: r.userEdited,
          canRecordTake: r.canRecordTake,
        });
        versionRef.current = r.version;
        versionArmedRef.current = true;
        // The document's stored identity. null = the BE has none for this
        // document (or refused to serve stale ones), and the arranger mints
        // locally — so a part always has an id, whether or not it was saved.
        partsRef.current = r.parts;
        if (r.ideal.text.trim()) setEditLocked(false);
        setStatus("ready");
        // BLOCK_VARIANTS — refresh the pool + timeline AFTER the document
        // landed (§5 order), and only on the SD lane (the pool only exists
        // where the master model does).
        refreshVariants();
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
    async (part: Part, locked: boolean): Promise<"ok" | "blocked" | "failed"> => {
      const r = await setPartLock(arcId, part.id, locked, displayText);
      if (r.kind === "undecided") return "blocked";
      if (r.kind === "error") return "failed";
      if (r.kind === "stale") {
        setRefetchNonce((n) => n + 1);
        return "failed";
      }
      partsRef.current = (partsRef.current ?? []).map((p) =>
        p.id === part.id ? { ...p, locked } : p
      );
      setRefetchNonce((n) => n + 1);
      return "ok";
    },
    [arcId, displayText]
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
        addition.takeSessionId
      );
      if (r.kind === "error") return false;
      setRefetchNonce((n) => n + 1);
      return true;
    },
    [arcId]
  );

  const saveDocument = useCallback(
    async (next: string, nextParts?: readonly Part[] | null): Promise<boolean> => {
      if (!versionArmedRef.current) return false;
      // PARTS (SPEC §3.1, Step 0). The arranger hands its parts straight
      // through, ids intact. The TEXTAREA lane does not have any — so
      // reconcile against what we hold, which keeps the id of every paragraph
      // the student did not touch. Re-minting them all would discard the locks
      // PR 3 will hang on those ids, on paragraphs that never changed.
      // AUTO-LOCK ("typed = committed"): every part this edit touched is
      // sent locked, judged against the last served baseline — a pure move
      // stays unlocked (arrangement is not authorship). The BE pins locked
      // paragraphs across takes from here on, which is what retired the
      // superseded-edit card.
      const parts = autoLockTouched(
        reconcileParts(next, nextParts ?? partsRef.current ?? []),
        partsRef.current
      );
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
        saveIdealUserEdit(arcId, next, versionRef.current, { parts })
      );
      chainRef.current = run.then(
        () => undefined,
        () => undefined
      );
      const r = await run;
      if (r.ok) {
        versionRef.current = r.version ?? versionRef.current;
        setSd((prev) =>
          prev
            ? { ...prev, version: versionRef.current, userEdited: true }
            : prev
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
          prev ? { ...prev, version: versionRef.current } : prev
        );
        fetchGenRef.current++; // fence any in-flight pre-supersede GET
        setRefetchNonce((n) => n + 1); // adopt the NEW version's text
        return true;
      }
      if (r.reason === "nothingToEdit") {
        // Nothing is assembled — there was no document to edit. Put back what
        // was on screen and retire the affordances.
        setIdeal((prev) => (prev ? { ...prev, text: before } : prev));
        setEditLocked(true);
        return false;
      }
      if (r.reason === "invalid") {
        setTooLong(true);
        return false; // the words stay on screen, unsaved
      }
      setSaveFailed(true);
      return false;
    },
    [arcId, ideal?.text, refreshVariants]
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
      const r = await selectBlockVariant(arcId, block.blockKey, variant.variantId);
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
    [arcId]
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
    [arcId]
  );


  // T1 · 1.2 — the star fence: while the document is the student's own edit
  // the BE serves no decoration, and re-anchoring stars into edited words
  // client-side would attach a coach's read to a sentence they never saw.
  const edited = sd?.userEdited === true;
  // The held version to offer back: the BE's `prior_edit` once it ships, else
  // the local buffer from the supersede we just handled.

  // FE-3/4/5 — a tracked-change decision. Accept = the proposal becomes the
  // text; Keep mine = the suggestion is refused and never re-offered. Both
  // ride the existing per-snippet feedback POST (the ledger remembers them).
  const decideTracked = async (
    s: DocumentSuggestion,
    d: "accept" | "keep"
  ): Promise<boolean> => {
    const accept = d === "accept";
    // Route by SOURCE — each lane has its own decision endpoint (§2/§3); a
    // block upgrade posted to suggestion-feedback would never flip the block.
    let outcome: "ok" | "stale" | "error";
    if (s.source === "new_take") {
      if (s.blockKey === null || !s.takeSessionId) return false;
      outcome = (
        await decideBlock(arcId, s.blockKey, accept ? "accept" : "keep", s.takeSessionId)
      ).kind;
    } else if (s.source === "prior_take") {
      outcome = (await decidePriorTake(arcId, s, accept ? "accept" : "keep")).kind;
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
                : x
            ),
          }
        : prev
    );
    // An accept reassembles the document BE-side (version bump) — pull it.
    if (accept) {
      fetchGenRef.current++; // fence any in-flight pre-decision GET
      setRefetchNonce((n) => n + 1);
    }
    return true;
  };

  // SLIDES — the arc's deck, for the slide-per-paragraph reading view.
  // Resolved only under SD (the legacy lanes have no piece structure to
  // attach slides to), after the GET settles.
  const deckRef = useArcDeckRef(
    arcId,
    sd?.presentationRef ?? null,
    status === "ready" && sd !== null
  );

  // SD — the shared star layer owns the sheet, the Approve/Revert folds and
  // the moments unlock. The notebook keeps only its legacy wrapper below.
  const stars = useMomentStars({
    arcId,
    momentsUnlocked: sd?.momentsUnlocked ?? false,
    explanationsAvailable: sd?.explanationsAvailable ?? false,
    onUnlocked: () =>
      setSd((prev) => (prev ? { ...prev, momentsUnlocked: true } : prev)),
  });

  // FE-2 — polish stars on this text, and the ones still awaiting a decision.
  const allPolish = useMemo(
    () => (ideal?.keyMoments ?? []).filter(isUnappliedPolish),
    [ideal]
  );
  const pendingPolish = useMemo(
    () => allPolish.filter((m) => !stars.isApplied(m)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPolish, stars.appliedLocal]
  );

  // Legacy (non-SD) lane keeps the "Go to this moment?" confirm bubble; a
  // legacy moment with no snippet link stays inert (it has nowhere to
  // deep-link — R-sd4). Under SD every tap goes to the shared sheet.
  async function openMoment(m: IdealKeyMomentLink) {
    if (!sd) {
      if (!m.snippetId) return;
      setMomentAsk(m);
      return;
    }
    await stars.openMoment(m);
  }

  function copyText() {
    void navigator.clipboard?.writeText(stripRichMarkers(displayText)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        {/* The project's name and its verification state, both from the shared
            head — the post-recording readout mounts the SAME one, so the two
            ideal-text screens cannot head themselves differently again. */}
        <IdealTextHeading title={sd?.title} status={sd ? sd.status : null} />
        <div className="flex items-center gap-2.5">
          {/* PRESENT — the PowerPoint move: a play glyph that throws the
              document fullscreen to deliver it. First in the row because it
              is the one control you reach for while standing up. Needs text
              on screen; hidden while editing/arranging (you are not
              presenting a document you are mid-edit on). */}
          {(status === "ready" || status === "instant") &&
          !editing &&
          !arranging &&
          displayText.trim() ? (
            <button
              type="button"
              onClick={() => setPresenting(true)}
              aria-label="Present mode"
              title="Present mode"
              className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Play className="h-4 w-4" aria-hidden />
              <span className="text-[13px] font-medium">Present</span>
            </button>
          ) : null}
          {/* BLOCK_VARIANTS — the timeline entry (§8.2). Only when the
              timeline has rows: an empty list is a real state (pre-migration
              arc) and hides it entirely (§4.3). */}
          {status === "ready" && sd && !editing && revisions && revisions.length > 0 ? (
            <TimelineEntryButton onOpen={() => setTimelineOpen(true)} />
          ) : null}
          {(status === "ready" || status === "instant") && !editing ? (
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
          {/* T1 · 1.2 — add / move parts of the living document. SD only (the
              legacy personal-notes lane has no version to stamp a PUT with),
              and never while nothing is assembled to arrange. */}
          {status === "ready" && sd && !editing && !editLocked && displayText.trim() ? (
            <button
              type="button"
              onClick={() => setArranging((a) => !a)}
              aria-label={
                arranging
                  ? IDEAL_EDIT_COPY.arrangeDone
                  : IDEAL_EDIT_COPY.arrangeOpen
              }
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted ${
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
          {/* Personal-notes editing is a legacy perfected-lane feature — no
              pencil on the instant draft or in the SD living document. */}
          {status === "ready" && !editing && !arranging && !editLocked ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit your copy"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PencilLine className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <OverlayCloseButton onClick={onClose} />
        </div>
      </div>

      <div className="scrollbar-none flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 py-8">
          {status === "loading" ? (
            <LoadingState />
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
                <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p className="text-[13px] leading-relaxed text-foreground">
                  Instant draft. Your coach is polishing the full version.
                </p>
              </div>
              {/* No bulk control in the INSTANT lane: this view renders
                  MomentStarText without foldFor, so an approval would record
                  server-side while changing nothing on screen (review R-p6).
                  The SD lane below owns it. */}
              <MomentStarText
                text={displayText}
                ideal={ideal}
                onMomentTap={setMomentAsk}
              />
            </div>
          ) : editing && ideal ? (
            <NotebookEditor
              arcId={arcId}
              initial={displayText}
              // #214 — SD edits persist through the user-edit PUT (the
              // student's edit always wins; supersede retried inside the
              // service). Legacy mode keeps the personal-notes PUT.
              save={sd ? saveDocument : undefined}
              onSaved={(text) => {
                // Under SD, saveDocument already reconciled the document (and
                // a supersede already queued the refetch that replaces it).
                if (!sd) setNotes(text);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : ideal ? (
            <div className="flex flex-col gap-4">
              {/* The verification badge moved into the header (above) — a row
                  of its own was a band of vertical space for one word. */}
              {/* FE-2 — one tap applies every smoother-version suggestion.
                  Polish only; acoustic and structural stars stay per-star.
                  Hidden while arranging and on an edited document: no stars
                  are drawn there, so approving would look like a dead tap. */}
              {arranging || edited ? null : sd && stars.bulkApplied ? (
                <button
                  type="button"
                  onClick={() => stars.revertAllPolish(allPolish)}
                  className="self-start text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Undo all
                </button>
              ) : sd && pendingPolish.length >= 2 ? (
                <button
                  type="button"
                  onClick={() => stars.approveAllPolish(pendingPolish)}
                  className="self-start rounded-full border border-border px-3.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Approve all
                </button>
              ) : null}
              {/* Founder 2026-07-29 — the Full text / Key words toggle is
                  retired: the notebook always shows the full text. */}

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

              {arranging && sd ? (
                // T1 · 1.2 — the parts view: tap a gap to add, drag to move.
                // Each action persists the whole joined document.
                <DocumentArranger
                  text={displayText}
                  parts={sd.parts}
                  onChange={(next, parts) => void saveDocument(next, parts)}
                  onToggleLock={toggleLock}
                  textSizeClass="text-[18px]"
                />
              ) : edited ? (
                // T1 · 1.2 — the student's own document: their words and their
                // markers, NO stars and NO version pills. Both are anchored to
                // machine text this document no longer is. They return when the
                // next take supersedes the edit.
                <p className="whitespace-pre-line text-[18px] leading-relaxed text-foreground">
                  <RichText text={displayText} />
                </p>
              ) : (
                <PieceBadgeText
                  text={displayText}
                  ideal={ideal}
                  // DISCERNMENT — SD only; a legacy payload has pieces null and
                  // renders exactly today's view.
                  // MASTER DOCUMENT — a saved version shows the clean script.
                  pieces={sd?.saved === true ? null : sd?.pieces ?? null}
                  // LIVING TRANSCRIPT — tracked changes own the words when the
                  // BE serves them; the version pills compose on top.
                  suggestions={sd?.suggestions ?? null}
                  onDecideTracked={decideTracked}
                  onMomentTap={(m) => void openMoment(m)}
                  foldFor={stars.foldFor}
                  // FE-2 — the star treatment only under SD (a legacy "ready"
                  // payload keeps its classic underline links).
                  sdStars={sd !== null}
                  onOpenSwap={setSwapOpen}
                  // BLOCK_VARIANTS — the per-block picker entry (chips zip
                  // to paragraphs; feature off → null → nothing new).
                  // Cross-checked against the SERVED pieces via the
                  // BE-confirmed block_key == piece_key join — sd.pieces,
                  // not the display pieces, which a save blanks.
                  variantBlocks={
                    sd
                      ? alignVariantBlocksWithPieces(variantBlocks, sd.pieces)
                      : null
                  }
                  onOpenPicker={setPickerBlock}
                  // SLIDES — each paragraph reads under the slide it was
                  // delivered on (deckless arcs pass null: today's view).
                  deck={deckRef ? { presentationRef: deckRef } : null}
                />
              )}

              {/* MATERIAL RECOVERY — words the speaker SAID on a slide their
                  script has no block for. Below the document, not inside it:
                  there is nothing in the text to anchor to, which is exactly
                  why forcing it into the tracked-change shape made it reach
                  nobody. Hidden while arranging — that mode is about the words
                  already in the script. */}
              {sd && !arranging && sd.additions.length > 0 ? (
                <AdditionsPanel
                  additions={sd.additions}
                  onDecide={decideAddition}
                  textSizeClass="text-[18px]"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* "Go to this moment?" — the small confirm bubble for a tapped moment. */}
      {momentAsk ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
            <p className="text-[14px] text-foreground">Go to this moment?</p>
            <Button
              type="button"
              onClick={() => {
                setFeedbackTarget(momentAsk);
                setMomentAsk(null);
              }}
              className="h-8 rounded-full bg-foreground px-4 text-[13px] text-background hover:bg-foreground/90"
            >
              Go
            </Button>
            <button
              type="button"
              onClick={() => setMomentAsk(null)}
              className="text-[13px] text-muted-foreground hover:text-foreground"
            >
              Stay
            </button>
          </div>
        </div>
      ) : null}

      {/* The PERSISTENT bottom control. Reading the text out loud used to sit
          here as a second, gated mic; it is retired (founder 2026-08-05 — it
          brought no value to the coach or the user). What remains is one lane:
          take after take, each an official recording. */}
      {status === "ready" && !editing && sd && onReadAloud ? (
        <div className="shrink-0 bg-background px-4 pb-4">
          {/* Confidence game (founder 2026-07-28) — the per-arc first-time
              entry lives HERE, in the same place as the re-read, once the
              user has collected at least three coach-confirmed confident-
              voice moments. (The always-offered end-of-arc play/skip comes
              later, once the game is established.) */}
          {(ideal?.keyMoments ?? []).filter((m) => m.star === "verified")
            .length >= 3 ? (
            <button
              type="button"
              onClick={() => router.push(`/game?arc=${encodeURIComponent(arcId)}`)}
              className="mb-2 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/5 text-[14px] font-medium text-foreground transition-colors hover:border-primary/70"
            >
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Play the confidence game
            </button>
          ) : null}
          {/* MASTER DOCUMENT — Save, then the next official take. */}
          <IdealTextActions
            arcId={arcId}
            canRecordTake={sd.canRecordTake}
            saved={sd.saved}
            onSaved={() => setRefetchNonce((n) => n + 1)}
            onNewTake={() => onReadAloud(sd.version)}
          />
        </div>
      ) : null}

      {/* PRESENT MODE — fullscreen, over everything. Nothing but the X. */}
      {presenting ? (
        <PresentMode
          text={displayText}
          pieces={sd?.pieces ?? null}
          presentationRef={deckRef}
          onClose={() => setPresenting(false)}
        />
      ) : null}

      {/* The deep-linked feedback page, stacked over the notebook. */}
      {feedbackTarget ? (
        <FeedbackOverlay
          arcId={arcId}
          takeSessionId={feedbackTarget.takeSessionId || null}
          anchorSnippetId={feedbackTarget.snippetId}
          onClose={() => setFeedbackTarget(null)}
          topLayer
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
                      x.pieceKey === echoed.pieceKey ? echoed : x
                    ),
                  }
                : prev
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
      {/* SD — the shared key-moment sheet (free playback → the suggestion to
          Approve, or the coach's message behind the moments unlock). */}
      <MomentSheet
        moment={stars.momentOpen}
        momentContent={stars.momentContent}
        applied={stars.momentOpen ? stars.isApplied(stars.momentOpen) : false}
        onClose={stars.closeMoment}
        onApprove={() => stars.momentOpen && stars.approveMoment(stars.momentOpen)}
        onRevert={() => stars.momentOpen && stars.revertMoment(stars.momentOpen)}
        onBuy={stars.buyMoments}
        onReRecord={async (snippetId, takeSessionId, audio, durationSec) => {
          const r = await reRecordSnippet({
            snippetId,
            takeSessionId,
            topic: sd?.title ?? null,
            audio,
            durationSec,
          });
          // Re-pull the served text so the improved snippet + new version
          // flow in; the sheet stays open on its success confirmation.
          if (r.ok) setRefetchNonce((n) => n + 1);
          return r.ok;
        }}
      />
    </div>
  );
}

function NotebookEditor({
  arcId,
  initial,
  save: saveOverride,
  onSaved,
  onCancel,
}: {
  arcId: string;
  initial: string;
  /** #214 — optional persistence override (the SD user-edit PUT); default is
   *  the legacy personal-notes PUT. Returns success. */
  save?: (text: string) => Promise<boolean>;
  onSaved: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // An emptied draft can't save: the mapper reads an empty stored copy as
  // "no personal copy" on the next load, so it would silently revert to the
  // canonical — blocking it here keeps what you see and what persists aligned.
  const empty = draft.trim() === "";

  async function save() {
    if (saving || empty) return;
    setSaving(true);
    setError(null);
    const ok = saveOverride
      ? await saveOverride(draft)
      : await saveIdealNotes(arcId, draft);
    setSaving(false);
    if (ok) onSaved(draft);
    else setError("Couldn't save. Try again.");
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* FE-1 — the SAME styled editor as the readout. Both surfaces edit one
          document, so neither may show the marker source. */}
      <MarkedEditor
        value={draft}
        onChange={setDraft}
        textSizeClass="text-[18px]"
        autoFocus
      />
      <p className="text-[12px] text-muted-foreground">
        {saveOverride
          ? "Your edit becomes the text. Your coach sees it too."
          : "This is your personal copy. The coach-approved original stays unchanged."}
      </p>
      <div className="flex items-center gap-2">
        {/* FE-5 (bug 3b) — no "Save" CTA: the text is already saved and an
            edit persists on exiting edit mode, so "Save" would promise
            something that already happened. "Done" persists and closes; Cancel
            discards. */}
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || empty}
          className="h-10 rounded-full bg-foreground px-6 text-[14px] text-background hover:bg-foreground/90"
        >
          {saving ? "Saving…" : "Done"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-10 rounded-full px-6 text-[14px]"
        >
          Cancel
        </Button>
        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

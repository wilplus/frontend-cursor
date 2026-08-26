"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Mic, MoreHorizontal } from "lucide-react";
import LoadingState from "./LoadingState";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import type { ExploreArc } from "@/lib/willab/exploreArc";
import {
  deletePresentation,
  deleteTake,
  fetchStrengths,
  type PresentationGroup,
  type PresentationTake,
  type StrengthMoment,
  type StrengthsView,
} from "@/services/api/strengths";
import { fetchTrainings, type TrainingArc, type TrainingTake } from "@/services/api/trainings";
import FeedbackOverlay from "./FeedbackOverlay";
import IdealTextOverlay from "./IdealTextOverlay";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender, TextSlide } from "./pdfSlides";
import { SlidePlaceholder } from "./SlideTake";
import SnippetScreenShell from "./SnippetScreenShell";
import type { ReadoutFeatures } from "./readout";

/* -------------------------------------------------------------------------- */
/*  LibraryOverlay — "Trainings" 4-level nav                                  */
/*                                                                            */
/*  L1  Presentations list                                                    */
/*  L2  Presentation detail (best takes + all takes)                          */
/*  L2g General moments                                                       */
/*  L3  Slide list                                                             */
/*  L4  SlideTake                                                              */
/* -------------------------------------------------------------------------- */

const EMPTY: StrengthsView = { general: [], presentations: [] };

type DeckSlide = {
  index: number;
  title: string;
  body: string;
  moment: StrengthMoment | null;
  /** C / BE #6 — verbatim slide transcript + slide audio for the take view.
   *  "" / null on the general deck (which renders the moment instead). */
  transcript: string;
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
};
type Deck = {
  topic: string;
  takeLabel: string;
  takeTitle: string;
  presentationRef: string | null;
  slides: DeckSlide[];
};

function takeDeck(take: PresentationTake, topic: string): Deck {
  return {
    topic: topic || "Presentation",
    takeLabel: `take ${take.takeNumber}`,
    takeTitle: `Take ${take.takeNumber}`,
    presentationRef: take.presentationRef,
    slides: take.slides.map((s) => ({
      index: s.index,
      title: s.title,
      body: s.body,
      moment: s.moments[0] ?? null,
      transcript: s.transcript,
      audioRef: s.audioRef,
      startOffsetMs: s.startOffsetMs,
      durationMs: s.durationMs,
    })),
  };
}

const generalDeck = (moments: StrengthMoment[]): Deck => ({
  topic: "General strengths",
  takeLabel: "general",
  takeTitle: "",
  presentationRef: null,
  slides: moments.map((m, i) => ({
    index: i,
    title: "",
    body: "",
    moment: m,
    transcript: "",
    audioRef: null,
    startOffsetMs: 0,
    durationMs: 0,
  })),
});

/* ─────────────────────── nav state ────────────────────────────────────── */

type NavLevel =
  | { level: "L1" }
  | { level: "L2"; presentation: PresentationGroup }
  | { level: "L2g" }
  | { level: "L3"; deck: Deck; topic: string; takeLabel: string }
  | { level: "L4"; deck: Deck; topic: string; takeLabel: string; slideIdx: number }
  /** R4-13 — arc detail in trainings mode (the /user/trainings source). */
  | { level: "T2"; arc: TrainingArc };

export default function LibraryOverlay({
  onClose,
  onOpenBestPresentation,
  onRecordAnother,
}: {
  onClose: () => void;
  onOpenBestPresentation: (arcId: string) => void;
  /** Record another take INTO an existing deck's arc (continue-one-arc). The
   *  parent writes the arc + deck to localStorage, closes the library, and
   *  starts a recording. */
  onRecordAnother: (arc: ExploreArc) => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [presentations, setPresentations] = useState<PresentationGroup[]>([]);
  const [general, setGeneral] = useState<StrengthMoment[]>([]);
  // Trainings is the sole project-history source. Strong Sides is retired and
  // must never become a hidden fallback when this request fails.
  const [trainings, setTrainings] = useState<TrainingArc[]>([]);
  // Delivery layer — a take's feedback page / the arc's ideal-text notebook,
  // opened over this overlay.
  const [feedbackTake, setFeedbackTake] = useState<{
    arcId: string;
    takeIndex: number;
    sessionId: string;
  } | null>(null);
  const [idealArcId, setIdealArcId] = useState<string | null>(null);
  const [nav, setNav] = useState<NavLevel>({ level: "L1" });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Refs for the popstate handler (avoids stale closures in the [] effect).
  const navRef = useRef(nav);
  navRef.current = nav;
  const presentationsRef = useRef(presentations);
  presentationsRef.current = presentations;

  // R7 — the shared stack-aware back-dismiss (an inline listener would bypass
  // the overlay stack: an overlay stacked over the library — a take's feedback
  // page, the ideal notebook — would have ITS pop also step the library's nav
  // underneath). Back steps one nav level (onBack consumes; the hook re-arms
  // the history entry); at L1 it closes.
  useBackDismiss(onClose, () => {
    const cur = navRef.current;
    if (cur.level === "L1") return false; // top level → close as usual
    switch (cur.level) {
      case "L2":
      case "L2g":
      case "T2":
        setNav({ level: "L1" });
        break;
      case "L3":
        if (cur.deck.takeLabel === "general") {
          setNav({ level: "L2g" });
        } else {
          const p = presentationsRef.current.find(
            (pr) => (pr.topic || "Presentation") === cur.topic
          );
          setNav(p ? { level: "L2", presentation: p } : { level: "L1" });
        }
        break;
      case "L4":
        setNav({
          level: "L3",
          deck: cur.deck,
          topic: cur.topic,
          takeLabel: cur.takeLabel,
        });
        break;
    }
    return true; // consumed — the hook re-arms the entry
  });

  useEffect(() => {
    let active = true;
    void fetchTrainings().then((arcs) => {
      if (!active) return;
      setTrainings(arcs ?? []);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  const isEmpty = trainings.length === 0;

  /* ── breadcrumbs ── */
  const goL1 = () => setNav({ level: "L1" });
  const goL2 = (p: PresentationGroup) => setNav({ level: "L2", presentation: p });

  const crumbs: { label: string; onClick?: () => void }[] = (() => {
    if (nav.level === "L1") return [{ label: "Your presentations" }];
    if (nav.level === "L2") {
      return [
        { label: "Your presentations", onClick: goL1 },
        { label: nav.presentation.topic || "Presentation" },
      ];
    }
    if (nav.level === "L2g") {
      return [
        { label: "Your presentations", onClick: goL1 },
        { label: "Other moments" },
      ];
    }
    if (nav.level === "T2") {
      return [
        { label: "Your presentations", onClick: goL1 },
        { label: nav.arc.topic },
      ];
    }
    if (nav.level === "L3") {
      const goBackToL2 =
        nav.deck.takeLabel === "general"
          ? () => setNav({ level: "L2g" })
          : () => {
              const p = presentations.find(
                (pr) => (pr.topic || "Presentation") === nav.topic
              );
              if (p) setNav({ level: "L2", presentation: p });
              else goL1();
            };
      return [
        { label: "Your presentations", onClick: goL1 },
        { label: nav.topic, onClick: goBackToL2 },
        { label: nav.deck.takeTitle || nav.takeLabel },
      ];
    }
    // L4
    if (nav.level === "L4") {
      const goBackToL2 = () => {
        const p = presentations.find(
          (pr) => (pr.topic || "Presentation") === nav.topic
        );
        if (p) setNav({ level: "L2", presentation: p });
        else goL1();
      };
      return [
        { label: "Your presentations", onClick: goL1 },
        { label: nav.topic, onClick: goBackToL2 },
        {
          label: nav.deck.takeTitle || nav.takeLabel,
          onClick: () =>
            setNav({
              level: "L3",
              deck: nav.deck,
              topic: nav.topic,
              takeLabel: nav.takeLabel,
            }),
        },
        { label: `Slide ${nav.slideIdx + 1}` },
      ];
    }
    return [{ label: "Your presentations" }];
  })();

  /* ── delete handlers ── */
  const handleDeletePresentation = (p: PresentationGroup) => {
    if (!window.confirm("Delete this presentation and all its takes?")) return;
    const prev = presentations;
    setPresentations((ps) => ps.filter((x) => x.presentationId !== p.presentationId));
    if (nav.level === "L2" && nav.presentation.presentationId === p.presentationId) {
      goL1();
    }
    deletePresentation(p.presentationId).catch(() => {
      setPresentations(prev);
      setDeleteError("Could not delete presentation. Please try again.");
      setTimeout(() => setDeleteError(null), 3000);
    });
  };

  const handleDeleteTake = (presentationId: string, takeNumber: number) => {
    setPresentations((ps) =>
      ps.map((p) =>
        p.presentationId !== presentationId
          ? p
          : { ...p, takes: p.takes.filter((t) => t.takeNumber !== takeNumber) }
      )
    );
    deleteTake(presentationId, takeNumber).catch(() => {
      // re-fetch on failure rather than trying to reconstruct the old state
      void fetchStrengths().then((v) => {
        setPresentations(v.presentations);
        setGeneral(v.general);
      });
    });
  };

  /* ── slide navigation ── */
  const openDeck = (deck: Deck, topic: string, takeLabel: string) =>
    setNav({ level: "L3", deck, topic, takeLabel });

  const openSlide = (slideIdx: number) => {
    if (nav.level !== "L3") return;
    setNav({ level: "L4", deck: nav.deck, topic: nav.topic, takeLabel: nav.takeLabel, slideIdx });
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      {/* header */}
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <nav className="flex min-w-0 items-center gap-1.5 text-[15px]">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 ? <span className="text-muted-foreground">/</span> : null}
              {c.onClick ? (
                <button
                  type="button"
                  onClick={c.onClick}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {c.label}
                </button>
              ) : (
                <span className="truncate font-semibold text-foreground">
                  {c.label}
                </span>
              )}
            </span>
          ))}
        </nav>
        <OverlayCloseButton onClick={onClose} className="ml-3" />
      </div>

      <div className="scrollbar-none flex flex-1 flex-col overflow-y-auto">
        {status === "loading" ? (
          <LoadingState placement="surface" />
        ) : nav.level === "L4" ? (
          <LibraryMomentPage
            deck={nav.deck}
            slideIdx={nav.slideIdx}
            onSlideIdx={(i) =>
              setNav({ level: "L4", deck: nav.deck, topic: nav.topic, takeLabel: nav.takeLabel, slideIdx: i })
            }
            onClose={() =>
              setNav({ level: "L3", deck: nav.deck, topic: nav.topic, takeLabel: nav.takeLabel })
            }
          />
        ) : nav.level === "L3" ? (
          <SlideList deck={nav.deck} onOpenSlide={openSlide} />
        ) : nav.level === "L2" ? (
          <PresentationDetail
            presentation={nav.presentation}
            onOpenBest={() => {
              // The "ideal presentation" is the composed best-presentation
              // (built from the takes, available BEFORE coach review). Opens
              // the z-40 BestPresentationOverlay over this z-30 library.
              if (nav.presentation.arcId) {
                onOpenBestPresentation(nav.presentation.arcId);
              }
            }}
            onOpenTake={(t) =>
              openDeck(
                takeDeck(t, nav.presentation.topic),
                nav.presentation.topic || "Presentation",
                `take ${t.takeNumber}`
              )
            }
            onDeleteTake={(tn) => handleDeleteTake(nav.presentation.presentationId, tn)}
            onRecordAnother={() => {
              const p = nav.presentation;
              if (!p.arcId) return;
              onRecordAnother({
                arcId: p.arcId,
                nextTakeIndex: p.takes.length + 1,
                deck: {
                  topic: p.topic || "",
                  presentationRef: p.presentationRef,
                  slides: p.slides.map((s) => ({
                    title: s.title,
                    body: s.body,
                  })),
                },
              });
            }}
          />
        ) : nav.level === "L2g" ? (
          <SlideList
            deck={generalDeck(general)}
            onOpenSlide={(i) => {
              const deck = generalDeck(general);
              setNav({ level: "L4", deck, topic: "Other moments", takeLabel: "general", slideIdx: i });
            }}
          />
        ) : nav.level === "T2" ? (
          <TrainingDetail
            arc={nav.arc}
            onOpenIdeal={() => setIdealArcId(nav.arc.arcId)}
            onOpenTake={(t) =>
              setFeedbackTake({
                arcId: nav.arc.arcId,
                takeIndex: t.takeIndex,
                sessionId: t.sessionId,
              })
            }
            onRecordAnother={() => {
              // Continue this arc. No slide bodies ride the trainings payload;
              // the deck restores server-side via the latest take's session id
              // (the FE-1 setup-restore path).
              const latest = nav.arc.takes[nav.arc.takes.length - 1];
              onRecordAnother({
                arcId: nav.arc.arcId,
                nextTakeIndex: nav.arc.takeCount + 1,
                sessionId: latest?.sessionId,
              });
            }}
          />
        ) : isEmpty ? (
          <>
            <p className="mx-auto w-full max-w-2xl px-4 text-[15px] text-muted-foreground">
              Nothing here yet.
            </p>
          </>
        ) : (
          <TrainingsList
            trainings={trainings}
            onOpen={(arc) => setNav({ level: "T2", arc })}
          />
        )}
      </div>

      {/* Delivery layer — a take's feedback page / the ideal-text notebook,
          stacked over this overlay (z-40 over z-30). */}
      {feedbackTake ? (
        <FeedbackOverlay
          arcId={feedbackTake.arcId}
          takeSessionId={feedbackTake.sessionId}
          takeIndex={feedbackTake.takeIndex}
          onClose={() => setFeedbackTake(null)}
        />
      ) : null}
      {idealArcId ? (
        <IdealTextOverlay arcId={idealArcId} onClose={() => setIdealArcId(null)} />
      ) : null}
    </div>
  );
}

/* ─────────────────── R4-13: trainings mode (arc-grouped) ────────────────── */

function TrainingsList({
  trainings,
  onOpen,
}: {
  trainings: TrainingArc[];
  onOpen: (arc: TrainingArc) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-6">
      {trainings.map((arc) => (
        <button
          key={arc.arcId}
          type="button"
          onClick={() => onOpen(arc)}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition hover:border-primary/40"
        >
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium text-foreground">
              {arc.topic}
            </span>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">
              {arc.takeCount} {arc.takeCount === 1 ? "take" : "takes"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function TrainingDetail({
  arc,
  onOpenIdeal,
  onOpenTake,
  onRecordAnother,
}: {
  arc: TrainingArc;
  /** Opens the arc's ideal-text notebook (the delivery-layer deliverable). */
  onOpenIdeal: () => void;
  /** Opens one take's feedback page. */
  onOpenTake: (t: TrainingTake) => void;
  onRecordAnother: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-6">
      {/* Delivery layer — no title beyond the navbar: the top is the big cover
          (the served deck's first page, or a calm mock) with the darker-bg
          "Open ideal presentation" button directly under it. The button sits
          BELOW the cover (not overlaid) so it can't hide SlideRender's retry
          control on a failed PDF or float over the header while it loads. */}
      <div className="flex flex-col">
        {arc.coverRef ? (
          <SlideRender
            presentationRef={arc.coverRef}
            pageIndex={0}
            title={arc.topic}
            body=""
            className="w-full"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <Mic className="h-10 w-10 text-muted-foreground/40" aria-hidden />
          </div>
        )}
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={onOpenIdeal}
            className="w-full rounded-full bg-foreground px-5 py-2.5 text-[14px] font-medium text-background transition hover:bg-foreground/90"
          >
            Open ideal presentation
          </button>
        </div>
      </div>

      {/* The take list — each row opens that take's feedback page. */}
      <div className="flex flex-col gap-2 px-4">
        {arc.takes.map((t) => (
          <button
            key={t.sessionId}
            type="button"
            onClick={() => onOpenTake(t)}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition hover:border-primary/40"
          >
            <span className="text-[15px] text-foreground">
              Take {t.takeIndex}
            </span>
            <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
              {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""}
              <ChevronDown className="h-4 w-4 -rotate-90" aria-hidden />
            </span>
          </button>
        ))}
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={onRecordAnother}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-[14px] font-medium text-foreground transition hover:bg-muted"
        >
          <Mic className="h-4 w-4" aria-hidden />
          Record another take
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────── L1 presentations ─────────────────────── */

function PresentationsList({
  presentations,
  general,
  onOpenPresentation,
  onOpenGeneral,
  onDeletePresentation,
  deleteError,
}: {
  presentations: PresentationGroup[];
  general: StrengthMoment[];
  onOpenPresentation: (p: PresentationGroup) => void;
  onOpenGeneral: () => void;
  onDeletePresentation: (p: PresentationGroup) => void;
  deleteError: string | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-10">
      {presentations.map((p) => (
        <Card
          key={p.presentationId}
          height={84}
          onClick={() => onOpenPresentation(p)}
          presentationRef={p.presentationRef}
          slideIndex={p.slides[0]?.index ?? 0}
          slideTitle={p.slides[0]?.title}
          slideBody={p.slides[0]?.body}
          title={p.topic || "Presentation"}
          sub={`${p.takes.length} take${p.takes.length === 1 ? "" : "s"}`}
          menuItems={[
            {
              label: "Delete presentation",
              danger: true,
              onClick: () => onDeletePresentation(p),
            },
          ]}
        />
      ))}

      {general.length > 0 ? (
        <Card
          height={84}
          onClick={onOpenGeneral}
          presentationRef={null}
          slideIndex={0}
          title="Other moments"
        />
      ) : null}

      {deleteError ? (
        <p className="text-[13px] text-destructive">{deleteError}</p>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── L2 presentation detail ────────────────── */

function PresentationDetail({
  presentation,
  onOpenBest,
  onOpenTake,
  onDeleteTake,
  onRecordAnother,
}: {
  presentation: PresentationGroup;
  onOpenBest: () => void;
  onOpenTake: (t: PresentationTake) => void;
  onDeleteTake: (takeNumber: number) => void;
  onRecordAnother: () => void;
}) {
  const coverSlide = presentation.slides[0];
  // The composed best presentation needs ≥3 takes (built from the recordings,
  // before any coach review). Below that, show how many more are needed
  // instead of a button that opens an empty presentation.
  const takesRemaining = Math.max(0, 3 - presentation.takes.length);
  const canOpenBest = takesRemaining === 0 && !!presentation.arcId;
  return (
    <div className="flex w-full flex-col">
      {coverSlide ? (
        <div className="relative w-full bg-muted">
          <SlideRender
            presentationRef={presentation.presentationRef}
            pageIndex={coverSlide.index}
            title={coverSlide.title}
            body={coverSlide.body}
            className="w-full"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 px-6">
            {canOpenBest ? (
              <button
                type="button"
                onClick={onOpenBest}
                className="rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-gray-900"
              >
                Open your ideal presentation
              </button>
            ) : (
              <p className="rounded-full bg-white/90 px-5 py-2.5 text-center text-[13px] font-medium text-gray-900">
                {takesRemaining > 0
                  ? `You need ${takesRemaining} more ${takesRemaining === 1 ? "recording" : "recordings"}!`
                  : "Your ideal presentation isn’t ready yet."}
              </p>
            )}
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-10 pt-4">
      {/* Record another take INTO this deck — the take accumulates in the same
          arc (continue-one-arc). Only when the deck has an arc to continue. */}
      {presentation.arcId ? (
        <button
          type="button"
          onClick={onRecordAnother}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-[14px] font-medium text-primary-foreground"
        >
          <Mic className="h-4 w-4" aria-hidden />
          Record another take
        </button>
      ) : null}

      {presentation.bestLines.length > 0 ? (
        <>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Best takes
          </p>
          <Card
            height={84}
            top
            onClick={onOpenBest}
            presentationRef={presentation.presentationRef}
            slideIndex={presentation.bestLines[0]?.index ?? 0}
            slideTitle={presentation.bestLines[0]?.title}
            slideBody={presentation.bestLines[0]?.body}
            title="Best takes"
          />
        </>
      ) : null}

      {presentation.takes.length > 0 ? (
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          All takes
        </p>
      ) : null}

      {presentation.takes.map((t) => (
        <Card
          key={t.takeNumber}
          height={84}
          onClick={() => onOpenTake(t)}
          presentationRef={t.presentationRef}
          slideIndex={t.slides[0]?.index ?? 0}
          slideTitle={t.slides[0]?.title}
          slideBody={t.slides[0]?.body}
          title={`Take ${t.takeNumber}`}
          sub={new Date(t.createdAt).toLocaleDateString()}
          menuItems={[
            {
              label: "Delete take",
              danger: true,
              onClick: () => onDeleteTake(t.takeNumber),
            },
          ]}
        />
      ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────── L3 slide list ─────────────────────────── */

function SlideList({
  deck,
  onOpenSlide,
}: {
  deck: Deck;
  onOpenSlide: (i: number) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-4 pb-10">
      {deck.slides.map((s, i) => (
        <Card
          key={`${s.index}-${i}`}
          height={108}
          onClick={() => onOpenSlide(i)}
          presentationRef={deck.presentationRef}
          slideIndex={s.index}
          slideTitle={s.title}
          slideBody={s.body}
          title={s.title || `Slide ${i + 1}`}
        />
      ))}
    </div>
  );
}

/* ─────────────────────── card + thumbnail (shared) ─────────────────────── */

type MenuItem = { label: string; onClick: () => void; danger?: boolean };

function Card({
  height,
  onClick,
  presentationRef,
  slideIndex,
  slideTitle,
  slideBody,
  title,
  sub,
  top,
  menuItems,
}: {
  height: number;
  onClick: () => void;
  presentationRef: string | null;
  slideIndex: number;
  slideTitle?: string;
  slideBody?: string;
  title: string;
  sub?: string;
  top?: boolean;
  menuItems?: MenuItem[];
}) {
  const thumbW = Math.round((height * 16) / 9);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* click-outside close */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        style={{ height }}
        className={`flex w-full items-stretch overflow-hidden rounded-xl border text-left transition active:scale-[0.995] ${
          top
            ? "border-primary/40 bg-primary/[0.04] hover:bg-primary/[0.07]"
            : "border-border bg-card hover:bg-muted/50"
        }`}
      >
        <div className="shrink-0" style={{ width: thumbW }}>
          <Thumb
            presentationRef={presentationRef}
            slideIndex={slideIndex}
            slideTitle={slideTitle}
            slideBody={slideBody}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-4">
          <span className="line-clamp-2 text-[15px] font-medium text-foreground">
            {title}
          </span>
          {sub ? (
            <span className="mt-0.5 text-[13px] text-muted-foreground">{sub}</span>
          ) : null}
        </div>
      </button>

      {menuItems && menuItems.length > 0 ? (
        <div ref={menuRef} className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
          <button
            type="button"
            aria-label="More options"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen ? (
            <div className="absolute right-2 top-8 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-md">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    item.onClick();
                  }}
                  className={`block w-full px-4 py-2 text-left text-[14px] hover:bg-muted ${
                    item.danger ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Thumb({
  presentationRef,
  slideIndex,
  slideTitle = "",
  slideBody = "",
}: {
  presentationRef: string | null;
  slideIndex: number;
  slideTitle?: string;
  slideBody?: string;
}) {
  return (
    <div className="h-full w-full overflow-hidden bg-muted">
      <SlideRender
        presentationRef={presentationRef}
        pageIndex={slideIndex}
        title={slideTitle}
        body={slideBody}
        className="h-full w-full"
      />
    </div>
  );
}

/* ─────────────────────── L4: LibraryMomentPage ──────────────────────────── */

function LibraryMomentPage({
  deck,
  slideIdx,
  onSlideIdx,
  onClose,
}: {
  deck: Deck;
  slideIdx: number;
  onSlideIdx: (i: number) => void;
  onClose: () => void;
}) {
  const total = deck.slides.length;
  const s = deck.slides[slideIdx];

  const atLast = slideIdx >= total - 1;

  return (
    <SnippetScreenShell
      onClose={onClose}
      index={slideIdx}
      total={Math.max(total, 1)}
      onPrev={() => onSlideIdx(slideIdx - 1)}
      onNext={atLast ? onClose : () => onSlideIdx(slideIdx + 1)}
      nextLabel={atLast ? "Close" : undefined}
      nextTone={atLast ? "terminal" : "primary"}
      managed={false}
    >
      {s ? <MomentCard deck={deck} slide={s} /> : null}
    </SnippetScreenShell>
  );
}

function MomentCard({ deck, slide }: { deck: Deck; slide: DeckSlide }) {
  const m = slide.moment;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasReveal = !!(m?.audioRef || m?.note || m?.features);
  // C / BE #6 — take view: when the slide carries its verbatim transcript /
  // own audio, show them directly (transcript + always-visible player, like
  // the readout) instead of the single best moment. Falls back to the moment
  // for the general deck and any take that predates the BE field.
  const showVerbatim = !!(slide.transcript || slide.audioRef);

  return (
    <div className="flex flex-col">
      {/* Slide — edge-to-edge */}
      <div className="w-full bg-muted">
        {deck.presentationRef ? (
          <SlideRender
            presentationRef={deck.presentationRef}
            pageIndex={slide.index}
            title={slide.title}
            body={slide.body}
            className="w-full"
          />
        ) : slide.title || slide.body ? (
          <TextSlide title={slide.title} body={slide.body} />
        ) : (
          <SlidePlaceholder className="w-full" />
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Take label */}
        {deck.takeTitle ? (
          <p className="text-[12px] text-muted-foreground">{deck.takeTitle}</p>
        ) : null}

        {showVerbatim ? (
          <>
            {/* Playback FIRST — directly below the slide — then the transcript. */}
            {slide.audioRef ? (
              <MediaPlayer
                src={slide.audioRef}
                startOffsetMs={slide.startOffsetMs}
                durationMs={slide.durationMs}
              />
            ) : null}
            {slide.transcript ? (
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                {slide.transcript}
              </p>
            ) : null}
          </>
        ) : m ? (
          <>
            {/* Transcript — warm-tint; chevron toggles the in-place expand */}
            {m.transcript ? (
              <div
                role={hasReveal ? "button" : undefined}
                tabIndex={hasReveal ? 0 : undefined}
                onClick={hasReveal ? () => setDetailsOpen((v) => !v) : undefined}
                onKeyDown={
                  hasReveal
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ")
                          setDetailsOpen((v) => !v);
                      }
                    : undefined
                }
                aria-expanded={hasReveal ? detailsOpen : undefined}
                className={`flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3 ${hasReveal ? "cursor-pointer" : ""}`}
              >
                <p className="flex-1 text-[15px] leading-relaxed text-foreground">
                  {m.transcript}
                </p>
                {hasReveal ? (
                  <ChevronDown
                    className={`mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                ) : null}
              </div>
            ) : null}

            {/* Expanded, in place: player → coach note → metrics */}
            {detailsOpen && hasReveal ? (
              <div className="flex flex-col gap-4">
                {m.audioRef ? (
                  <MediaPlayer
                    src={m.audioRef}
                    startOffsetMs={m.startOffsetMs ?? 0}
                    durationMs={m.durationMs ?? 0}
                  />
                ) : null}
                {m.note ? (
                  <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                    {m.note}
                  </p>
                ) : null}
                {m.features ? (
                  <FeaturesDataBlock features={m.features} />
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[15px] text-muted-foreground">
            No standout moment on this slide yet.
          </p>
        )}
      </div>
    </div>
  );
}

function FeaturesDataBlock({ features: f }: { features: ReadoutFeatures }) {
  const hz = (v: number | null) => (v != null ? `${Math.round(v)} Hz` : "-");
  const pct = (v: number | null) => (v != null ? `${Math.round(v * 100)}%` : "-");
  const spd = (v: number | null) => (v != null ? `${Math.round(v)} wpm` : "-");
  const db = (v: number | null) => (v != null ? `${Math.round(v)} dB` : "-");
  return (
    <div className="flex flex-col gap-1 text-[15px] leading-relaxed text-foreground">
      <p>Pitch: F0 mean {hz(f.f0Mean)}, SD {hz(f.f0Sd)}</p>
      <p>Pace: {spd(f.speechRate)}, pause {pct(f.pauseRatio)}</p>
      <p>Volume: range {db(f.loudnessRange)}, voiced {pct(f.voicedRatio)}</p>
    </div>
  );
}

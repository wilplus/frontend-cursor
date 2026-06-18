"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MoreHorizontal, X } from "lucide-react";
import {
  deletePresentation,
  deleteTake,
  fetchStrengths,
  type PresentationGroup,
  type PresentationTake,
  type StrengthMoment,
  type StrengthsView,
} from "@/services/api/strengths";
import MediaPlayer from "@/components/results/MediaPlayer";
import { SlideRender, TextSlide } from "./pdfSlides";
import { SlidePlaceholder } from "./SlideTake";
import SnippetScreenShell from "./SnippetScreenShell";
import { useBackDismiss } from "./useBackDismiss";
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
};
type Deck = {
  topic: string;
  takeLabel: string;
  takeTitle: string;
  presentationRef: string | null;
  slides: DeckSlide[];
};

function bestLinesDeck(p: PresentationGroup): Deck {
  return {
    topic: p.topic || "Presentation",
    takeLabel: "best takes",
    takeTitle: "Your ideal presentation",
    presentationRef: p.presentationRef,
    slides: p.bestLines.map((b) => ({
      index: b.index,
      title: b.title,
      body: b.body,
      moment: b.moment,
    })),
  };
}

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
    })),
  };
}

const generalDeck = (moments: StrengthMoment[]): Deck => ({
  topic: "General strengths",
  takeLabel: "general",
  takeTitle: "",
  presentationRef: null,
  slides: moments.map((m, i) => ({ index: i, title: "", body: "", moment: m })),
});

/* ─────────────────────── nav state ────────────────────────────────────── */

type NavLevel =
  | { level: "L1" }
  | { level: "L2"; presentation: PresentationGroup }
  | { level: "L2g" }
  | { level: "L3"; deck: Deck; topic: string; takeLabel: string }
  | { level: "L4"; deck: Deck; topic: string; takeLabel: string; slideIdx: number };

export default function LibraryOverlay({ onClose }: { onClose: () => void }) {
  useBackDismiss(onClose);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [presentations, setPresentations] = useState<PresentationGroup[]>([]);
  const [general, setGeneral] = useState<StrengthMoment[]>([]);
  const [nav, setNav] = useState<NavLevel>({ level: "L1" });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchStrengths().then((v) => {
      if (!active) return;
      setPresentations(v.presentations);
      setGeneral(v.general);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  const isEmpty =
    presentations.length === 0 && general.length === 0;

  /* ── breadcrumbs ── */
  const goL1 = () => setNav({ level: "L1" });
  const goL2 = (p: PresentationGroup) => setNav({ level: "L2", presentation: p });

  const crumbs: { label: string; onClick?: () => void }[] = (() => {
    if (nav.level === "L1") return [{ label: "Trainings" }];
    if (nav.level === "L2") {
      return [
        { label: "Trainings", onClick: goL1 },
        { label: nav.presentation.topic || "Presentation" },
      ];
    }
    if (nav.level === "L2g") {
      return [
        { label: "Trainings", onClick: goL1 },
        { label: "Other moments" },
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
        { label: "Trainings", onClick: goL1 },
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
        { label: "Trainings", onClick: goL1 },
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
    return [{ label: "Trainings" }];
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-3 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
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
            onOpenBest={() =>
              openDeck(
                bestLinesDeck(nav.presentation),
                nav.presentation.topic || "Presentation",
                "best takes"
              )
            }
            onOpenTake={(t) =>
              openDeck(
                takeDeck(t, nav.presentation.topic),
                nav.presentation.topic || "Presentation",
                `take ${t.takeNumber}`
              )
            }
            onDeleteTake={(tn) => handleDeleteTake(nav.presentation.presentationId, tn)}
          />
        ) : nav.level === "L2g" ? (
          <SlideList
            deck={generalDeck(general)}
            onOpenSlide={(i) => {
              const deck = generalDeck(general);
              setNav({ level: "L4", deck, topic: "Other moments", takeLabel: "general", slideIdx: i });
            }}
          />
        ) : isEmpty ? (
          <p className="mx-auto w-full max-w-2xl px-4 text-[15px] text-muted-foreground">
            Nothing here yet. Your strongest moments collect here as your coach
            sends reads.
          </p>
        ) : (
          <PresentationsList
            presentations={presentations}
            general={general}
            onOpenPresentation={(p) => {
              // update nav to L2 with fresh presentation state
              goL2(p);
            }}
            onOpenGeneral={() => setNav({ level: "L2g" })}
            onDeletePresentation={handleDeletePresentation}
            deleteError={deleteError}
          />
        )}
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
}: {
  presentation: PresentationGroup;
  onOpenBest: () => void;
  onOpenTake: (t: PresentationTake) => void;
  onDeleteTake: (takeNumber: number) => void;
}) {
  const coverSlide = presentation.slides[0];
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <button
              type="button"
              onClick={onOpenBest}
              className="rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-gray-900"
            >
              Open your ideal presentation
            </button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-10 pt-4">
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

  return (
    <SnippetScreenShell
      onClose={onClose}
      index={slideIdx}
      total={Math.max(total, 1)}
      onPrev={() => onSlideIdx(slideIdx - 1)}
      onNext={() => onSlideIdx(slideIdx + 1)}
      nextDisabled={slideIdx >= total - 1}
      managed={false}
    >
      {s ? <MomentCard deck={deck} slide={s} /> : null}
    </SnippetScreenShell>
  );
}

function MomentCard({ deck, slide }: { deck: Deck; slide: DeckSlide }) {
  const m = slide.moment;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasDetails = !!(m?.note || m?.features);

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

        {m ? (
          <>
            {m.audioRef ? (
              <MediaPlayer
                src={m.audioRef}
                startOffsetMs={m.startOffsetMs ?? 0}
                durationMs={m.durationMs ?? 0}
              />
            ) : null}

            {/* Transcript — warm-tint, tap to reveal note + data */}
            {m.transcript ? (
              <div
                role={hasDetails ? "button" : undefined}
                tabIndex={hasDetails ? 0 : undefined}
                onClick={hasDetails ? () => setDetailsOpen((v) => !v) : undefined}
                onKeyDown={
                  hasDetails
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ")
                          setDetailsOpen((v) => !v);
                      }
                    : undefined
                }
                aria-expanded={hasDetails ? detailsOpen : undefined}
                className={`rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3 ${hasDetails ? "cursor-pointer" : ""}`}
              >
                <p className="text-[15px] leading-relaxed text-foreground">
                  {m.transcript}
                </p>
              </div>
            ) : null}

            {/* Expanded: coach note + metrics */}
            {detailsOpen && hasDetails ? (
              <div className="flex flex-col gap-3">
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

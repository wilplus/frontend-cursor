"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Menu, X } from "lucide-react";
import Logo from "@/components/Logo";

/**
 * WillpowerLab — About / Timeline.
 *
 * A single vertical timeline that opens centered on "now": scroll UP for
 * the future (vision → near-term), DOWN for the history (recent → origin).
 * Pure white/black/gray, with the brand orange reserved for the one
 * "we are here" focal block and the Vision dot — nothing else is orange.
 *
 * NOTE: the copy below is MOCK placeholder, to be replaced with real
 * descriptions. The timeline images use the WillpowerLab dots (/icon) as the
 * brand mark until real photos land — trivial to swap per entry.
 */

type Entry = {
  side: "left" | "right";
  date: string;
  title: string;
  body: string;
  image?: { src: string; alt: string };
  /** Orange dot — reserved for the Vision entry only. */
  emphasis?: boolean;
};

// Future — rendered top → bottom (furthest-out first). Scroll UP from now.
const FUTURE: Entry[] = [
  {
    side: "left",
    date: "Vision",
    title: "A world that rewards substance over polish",
    body: "Training so good that being heard no longer depends on where you were born or how you look.",
    emphasis: true,
  },
  {
    side: "right",
    date: "2030",
    title: "A global charisma standard",
    body: "WillpowerLab protocols used by universities and accelerators on five continents.",
    image: {
      src: "/icon",
      alt: "The WillpowerLab dots",
    },
  },
  {
    side: "left",
    date: "2028",
    title: "Real-time coaching, in your ear",
    body: "Live, on-device feedback during the talk itself — not only after it.",
  },
  {
    side: "left",
    date: "2027 — on",
    title: "Research work, patents, PhDs",
    body: "Peer-reviewed protocols and the science behind charismatic delivery.",
    image: {
      src: "/icon",
      alt: "The WillpowerLab dots",
    },
  },
];

// Past — rendered top → bottom (most-recent first). Scroll DOWN from now.
const PAST: Entry[] = [
  {
    side: "right",
    date: "2025",
    title: "The first 1,000 speakers",
    body: "Early users put the method to work in interviews, pitches, and demos.",
  },
  {
    side: "left",
    date: "2024",
    title: "The first studio",
    body: "We built the recording-and-analysis loop that turns a voice into a map.",
    image: {
      src: "/icon",
      alt: "The WillpowerLab dots",
    },
  },
  {
    side: "right",
    date: "2023",
    title: "Naming emotions, measured",
    body: "NECP — our protocol for surfacing an authentic baseline before training.",
  },
  {
    side: "left",
    date: "2022",
    title: "The question that started it",
    body: "Why do some people command a room while others — just as capable — don't?",
  },
  {
    side: "right",
    date: "Origin",
    title: "Three dots and a hunch",
    body: "WillpowerLab began as a side experiment in whether presence could be taught.",
  },
];

/** 1px line down the center of a section; cards/dots paint over it. */
function TimelineLine() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border"
    />
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  return (
    <div
      className={`inline-block max-w-sm animate-fade-in-up text-left ${
        entry.side === "left" ? "ml-auto" : ""
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {entry.date}
      </div>
      <h3 className="mt-1 text-[15px] font-semibold leading-snug tracking-tight">
        {entry.title}
      </h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
        {entry.body}
      </p>
      {entry.image && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.image.src}
            alt={entry.image.alt}
            loading="lazy"
            className="h-44 w-full object-contain p-6"
          />
        </div>
      )}
    </div>
  );
}

/** One row: left cell · center dot · right cell. The dot's ring punches
 *  through the line; the card sits in whichever cell matches `side`. */
function TimelineItem({ entry }: { entry: Entry }) {
  return (
    <li className="relative grid grid-cols-[1fr_auto_1fr] items-start gap-4">
      <div className="pr-2 text-right md:pr-6">
        {entry.side === "left" && <EntryCard entry={entry} />}
      </div>
      <div className="relative flex justify-center pt-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ring-4 ring-background ${
            entry.emphasis ? "bg-primary" : "bg-foreground"
          }`}
        />
      </div>
      <div className="pl-2 md:pl-6">
        {entry.side === "right" && <EntryCard entry={entry} />}
      </div>
    </li>
  );
}

/** Uppercase pill overlaid on the line to label a section. */
function SectionLabel({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <div className="relative flex justify-center">
      <span className="relative inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {children}
      </span>
    </div>
  );
}

export default function AboutTimeline() {
  const nowRef = useRef<HTMLDivElement>(null);
  const pastRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // The whole UX premise: open centered on "now". Defer to after the
  // first paint (two rAFs) so the scroll container has its final height
  // before we jump — otherwise the effect fires mid-layout and lands at
  // the wrong offset.
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        nowRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  return (
    <div className="bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur">
        <Link href="/" className="no-underline" aria-label="WillpowerLab — home">
          <Logo />
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-muted active:scale-95"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {menuOpen && (
            <>
              {/* click-away backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <nav className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-xl border border-border bg-background py-1 shadow-lg">
                {[
                  { href: "/", label: "Home" },
                  { href: "/about", label: "About" },
                  { href: "/science", label: "Science" },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-[13px] text-foreground no-underline transition hover:bg-muted"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        {/* FUTURE — scroll up to reach */}
        <section className="relative pt-24">
          <TimelineLine />
          <SectionLabel icon={<ArrowUp className="h-3.5 w-3.5" />}>
            The future
          </SectionLabel>
          <ul className="mt-16 space-y-16">
            {FUTURE.map((e, i) => (
              <TimelineItem key={`future-${i}`} entry={e} />
            ))}
          </ul>
        </section>

        {/* NOW — centered on load */}
        <div ref={nowRef} className="relative py-10">
          <TimelineLine />
          <div className="relative mx-auto max-w-xl animate-fade-in-up text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.06] px-3 py-1 text-[12px] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              We are here · Today
            </div>
            <h2 className="mt-5 text-[20px] font-semibold leading-snug tracking-tight">
              We have just launched the Willpower Laboratory
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Its main purpose is to help you persist in your journey — to beat
              the stress on the stage.
            </p>
            <button
              type="button"
              onClick={() =>
                pastRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              className="mt-8 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-[13px] font-medium shadow-sm transition hover:bg-muted active:scale-[.98]"
            >
              See our history <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* PAST — scroll down to reach */}
        <section ref={pastRef} className="relative pb-32">
          <TimelineLine />
          <SectionLabel icon={<ArrowDown className="h-3.5 w-3.5" />}>
            Our history
          </SectionLabel>
          <ul className="mt-16 space-y-16">
            {PAST.map((e, i) => (
              <TimelineItem key={`past-${i}`} entry={e} />
            ))}
          </ul>
          {/* terminal dot — closes the line */}
          <div className="relative mt-16 flex justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-border ring-4 ring-background" />
          </div>
        </section>
      </main>
    </div>
  );
}

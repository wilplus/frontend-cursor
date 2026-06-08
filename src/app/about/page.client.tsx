"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Image as ImageIcon, Quote } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";

/**
 * WillpowerLab — About / Timeline.
 *
 * A single vertical timeline of the founder's path, anchored on "now"
 * (WillpowerLab). It opens scroll-centered on now: scroll UP for the
 * future (vision → near-term), DOWN for the history (recent → origin).
 * Pure white/black/gray, with the brand orange reserved for the
 * "we are here" focal block, the Vision dot, and the testimonial marks.
 *
 * MEDIA SLOTS — the EEG photo, EU/Swiss logos, and Mazowiecki logo are
 * labelled <MediaPlaceholder> boxes for now; drop real assets in later.
 * Testimonial avatars are initials placeholders.
 */

type Media = { kind: "photo" | "logo"; label: string };

type Entry = {
  side: "left" | "right";
  date: string;
  title: string;
  body: string;
  media?: Media;
  /** A real image (takes precedence over the placeholder slot). */
  image?: { src: string; alt: string };
  /** A row of small logos (e.g. funder/affiliation marks). */
  logos?: { src: string; alt: string }[];
  /** Orange dot — reserved for the Vision entry. */
  emphasis?: boolean;
};

type Testimonial = { quote: string; name: string; role: string };

// Future — rendered top → bottom (furthest-out first). Scroll UP from now.
const FUTURE: Entry[] = [
  {
    side: "left",
    date: "Vision",
    title: "Charisma, made measurable",
    body: "A future where presence is trained with science — physiology, emotion, and delivery in one loop — so anyone can be heard.",
    emphasis: true,
  },
  {
    side: "right",
    date: "2031 —",
    title: "Advanced wearables",
    body: "Continuous sensing of presence and affect, in the moments that matter most.",
  },
  {
    side: "left",
    date: "2031",
    title: "Affective-states research, completed",
    body: "A validated model linking inner emotional state to outward delivery.",
  },
  {
    side: "right",
    date: "2028",
    title: "Physiological calibration",
    body: "Tuning the analysis to each speaker's own baseline signals.",
  },
  {
    side: "left",
    date: "2027 —",
    title: "PhD",
    body: "Formalising the method into peer-reviewed, defensible science.",
  },
];

// History (recent half) — shown directly below "now", before testimonials.
const PAST_RECENT: Entry[] = [
  {
    side: "right",
    date: "2026",
    title: "Collaboration with AWF's neuro-psycho-physiology lab",
    body: "Grounding the method in physiology with Warsaw's University of Physical Education (AWF).",
    image: {
      src: "/about/eeg-research.jpg",
      alt: "EEG electrode cap fitted on a mannequin head in the neuro-psycho-physiology lab",
    },
  },
  {
    side: "left",
    date: "2025 — 2026",
    title: "Early testing",
    body: "First speakers put the method to work in real interviews, pitches, and talks.",
    image: {
      src: "/about/photos/early-testing.jpg",
      alt: "WillpowerLab's founder leading a 'Move your body' workshop session",
    },
  },
];

// History (earlier half) — shown after the testimonials, down to the origin.
const PAST_EARLIER: Entry[] = [
  {
    side: "right",
    date: "2024",
    title: "EU case study · LLMs in institutions",
    body: "A case study at the EU level, alongside research on large language models in institutional contexts.",
  },
  {
    side: "left",
    date: "2022",
    title: "Prize of the Superintendent of Education",
    body: "Recognised by the Mazovian Education Authority (Mazowiecki Kurator Oświaty).",
    logos: [
      {
        src: "/about/logos/poland.svg",
        alt: "Mazovian Education Authority — national emblem of Poland",
      },
    ],
  },
  {
    side: "right",
    date: "2018 — 2022",
    title: "Projects in the EU health framework",
    body: "Multiple projects under EU health programmes and Swiss Contribution grants.",
    logos: [
      { src: "/about/logos/eu.svg", alt: "European Union emblem" },
      { src: "/about/logos/swiss.svg", alt: "Switzerland — Swiss Contribution" },
    ],
  },
  {
    side: "left",
    date: "2019",
    title: "Wearables in lifestyle health",
    body: "Research on how wearable signals reflect everyday health and behaviour.",
  },
  {
    side: "right",
    date: "2014 —",
    title: "Lecturing",
    body: "Teaching and speaking — where the coaching craft began.",
  },
  {
    side: "left",
    date: "2000 —",
    title: "Institutional work and practice",
    body: "Two decades of applied work inside institutions.",
  },
  {
    side: "right",
    date: "2000",
    title: "Where it began",
    body: "A social analysis of society's approach toward people with mental disabilities — the root of a career spent on people.",
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Artur is the best, couldn't ask for a better tutor! He truly listens to your needs and expectations and plans every class accordingly. Highly recommend if you want to get better at sales or public speaking!",
    name: "Julian Flieller",
    role: "AI Engineer, Palo Alto, US",
  },
  {
    quote:
      "Artur is very open and approachable, pleasant to work with, and truly listens to his students. His knowledge comes from real-life experience, which makes his lessons practical and valuable.",
    name: "Maciej Kuster",
    role: "Software Engineer, Gdańsk, Poland",
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

/** Labelled placeholder for a real photo/logo the user will supply. */
function MediaPlaceholder({ media }: { media: Media }) {
  return (
    <div
      className={`mt-3 flex w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/60 ${
        media.kind === "logo" ? "h-24" : "h-44"
      }`}
    >
      <div className="flex flex-col items-center gap-1.5 px-3 text-center text-muted-foreground">
        <ImageIcon className="h-5 w-5" aria-hidden />
        <span className="text-[11px] uppercase tracking-[0.12em]">
          {media.label}
        </span>
      </div>
    </div>
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
      {entry.image ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.image.src}
            alt={entry.image.alt}
            loading="lazy"
            className="h-52 w-full object-cover"
          />
        </div>
      ) : entry.logos ? (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
          {entry.logos.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={l.src}
              src={l.src}
              alt={l.alt}
              loading="lazy"
              className="h-10 w-auto object-contain"
            />
          ))}
        </div>
      ) : entry.media ? (
        <MediaPlaceholder media={entry.media} />
      ) : null}
    </div>
  );
}

/** One row: left cell · center dot · right cell. */
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
function SectionLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="relative flex justify-center">
      <span className="relative inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {children}
      </span>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <figure className="animate-fade-in-up rounded-2xl border border-border bg-card p-6 shadow-sm">
      <Quote className="h-7 w-7 text-primary/40" aria-hidden />
      <blockquote className="mt-3 text-[14px] italic leading-relaxed text-foreground/90">
        &ldquo;{t.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-muted-foreground">
          {initials(t.name)}
        </div>
        <div>
          <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
          <div className="text-[12px] text-muted-foreground">{t.role}</div>
        </div>
      </figcaption>
    </figure>
  );
}

export default function AboutTimeline() {
  const nowRef = useRef<HTMLDivElement>(null);
  const pastRef = useRef<HTMLElement>(null);

  // Open scroll-centered on "now". Defer to after first paint (two rAFs)
  // so the scroll container has its final height before we jump.
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
      <SiteHeader />

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

        {/* HISTORY — scroll down to reach */}
        <section ref={pastRef} className="relative pb-32">
          <TimelineLine />
          <SectionLabel icon={<ArrowDown className="h-3.5 w-3.5" />}>
            Our history
          </SectionLabel>

          <ul className="mt-16 space-y-16">
            {PAST_RECENT.map((e, i) => (
              <TimelineItem key={`recent-${i}`} entry={e} />
            ))}
          </ul>

          {/* Testimonials — sit on the line between recent and earlier history */}
          <div className="relative mt-16">
            <SectionLabel>In their words</SectionLabel>
            <div className="relative mt-10 grid gap-4 sm:grid-cols-2">
              {TESTIMONIALS.map((t, i) => (
                <TestimonialCard key={`tm-${i}`} t={t} />
              ))}
            </div>
          </div>

          <ul className="mt-16 space-y-16">
            {PAST_EARLIER.map((e, i) => (
              <TimelineItem key={`earlier-${i}`} entry={e} />
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

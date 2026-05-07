import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Science | Willab",
  description:
    "The research foundation behind Willab — Charismatic Flow State, EBCP, and biologically-grounded charisma training.",
};

const PAPERS: ReadonlyArray<{
  title: string;
  description: string;
  href: string;
}> = [
  {
    title: "Charismatic Flow State",
    description:
      "How charisma and stress share an identical biological substrate, and how that high-energy state can be redirected into magnetic presence.",
    href: "#",
  },
  {
    title: "EBCP — Emotion-Based Collaborative Prompting",
    description:
      "Our framework for using small cognitive-load primes to surface a speaker's authentic baseline before any training interventions.",
    href: "#",
  },
  {
    title: "Acoustic markers of stress and charisma",
    description:
      "WPM, pitch variance, dynamic dB, pause-rate and emphasis-per-minute — what we measure, why we measure it, and how the thresholds were calibrated.",
    href: "#",
  },
];

export default function SciencePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back home
      </Link>

      <header className="mb-10 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          The Science
        </h1>
        <p className="text-muted-foreground">
          Three papers + research notes that frame how Willab thinks about
          charisma, stress, and trainable speaker presence.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PAPERS.map((paper) => (
          <a
            key={paper.title}
            href={paper.href}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 no-underline transition-colors hover:bg-secondary/50"
          >
            <FileText className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="text-base font-semibold text-foreground">
              {paper.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {paper.description}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

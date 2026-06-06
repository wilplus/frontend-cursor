import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Science | WillpowerLab",
  description:
    "The research foundation behind WillpowerLab — EBCP, NECP, and biologically-grounded charisma training.",
};

const PAPERS: ReadonlyArray<{
  title: string;
  description: string;
  href: string;
}> = [
  {
    title: "EBCP — Emotion-Based Collaborative Prompting",
    description:
      "Our framework for using small cognitive-load primes to surface a speaker's authentic baseline before any training interventions.",
    href: "/papers/EBCP.pdf",
  },
  {
    title: "NECP — Naming Emotions Collaborative Prompting",
    description:
      "How naming emotions in the corporate workplace reduces emotional bias in competence assessments and provides a scalable method for measuring learnability.",
    href: "/papers/naming-emotions-paper.pdf",
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
          The research that frames how WillpowerLab thinks about charisma, stress,
          and trainable speaker presence.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PAPERS.map((paper) => (
          <a
            key={paper.title}
            href={paper.href}
            target={paper.href !== "#" ? "_blank" : undefined}
            rel={paper.href !== "#" ? "noopener noreferrer" : undefined}
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

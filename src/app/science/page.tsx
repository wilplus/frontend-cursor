import type { Metadata } from "next";
import { FileText } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Science | WillpowerLab",
  description:
    "The research foundation behind WillpowerLab — EBCP, NECP, and biologically-grounded charisma training.",
  alternates: { canonical: "/science" },
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
    <div className="bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <header className="mb-10 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            The Science
          </h1>
          <p className="text-muted-foreground">
            The research that frames how WillpowerLab thinks about charisma,
            stress, and trainable speaker presence.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
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
      </main>
    </div>
  );
}

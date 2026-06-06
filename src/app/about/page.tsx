import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us | WillpowerLab",
  description:
    "WillpowerLab — voice analysis that turns stress into charisma. Meet the team and the mission behind biologically-grounded charisma training.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Us | WillpowerLab",
    description:
      "WillpowerLab — voice analysis that turns stress into charisma.",
    url: "https://www.willpowerlab.com/about",
    type: "website",
  },
};

const PRINCIPLES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Charisma is trainable",
    body: "Presence isn't a fixed trait you're born with. It's a set of vocal and emotional patterns that can be measured, practised, and improved — the same way an athlete trains a movement.",
  },
  {
    title: "Stress is the signal",
    body: "The moments where stress takes over your voice are exactly the moments worth working on. WillpowerLab finds them so you can hear yourself the way a room hears you.",
  },
  {
    title: "Grounded in research",
    body: "Our methods sit on a published foundation — EBCP and NECP — rather than generic speaking tips. The science is open and we keep it that way.",
  },
];

export default function AboutPage() {
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
          About Us
        </h1>
        <p className="text-muted-foreground">
          Turning stress into charisma.
        </p>
      </header>

      <section className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
        <p>
          WillpowerLab analyses your voice and shows you the exact moments where you
          sound powerful — and where stress takes over. Instead of vague advice
          to &ldquo;sound more confident,&rdquo; it points to the specific
          seconds that shaped how you came across, and turns them into something
          you can practise.
        </p>
        <p>
          We started WillpowerLab because the people who most need to be heard —
          in interviews, pitches, and hard conversations — are usually the ones
          stress works against. Charisma gets treated like a gift. We treat it
          like a skill, with measurement and feedback that actually moves it.
        </p>
      </section>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {PRINCIPLES.map((p) => (
          <div
            key={p.title}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-base font-semibold text-foreground">
              {p.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {p.body}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-10 rounded-xl border border-border bg-secondary/30 p-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Curious how the analysis works under the hood? Read{" "}
          <Link
            href="/science"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            the science
          </Link>{" "}
          behind WillpowerLab, or{" "}
          <Link
            href="/chat"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            try it yourself
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

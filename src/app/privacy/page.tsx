import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | WillpowerLab",
  description: "How WillpowerLab collects, stores, and protects your data.",
};

/**
 * TODO(content): swap the placeholder copy below for the legally-reviewed
 * Privacy Policy text once it's finalised. The wrapper, typography and
 * back-link are stable; only the body content should change.
 */
export default function PrivacyPage() {
  const lastUpdated = "May 7, 2026";
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back home
      </Link>

      <article className="space-y-6 text-sm leading-relaxed text-foreground">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">
            Last updated {lastUpdated}
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">What we collect</h2>
          <p className="text-muted-foreground">
            Voice recordings you submit, the transcripts derived from them,
            the acoustic metrics our analysis pipeline produces, and the
            account information you provide (email, name, optional profile
            details).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">How we use it</h2>
          <p className="text-muted-foreground">
            To generate your personalised Charisma Snippets, to train the
            classifier that picks out your charismatic and stress moments,
            and to send you the email notifications you opted into.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Storage &amp; retention</h2>
          <p className="text-muted-foreground">
            Recordings are stored in encrypted Supabase storage. You can
            request deletion of your account and associated recordings at
            any time by emailing artur@willonski.com.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Third parties</h2>
          <p className="text-muted-foreground">
            We use Supabase for authentication and storage, Whisper for
            transcription, and Anthropic / OpenAI for LLM-driven question
            generation. We do not sell your data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Questions? Email{" "}
            <a
              href="mailto:artur@willonski.com"
              className="text-primary no-underline hover:underline"
            >
              artur@willonski.com
            </a>
            .
          </p>
        </section>
      </article>
    </div>
  );
}

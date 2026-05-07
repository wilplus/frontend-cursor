import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Use | Willab",
  description: "The terms that govern your use of Willab.",
};

/**
 * TODO(content): swap the placeholder copy below for the legally-reviewed
 * Terms of Use text once it's finalised. The wrapper, typography and
 * back-link are stable; only the body content should change.
 */
export default function TermsPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
          <p className="text-xs text-muted-foreground">
            Last updated {lastUpdated}
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Acceptance</h2>
          <p className="text-muted-foreground">
            By creating an account or recording a voice sample on Willab,
            you agree to these Terms of Use and to our{" "}
            <Link
              href="/privacy"
              className="text-primary no-underline hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Account &amp; eligibility</h2>
          <p className="text-muted-foreground">
            You must be at least 18 years old to use Willab. You are
            responsible for keeping your login credentials secure and for
            all activity under your account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Acceptable use</h2>
          <p className="text-muted-foreground">
            Don&apos;t upload audio that isn&apos;t yours, doesn&apos;t
            belong to a person who consented to its use, or that contains
            unlawful, harassing, or abusive content. We can suspend
            accounts that violate this clause.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Coaching &amp; insights</h2>
          <p className="text-muted-foreground">
            Charisma Snippets and acoustic metrics are educational tools.
            They are not medical, psychological, or professional advice.
            Outcomes depend on practice and circumstances we don&apos;t
            control.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Termination</h2>
          <p className="text-muted-foreground">
            You can delete your account anytime by emailing{" "}
            <a
              href="mailto:artur@willonski.com"
              className="text-primary no-underline hover:underline"
            >
              artur@willonski.com
            </a>
            . We can terminate accounts that breach these terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Changes</h2>
          <p className="text-muted-foreground">
            We may update these terms; the &quot;Last updated&quot; date
            reflects the most recent change. Continued use after a change
            counts as acceptance.
          </p>
        </section>
      </article>
    </div>
  );
}

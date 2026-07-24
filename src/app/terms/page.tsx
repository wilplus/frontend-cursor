import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | WillpowerLab",
  description: "The terms that govern your use of WillpowerLab.",
};

/**
 * Terms of Service v1.0 (effective 23 July 2026). Body content is the
 * operator's commissioned draft. The wrapper, typography and back-link match
 * the Privacy page and are stable.
 *
 * PRE-LAUNCH CHECKLIST — no blanks remain in the copy; confirm before go-live:
 *  - §1/§11: the operator's exact legal name / diacritics.
 *  - §5: model is per-presentation, one-time unlock (moments), core Service
 *    free, no subscription; the price lives at checkout, not in this copy.
 *    Confirm the express-consent (immediate-performance) checkbox is actually
 *    implemented at checkout so the withdrawal-waiver wording is truthful.
 *  - §8: liability-cap floor set to EUR 100.
 *  - Article 9 voice-data characterisation: confirm with admitted Polish counsel.
 *  - Confirm the 30-day voice-data deletion window is enforced by the backend.
 *  - Update the operating-entity details once the activity is registered.
 */
export default function TermsPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs text-muted-foreground">
            Effective date: 23 July 2026. Version 1.0. Last updated: 23 July
            2026.
          </p>
        </header>

        {/* 1 — Acceptance & eligibility */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            1. Acceptance of terms and eligibility
          </h2>
          <p className="text-muted-foreground">
            These Terms of Service (&quot;Terms&quot;) form a binding agreement
            between you and <strong>Artur Willoński</strong>, an individual
            operating the <strong>WillpowerLab</strong> service as unregistered
            business activity (<em>działalność nieewidencjonowana</em>) in Poland
            (&quot;WillpowerLab&quot;, &quot;we&quot;, &quot;us&quot;). By
            creating an account or using the Service, you agree to these Terms and
            to our{" "}
            <Link
              href="/privacy"
              className="text-primary no-underline hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
          <p className="text-muted-foreground">
            You must be <strong>at least 18 years old</strong> and have the legal
            capacity to enter into a contract. If you use the Service on behalf of
            an organisation, you represent that you are authorised to bind that
            organisation.
          </p>
        </section>

        {/* 2 — Description */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Description of the Service</h2>
          <p className="text-muted-foreground">
            WillpowerLab provides{" "}
            <strong>AI-assisted speech analysis and text-assembly tools</strong>{" "}
            for presentation and public-speaking practice. The Service records
            your voice, generates transcripts, analyses speech delivery (such as
            flow, filler words, and structure), and assembles evolving
            &quot;Ideal Text&quot; and coaching notes.
          </p>
          <p className="text-muted-foreground">
            <strong>The output is advisory coaching only.</strong> It is{" "}
            <strong>not</strong> professional, medical, legal, psychological, or
            therapeutic advice, and is <strong>not</strong> a substitute for a
            qualified professional. You are responsible for how you use the
            output. AI-generated transcripts and analysis may contain errors and
            should not be relied upon as definitive.
          </p>
        </section>

        {/* 3 — Content & IP */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            3. Your content and intellectual property
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>You retain 100% ownership</strong> of your original speech,
              your voice recordings, your transcripts, and your final
              &quot;Ideal Text&quot; compositions (&quot;User Content&quot;).
            </li>
            <li>
              You grant WillpowerLab a{" "}
              <strong>
                limited, non-exclusive, worldwide, royalty-free licence to host,
                store, process, transcribe, and transform
              </strong>{" "}
              your User Content{" "}
              <strong>solely to provide and improve the Service to you</strong>{" "}
              (for example, to run analysis, assemble Ideal Text, and enable coach
              review where applicable). This licence ends when your User Content
              is deleted, except for processing already carried out and any copies
              retained to meet legal obligations.
            </li>
            <li>
              We claim no ownership of your User Content and will not use it to
              train public AI foundation models (see the Privacy Policy).
            </li>
            <li>
              <strong>Service IP.</strong> The Service itself, including our
              software, models, interfaces, and branding, remains our exclusive
              property. Nothing in these Terms transfers any of our intellectual
              property to you.
            </li>
          </ul>
        </section>

        {/* 4 — Acceptable use */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Acceptable use</h2>
          <p className="text-muted-foreground">You agree not to:</p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              upload or record{" "}
              <strong>
                unlawful, infringing, defamatory, or hateful content
              </strong>
              , or content that violates the rights of others;
            </li>
            <li>
              upload{" "}
              <strong>
                recordings of third parties without their informed consent
              </strong>
              , or any recording you are not legally entitled to make or process
              (you are solely responsible for obtaining any necessary consents for
              other people&apos;s voices);
            </li>
            <li>
              attempt to{" "}
              <strong>
                reverse-engineer, decompile, scrape, or otherwise extract
              </strong>{" "}
              the AI models, prompts, or underlying systems of the Service;
            </li>
            <li>
              interfere with, overload, or attempt to gain unauthorised access to
              the Service or its infrastructure;
            </li>
            <li>
              use the Service to build a competing product or to develop or train
              a machine-learning model.
            </li>
          </ul>
          <p className="text-muted-foreground">
            We may suspend or terminate access for violations of this section.
          </p>
        </section>

        {/* 5 — Payments */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            5. Payments, unlocks, and cancellation
          </h2>
          <p className="text-muted-foreground">
            The core Service (recording, transcription, your coaching notes, and
            your evolving Ideal Text) is free to use.
          </p>
          <p className="text-muted-foreground">
            Optional deeper coaching (the highlighted &quot;moments&quot; and
            their detailed advice) is a paid unlock. Unlocking is priced{" "}
            <strong>per presentation</strong>, at the price shown at checkout, and
            entitles you to that presentation&apos;s moment-level advice across{" "}
            <strong>all of that presentation&apos;s takes and versions</strong>.
            Re-recording the same presentation does not require unlocking again; a
            separate presentation is a separate unlock.
          </p>
          <p className="text-muted-foreground">
            Payments are processed by <strong>Stripe</strong>. Unlocks are{" "}
            <strong>
              one-time charges per presentation, not a recurring subscription
            </strong>
            ; we do not auto-renew, and we do not store your card details.
          </p>
          <p className="text-muted-foreground">
            <strong>EU consumer right of withdrawal.</strong> Where you are a
            consumer, you ordinarily have a 14-day right to withdraw from a
            distance contract. Because an unlock is digital content supplied
            immediately,{" "}
            <strong>
              by unlocking you expressly request immediate performance and
              acknowledge that you thereby lose the 14-day right of withdrawal
            </strong>{" "}
            for the content already supplied, to the extent permitted by law.
          </p>
          <p className="text-muted-foreground">
            Because unlocks are delivered instantly, they are final and
            non-refundable once applied, except where a refund is required by
            mandatory consumer law. You may stop buying unlocks or delete your
            account at any time; that prevents future charges but does not refund
            unlocks already applied.
          </p>
        </section>

        {/* 6 — Termination */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Account termination</h2>
          <p className="text-muted-foreground">
            You may delete your account at any time. We may suspend or terminate
            your account if you breach these Terms, if required by law, or if
            necessary to protect the Service or other users. On termination, your
            right to use the Service ends and your User Content is deleted in
            accordance with the Privacy Policy, subject to legal retention
            obligations.
          </p>
        </section>

        {/* 7 — Warranty disclaimer */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Warranty disclaimer</h2>
          <p className="text-muted-foreground">
            To the maximum extent permitted by applicable law, the Service is
            provided{" "}
            <strong>&quot;AS IS&quot; and &quot;AS AVAILABLE&quot;</strong>,
            without warranties of any kind, whether express or implied, including
            as to uninterrupted or error-free operation, 100% uptime, or the
            accuracy or completeness of AI transcriptions and analysis.{" "}
            <strong>
              Nothing in these Terms excludes or limits any rights you have as a
              consumer under mandatory Polish or EU law
            </strong>
            , including statutory conformity guarantees.
          </p>
        </section>

        {/* 8 — Limitation of liability */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Limitation of liability</h2>
          <p className="text-muted-foreground">
            To the maximum extent permitted by applicable law, WillpowerLab (the
            operator) shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or for loss of profits, data, or
            goodwill, arising from your use of the Service. Our total aggregate
            liability arising out of or relating to the Service shall not exceed
            the greater of (a) the amounts you paid to us in the twelve (12)
            months preceding the event giving rise to the claim, or (b) EUR 100.
          </p>
          <p className="text-muted-foreground">
            <strong>
              Nothing in these Terms limits liability that cannot be limited by
              law
            </strong>
            , including liability for death or personal injury caused by
            negligence, for intentional misconduct or gross negligence, or under
            mandatory consumer-protection law.
          </p>
        </section>

        {/* 9 — Governing law */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            9. Governing law and jurisdiction
          </h2>
          <p className="text-muted-foreground">
            These Terms are governed by the laws of <strong>Poland</strong>,
            without regard to conflict-of-laws rules. Disputes shall be subject to
            the jurisdiction of the <strong>Polish courts</strong> competent for
            the operator&apos;s place of residence.{" "}
            <strong>If you are a consumer</strong>, this does not deprive you of
            the protection of mandatory provisions of the law of your country of
            habitual residence, and you may also bring proceedings in the courts
            of that country. Consumers may additionally use the EU Online Dispute
            Resolution platform at{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary no-underline hover:underline"
            >
              ec.europa.eu/consumers/odr
            </a>
            .
          </p>
        </section>

        {/* 10 — Changes */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Changes to these Terms</h2>
          <p className="text-muted-foreground">
            We may amend these Terms. We will post the updated version with a new
            effective date and, for material changes, provide reasonable prior
            notice. Continued use after the effective date constitutes acceptance.
            If you do not agree, you must stop using the Service and may delete
            your account.
          </p>
        </section>

        {/* 11 — Contact */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">11. Contact</h2>
          <p className="text-muted-foreground">
            <a
              href="mailto:artur@willonski.com"
              className="text-primary no-underline hover:underline"
            >
              artur@willonski.com
            </a>
            . WillpowerLab, operated by Artur Willoński, Poland.
          </p>
        </section>
      </article>
    </div>
  );
}

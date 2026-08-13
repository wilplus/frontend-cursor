import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | WillpowerLab",
  description: "The terms that govern your use of WillpowerLab.",
};

/**
 * Terms of Service v1.1 (effective 13 August 2026). Body content is the
 * operator's commissioned draft. The wrapper, typography and back-link match
 * the Privacy page and are stable.
 *
 * v1.1 adds §4 (model improvement), §5 (community sharing / peer review),
 * §6 (human review), §7 (AI transparency), §13 (changes to the Service) and
 * §15 (general). Old §4-§11 shift down accordingly.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FOUNDER RULINGS — 2026-08-13, on the pre-publication audit.
 *
 *  1. Effective date is 13 August 2026, matching the Privacy Policy.
 *  2. The model-improvement opt-out is NOT claimed in this version. The
 *     control does not exist (the consent flags on user_settings are
 *     mic / share / email / terms only — see the backend's
 *     add_consent_preferences_to_user_settings.sql), so §4 says nothing
 *     about opting out and points at the Privacy Policy for rights instead.
 *     Restore the sentence in the next revision, once the control ships.
 *  3. §6's opt-out is real — `share_consent` ("share snippets with the
 *     coach") is live via /v2/user/consent — but it is NOT in "account
 *     settings"; there is no such surface. The clause now says you can
 *     withdraw the consent, without naming a page that does not exist.
 *  4. Published with the §9 rewrite below.
 *
 * ⚠️ STILL CLAIMED BUT NOT YET BUILT — tracked in the backend's
 * docs/BACKLOG.md (Epic L — legal commitments). Published knowingly on the
 * founder's ruling; each needs either the build or a copy amendment:
 *
 *  - §5 sharing "opt-in, per recording, and revocable at any time".
 *    `share_consent` is a single account-level flag scoped to the coach —
 *    not per-recording, and not scoped to other users hearing you.
 *  - §10 "You may export your recordings, transcripts, and Ideal Text."
 *    No user-facing export route exists; the backend's exports are internal
 *    (annotation export, dev-tasks) or belong to the Life panel. Art. 20
 *    requests are served by hand until it ships.
 *  - §10 "You may delete your account at any time." No account-deletion
 *    route was found; per-take and per-session deletes exist.
 *  - §7 "opt-in and off by default" holds only because recording is gated on
 *    mic_consent, which defaults to NULL (never asked). If inference is ever
 *    decoupled from the mic gate, this sentence stops being true.
 *
 * ⚠️ DEVIATION FROM THE APPROVED v1.1 DRAFT — §9, and only §9.
 * The approved draft describes per-presentation, one-time unlocks and states
 * that charges are "not a recurring subscription; we do not auto-renew". That
 * is not what the Service charges for. The live model is recurring monthly
 * plans funding a token wallet:
 *    - services/stripe_subscription_tiers.py — "every tier renews monthly …
 *      all three paid tiers are recurring Stripe Prices";
 *    - services/token_account.py — "SET, never add … rollover ruled out";
 *    - services/token_prices.py — the published token price list;
 *    - this app's /dashboard/pricing renders TokenWalletScreen ("what you
 *      have, when it renews … the plans").
 * The rest of this page is a faithful port. §9 alone was rewritten, because
 * publishing a false statement about what we already charge is a different
 * class of problem from publishing a promise we have not built yet. It is
 * structural only — no prices, no tier names. Signed off 2026-08-13; a
 * consumer-law review is still outstanding.
 *
 * OPEN CHECKLIST (carried forward from v1.0, renumbered):
 *  - §1/§17: the operator's exact legal name / diacritics.
 *  - §9: confirm the express-consent (immediate-performance) checkbox is
 *    actually implemented at checkout so the withdrawal wording is truthful.
 *    NOT FOUND in the token-wallet components as of this revision. Note that
 *    a recurring subscription changes the withdrawal analysis — re-check with
 *    counsel rather than porting the old reasoning.
 *  - §12: liability-cap floor set to EUR 100.
 *  - §14: v1.0 linked the EU ODR platform; v1.1 drops it. The platform was
 *    wound down under Regulation (EU) 2024/3228 — confirm current status and
 *    whether replacement consumer-ADR information is required.
 *  - Article 9 voice-data characterisation: confirm with admitted Polish counsel.
 *  - Confirm the 30-day voice-data deletion window is enforced by the backend.
 *    NO retention or purge job was found — the Railway crons are annotation
 *    export, dev-bugs, drift, life-reminders, migrate, web and worker.
 *  - §17: both documents now use contact@willpowerlab.com. Confirm the mailbox
 *    is monitored — the supervisory authority will use it.
 *  - §16 requires prior notice for material changes. If any user accepted
 *    v1.0, they need notice of this revision.
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
            Effective date: 13 August 2026. Version 1.1. Last updated: 13
            August 2026.
          </p>
        </header>

        {/* Change summary — founder to confirm whether this stays user-facing */}
        <section className="space-y-2">
          <div className="rounded-md border border-border bg-muted/40 p-4 text-muted-foreground">
            <p>
              <strong>What changed in version 1.1.</strong> New sections on
              community sharing and peer review (§5), human coach review (§6),
              AI transparency and automated decision-making (§7), changes to
              the Service (§13), and general contract terms (§15). We corrected
              the statement about how your content is used to improve our
              models (§4), clarified the restriction on building competing
              products (§8), and updated our contact address.
            </p>
          </div>
        </section>

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
              <strong>solely to provide and improve the Service</strong> (for
              example, to run analysis, assemble Ideal Text, and enable coach
              review). This licence ends when your User Content is deleted,
              except for processing already carried out and any copies retained
              to meet legal obligations.
            </li>
            <li>We claim no ownership of your User Content.</li>
            <li>
              <strong>Service IP.</strong> The Service itself, including our
              software, models, interfaces, and branding, remains our exclusive
              property. Nothing in these Terms transfers any of our intellectual
              property to you.
            </li>
          </ul>
        </section>

        {/* 4 — Model improvement */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            4. How your content improves the Service
          </h2>
          <p className="text-muted-foreground">
            <strong>We do use your content to improve our own models.</strong>{" "}
            Specifically, recordings, transcripts, derived measurements, ratings,
            and coach corrections may be used to train and calibrate the analysis
            and feedback systems that power WillpowerLab.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>We do not</strong> sell your content, or provide it to
              third parties to train their own general-purpose or foundation
              models.
            </li>
            <li>
              <strong>We do not</strong> publish your recordings or transcripts.
            </li>
            <li>
              Aggregate, de-identified measurements may be used for research and
              for reporting about the Service in general terms.
            </li>
            <li>
              <strong>Deleting your account removes your content.</strong> Where
              a measurement or label derived from your content has already been
              incorporated into an aggregate model, that model is not retrained
              solely on that basis. We explain this at the point of consent so
              that it is not a surprise.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Your rights over this processing — including your right to object to
            it — are set out in the{" "}
            <Link
              href="/privacy"
              className="text-primary no-underline hover:underline"
            >
              Privacy Policy
            </Link>
            . Exercising them does not affect your ability to use the Service.
          </p>
        </section>

        {/* 5 — Community sharing & peer review */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            5. Community sharing and peer review
          </h2>
          <p className="text-muted-foreground">
            Parts of the Service involve listening to and rating short speech
            extracts.
          </p>
          <p className="text-muted-foreground">
            <strong>Rating other people&apos;s extracts.</strong> You may be
            shown short extracts from other users who have chosen to share, or
            from publicly available material we have licensed or are permitted to
            use. You are asked to give a simple perceptual judgement (for
            example, whether a speaker sounded confident). Your ratings are used
            to improve the Service and to calibrate its analysis.
          </p>
          <p className="text-muted-foreground">
            <strong>Sharing your own extracts.</strong> Sharing is{" "}
            <strong>opt-in, per recording, and revocable at any time.</strong> If
            you do not opt in, no other user will ever hear your voice. If you
            withdraw sharing, the extract is removed from circulation; ratings
            already given remain in aggregate form.
          </p>
          <p className="text-muted-foreground">
            <strong>When you rate, you agree to:</strong>
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              treat what you hear as <strong>confidential</strong> — do not
              record, screenshot, transcribe, redistribute, or attempt to
              identify the speaker;
            </li>
            <li>rate honestly and in good faith;</li>
            <li>
              not use the feature to harass, mock, or disparage any person.
            </li>
          </ul>
          <p className="text-muted-foreground">
            <strong>When you share, you acknowledge:</strong>
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>other users will hear your voice;</li>
            <li>
              extracts are presented without your name, but{" "}
              <strong>
                voice is inherently identifiable to anyone who knows you
              </strong>
              ;
            </li>
            <li>
              you have the right to share everything in the extract, including
              any third-party voices or confidential material.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Breach of this section may result in immediate suspension.
          </p>
        </section>

        {/* 6 — Human review */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Human review</h2>
          <p className="text-muted-foreground">
            A <strong>human coach may listen to your recordings and read your
            transcripts</strong> in order to review, correct, or improve the
            feedback the Service gives you. Coaches are bound by confidentiality
            obligations.
          </p>
          <p className="text-muted-foreground">
            Human review happens only with your consent, and you can withdraw
            that consent at any time. Feedback quality may be lower as a result.
          </p>
        </section>

        {/* 7 — AI transparency */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            7. AI transparency and automated decisions
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>You are interacting with an AI system.</strong>{" "}
              Transcripts, measurements, and coaching comments are generated
              automatically and may be inaccurate.
            </li>
            <li>
              <strong>Comments are AI-generated</strong> unless explicitly marked
              as reviewed by a human.
            </li>
            <li>
              <strong>
                No decision with legal or similarly significant effects is made
                about you
              </strong>{" "}
              by automated means. The Service produces advisory coaching only. It
              does not assess your employability, competence, credit, health, or
              any comparable matter, and must not be used for those purposes.
            </li>
            <li>
              Where a human coach has reviewed a piece of feedback, it is marked
              as such.
            </li>
            <li>
              The Service infers characteristics of speech delivery from your
              voice. <strong>This inference is opt-in and off by default.</strong>{" "}
              See the{" "}
              <Link
                href="/privacy"
                className="text-primary no-underline hover:underline"
              >
                Privacy Policy
              </Link>{" "}
              for what is inferred and on what legal basis.
            </li>
            <li>
              The Service{" "}
              <strong>
                must not be used by employers or educational institutions to
                assess, monitor, rank, or make decisions about employees,
                candidates, or students.
              </strong>{" "}
              Accounts used this way will be terminated.
            </li>
          </ul>
        </section>

        {/* 8 — Acceptable use */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Acceptable use</h2>
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
              attempt to <strong>manipulate the Service&apos;s analysis,
              ratings, or feedback</strong> through automated input, coordinated
              rating, or deliberately misleading content;
            </li>
            <li>
              interfere with, overload, or attempt to gain unauthorised access to
              the Service or its infrastructure;
            </li>
            <li>
              <strong>extract data from the Service</strong> — including other
              users&apos; content, our outputs, or our measurements —{" "}
              <strong>
                to build a competing product or to develop or train a
                machine-learning model.
              </strong>{" "}
              This does not restrict what you do with your own User Content,
              which remains yours.
            </li>
          </ul>
          <p className="text-muted-foreground">
            We may suspend or terminate access for violations of this section.
          </p>
        </section>

        {/* 9 — Payments — ⚠️ REWRITTEN, see the deviation note in the docblock */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            9. Payments, plans, and cancellation
          </h2>
          <p className="text-muted-foreground">
            The Service runs on a <strong>token allowance</strong>. Recording,
            transcription, your coaching notes, and your evolving Ideal Text are
            available on a free allowance; actions that cost us to run — such as
            generating analysis or delivering coach feedback — draw tokens from
            your balance at the published rate shown before you commit to the
            action.
          </p>
          <p className="text-muted-foreground">
            <strong>Paid plans are recurring monthly subscriptions.</strong> Each
            paid plan grants a token allowance at the start of every billing
            period, at the price shown at checkout. Plans{" "}
            <strong>renew automatically</strong> until you cancel.
          </p>
          <p className="text-muted-foreground">
            <strong>Allowances do not roll over.</strong> Your allowance is reset
            to the plan amount at the start of each billing period; any unused
            balance from the previous period is not carried forward.
          </p>
          <p className="text-muted-foreground">
            Payments are processed by <strong>Stripe</strong>. We do not store
            your card details. You may cancel at any time from your account or
            through the payment portal; cancellation takes effect at the end of
            the period you have already paid for, and we do not claw back the
            allowance for that period.
          </p>
          <p className="text-muted-foreground">
            <strong>EU consumer right of withdrawal.</strong> Where you are a
            consumer, you ordinarily have a 14-day right to withdraw from a
            distance contract. Because the Service supplies digital content
            immediately,{" "}
            <strong>
              by starting a paid period you expressly request immediate
              performance and acknowledge that you thereby lose the 14-day right
              of withdrawal
            </strong>{" "}
            for the content already supplied, to the extent permitted by law.
            Tokens already spent are not refundable, except where a refund is
            required by mandatory consumer law.
          </p>
        </section>

        {/* 10 — Termination */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Account termination</h2>
          <p className="text-muted-foreground">
            You may delete your account at any time. We may suspend or terminate
            your account if you breach these Terms, if required by law, or if
            necessary to protect the Service or other users.
          </p>
          <p className="text-muted-foreground">
            On termination, your right to use the Service ends and your User
            Content is deleted in accordance with the Privacy Policy, subject to
            legal retention obligations.{" "}
            <strong>
              You may export your recordings, transcripts, and Ideal Text before
              deleting your account.
            </strong>
          </p>
        </section>

        {/* 11 — Warranty disclaimer */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">11. Warranty disclaimer</h2>
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

        {/* 12 — Limitation of liability */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">12. Limitation of liability</h2>
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

        {/* 13 — Changes to the Service */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">13. Changes to the Service</h2>
          <p className="text-muted-foreground">
            We may add, change, or remove features. Some features are
            experimental and may be tested with a subset of users, changed, or
            withdrawn.
          </p>
          <p className="text-muted-foreground">
            If we discontinue the Service entirely, we will give at least{" "}
            <strong>30 days&apos; notice</strong> where reasonably possible and
            provide a means to export your content. Any paid period you have
            already been charged for and cannot use will be refunded on a pro
            rata basis.
          </p>
        </section>

        {/* 14 — Governing law */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            14. Governing law and jurisdiction
          </h2>
          <p className="text-muted-foreground">
            These Terms are governed by the laws of <strong>Poland</strong>,
            without regard to conflict-of-laws rules. Disputes shall be subject to
            the jurisdiction of the <strong>Polish courts</strong> competent for
            the operator&apos;s place of residence.{" "}
            <strong>If you are a consumer</strong>, this does not deprive you of
            the protection of mandatory provisions of the law of your country of
            habitual residence, and you may also bring proceedings in the courts
            of that country.
          </p>
        </section>

        {/* 15 — General */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">15. General</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>Assignment.</strong> We may transfer these Terms and our
              rights under them to a successor in connection with a merger,
              acquisition, or sale of assets, on notice to you. You may not
              transfer your account without our consent.
            </li>
            <li>
              <strong>Severability.</strong> If any provision is found
              unenforceable, the remainder stays in force.
            </li>
            <li>
              <strong>Entire agreement.</strong> These Terms and the{" "}
              <Link
                href="/privacy"
                className="text-primary no-underline hover:underline"
              >
                Privacy Policy
              </Link>{" "}
              are the entire agreement between us regarding the Service.
            </li>
            <li>
              <strong>No waiver.</strong> Failure to enforce a provision is not a
              waiver of it.
            </li>
          </ul>
        </section>

        {/* 16 — Changes to these Terms */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">16. Changes to these Terms</h2>
          <p className="text-muted-foreground">
            We may amend these Terms. We will post the updated version with a new
            effective date and, for material changes, provide reasonable prior
            notice. Continued use after the effective date constitutes acceptance.
            If you do not agree, you must stop using the Service and may delete
            your account.
          </p>
        </section>

        {/* 17 — Contact */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">17. Contact</h2>
          <p className="text-muted-foreground">
            <a
              href="mailto:contact@willpowerlab.com"
              className="text-primary no-underline hover:underline"
            >
              contact@willpowerlab.com
            </a>
            . WillpowerLab, operated by Artur Willoński, Poland.
          </p>
        </section>
      </article>
    </div>
  );
}

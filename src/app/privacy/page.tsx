import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | WillpowerLab",
  description:
    "How WillpowerLab collects, uses, discloses, and protects your personal data under the GDPR.",
};

/**
 * Privacy Policy v1.1 (effective 13 August 2026). Body content is the
 * operator's commissioned draft. The wrapper, typography and back-link match
 * the Terms page and are stable.
 *
 * v1.1 aligns this Policy with Terms of Service v1.1. New sections: §5 (model
 * improvement — the correction), §6 (what we infer from your voice — the target
 * of the cross-reference in Terms §7), §7 (community sharing and peer review),
 * §8 (human coach review). Old §5-§11 shift down accordingly, and the §3
 * cross-reference to the rights section now points at §11.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FOUNDER RULINGS — 2026-08-13, on the pre-publication audit.
 *
 *  1. Effective date is 13 August 2026, matching the Terms.
 *  2. The model-improvement opt-out is NOT claimed in this version. The
 *     control does not exist (the consent flags on user_settings are
 *     mic / share / email / terms only — backend:
 *     add_consent_preferences_to_user_settings.sql), so §5 no longer offers
 *     one. The Art. 21 RIGHT TO OBJECT stays in §5 and §11: it is statutory,
 *     it does not depend on a toggle, and it is served at the contact address.
 *     Restore the settings opt-out in the next revision, once it ships.
 *  3. §8's coach opt-out is real — `share_consent` is live via
 *     /v2/user/consent — but it is not in "account settings"; there is no
 *     such surface. The clause says you can withdraw consent, not where.
 *
 * ⚠️ STILL CLAIMED BUT NOT YET BUILT — tracked in the backend's
 * docs/BACKLOG.md (Epic L — legal commitments). Published knowingly on the
 * founder's ruling; each needs either the build or a copy amendment:
 *
 *  - §7 sharing "opt-in, per recording, and revocable". `share_consent` is
 *    one account-level flag scoped to the coach — not per-recording, and not
 *    scoped to other users hearing you.
 *  - §11 portability / Terms §10 export. No user-facing export route exists;
 *    the backend's exports are internal (annotation export, dev-tasks) or
 *    belong to the Life panel. Art. 20 requests are served by hand until it
 *    ships — which is lawful, but slow, and the one-month clock still runs.
 *  - Art. 17 erasure: no account-deletion route was found. Per-take and
 *    per-session deletes exist; whole-account erasure is manual.
 *  - §6 "opt-in and off by default" holds only because recording is gated on
 *    mic_consent, which defaults to NULL (never asked). If inference is ever
 *    decoupled from the mic gate, this sentence stops being true.
 *  - §10 retention. v1.0 promised audio was "automatically deleted no later
 *    than 30 days"; NO retention or purge job exists (the Railway crons are
 *    annotation-export, dev-bugs, drift, life-reminders, migrate, web,
 *    worker). This revision states retention CRITERIA instead, which
 *    Art. 13(2)(a) permits — but the founder intent in v1.0 was a hard
 *    maximum, and it should not be quietly dropped. Set it, then enforce it.
 *
 * OPEN CHECKLIST (carried forward from v1.0, renumbered):
 *  - Confirm the operator's exact legal name / diacritics for the controller
 *    block.
 *  - Article 9 (voice as special-category data): confirm characterisation with
 *    admitted Polish counsel before go-live. §6 now discloses inference of
 *    delivery characteristics, which is the fact the assessment turns on.
 *  - §5: the training use is now stated affirmatively, per Terms v1.1 §4.
 *    The lawful basis is the open question — model improvement sits on
 *    Art. 6(1)(f) here (hence the Art. 21 objection right), while inference
 *    sits on Art. 6(1)(a). Counsel must confirm the split is defensible.
 *  - §9 sub-processors: Sentry, Resend, Cloudflare R2 and Vercel are ADDED in
 *    this revision. The first three on code evidence; Vercel on deployment
 *    evidence (it runs the checks on this repo's PRs — nothing in the tree
 *    names it, which is exactly why the repo alone is not a sufficient source
 *    for this table). Confirm a DPA and transfer safeguard for each, and
 *    audit for any other provider that is configured outside the code.
 *  - Contact: switched to contact@willpowerlab.com to match Terms v1.1.
 *    Confirm the mailbox is monitored — a data subject and the supervisory
 *    authority will both use it, and Art. 12(3) runs a one-month clock.
 *  - Update the controller details once the activity is registered
 *    (JDG / sp. z o.o.).
 *
 * NOTE ON THE CONSTRUCT FENCE. §6 discloses internal measurement, which a
 * privacy policy must do. It deliberately does NOT present any of it as a
 * user-facing score, ratio, or verdict. The description is qualitative and
 * limited to the measurements the current product actually uses.
 */
export default function PrivacyPage() {
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
            Effective date: 13 August 2026. Version 1.1. Last updated: 13
            August 2026.
          </p>
        </header>

        {/* Change summary — keep consistent with the Terms page */}
        <section className="space-y-2">
          <div className="rounded-md border border-border bg-muted/40 p-4 text-muted-foreground">
            <p>
              <strong>What changed in version 1.1.</strong> We corrected what we
              say about using your content to improve our models (§5) — the
              previous version was true but incomplete. New sections explain
              what we infer from your voice (§6), community sharing and peer
              review (§7), and human coach review (§8). We added sub-processors
              that were missing from the list (§9), restated data retention
              (§10), and added the right to object (§11).
            </p>
          </div>
        </section>

        {/* 1 — Controller */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            1. Who we are (Data Controller)
          </h2>
          <p className="text-muted-foreground">
            This Privacy Policy explains how <strong>WillpowerLab</strong> (
            &quot;WillpowerLab&quot;, &quot;we&quot;, &quot;us&quot;,
            &quot;our&quot;) collects, uses, discloses, and protects your
            personal data when you use our speech-coaching and
            presentation-practice application and related services (the
            &quot;Service&quot;).
          </p>
          <p className="text-muted-foreground">
            WillpowerLab is a service operated by an individual (a natural
            person) based in Poland, currently conducting{" "}
            <strong>unregistered business activity</strong> (
            <em>działalność nieewidencjonowana</em>) below the revenue threshold
            that requires business registration under Polish law. For the
            purposes of the EU General Data Protection Regulation (Regulation
            (EU) 2016/679, &quot;GDPR&quot;) and the Polish Act of 10 May 2018 on
            the Protection of Personal Data, the Data Controller is:
          </p>
          <div className="rounded-md border border-border bg-muted/40 p-4 text-muted-foreground">
            <p>
              <strong>Artur Willoński</strong>, operating under the name
              &quot;WillpowerLab&quot;
            </p>
            <p>Poland, European Union</p>
            <p>
              Contact:{" "}
              <a
                href="mailto:contact@willpowerlab.com"
                className="text-primary no-underline hover:underline"
              >
                contact@willpowerlab.com
              </a>{" "}
              (a postal contact address is available on request to data subjects
              and to the supervisory authority)
            </p>
          </div>
          <p className="text-muted-foreground">
            Given the small scale of processing, we are{" "}
            <strong>
              not required to, and have not, appointed a Data Protection Officer
            </strong>{" "}
            (GDPR Art. 37). The operator handles all privacy requests directly at
            the email above.
          </p>
        </section>

        {/* 2 — Categories */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            2. Categories of personal data we collect
          </h2>
          <p className="text-muted-foreground">
            We collect and process the following categories of personal data:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>Account Data:</strong> your email address, name (or
              display name), password (stored in hashed form), and technical
              identifiers including your IP address, device/browser information,
              and authentication metadata.
            </li>
            <li>
              <strong>Voice Data:</strong> audio recordings of your voice that
              you create when you record a &quot;take&quot; or re-read within the
              Service.
            </li>
            <li>
              <strong>Text Data:</strong> transcripts automatically generated
              from your Voice Data, AI-generated coaching notes and analytics
              (e.g., filler-word and structure analysis), and the evolving
              &quot;Ideal Text&quot; versions assembled for you.
            </li>
            <li>
              <strong>Derived Measurements:</strong> internal measurements
              computed from your Voice Data and transcripts, described in §6.
            </li>
            <li>
              <strong>Ratings and Labels:</strong> where you rate an extract as
              part of peer review (§7), the judgements you give; and where a
              coach reviews your content (§8), the corrections and labels they
              record.
            </li>
            <li>
              <strong>Usage Data:</strong> logs of how you interact with the
              Service (features used, sessions, timestamps, error and diagnostic
              data) used to operate, secure, and improve the Service.
            </li>
            <li>
              <strong>Payment Data:</strong> where you make a purchase,
              transactions are processed{" "}
              <strong>
                entirely by our third-party payment processor (Stripe)
              </strong>
              . We do <strong>not</strong> store or have access to your full
              payment-card number. We receive limited billing metadata (e.g.,
              transaction status, the last four digits of the card, billing
              country, and your subscription status) necessary to manage your
              account and comply with applicable obligations.
            </li>
          </ul>
        </section>

        {/* 3 — Lawful bases */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            3. Lawful bases for processing (GDPR Articles 6 and 9)
          </h2>
          <p className="text-muted-foreground">
            We rely on the following lawful bases:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>Performance of a contract (Article 6(1)(b)).</strong> We
              process your Voice Data, Text Data, and Account Data to deliver the
              core Service you have requested: recording and transcribing your
              takes, running AI speech analysis, and assembling and presenting
              your coaching notes and Ideal Text.
            </li>
            <li>
              <strong>Consent (Article 6(1)(a)).</strong> We record your voice
              and generate speech analytics{" "}
              <strong>
                only after you have given clear, affirmative consent
              </strong>
              . Consent is also the basis for the inference described in §6, for
              sharing your extracts with other users (§7), and for human coach
              review (§8). You may withdraw any consent at any time (see §11);
              withdrawal does not affect processing carried out before
              withdrawal.
            </li>
            <li>
              <strong>Legitimate interests (Article 6(1)(f)).</strong> We process
              Usage Data to secure the Service, prevent abuse, and improve
              reliability, and we process your content to improve our own models
              as described in §5, where such interests are not overridden by your
              rights and freedoms. You have the right to object to this
              processing (see §11).
            </li>
            <li>
              <strong>Legal obligation (Article 6(1)(c)).</strong> We process
              limited billing data to meet applicable Polish accounting and tax
              obligations.
            </li>
          </ul>
          <p className="text-muted-foreground">
            <strong>
              Special categories of data (Article 9): important characterisation.
            </strong>{" "}
            WillpowerLab processes your voice{" "}
            <strong>
              to analyse speech delivery (pace, fillers, structure, clarity), not
              to uniquely identify you.
            </strong>{" "}
            We do <strong>not</strong> create voiceprints or perform biometric
            identification. On that basis, your Voice Data is processed as
            ordinary personal data and the special-category regime of Article 9
            is, in our assessment,{" "}
            <strong>not triggered by the processing itself</strong>. However,
            because voice can be sensitive and because the measurements described
            in §6 could touch on inferences a user might regard as sensitive (for
            example, indicators of stress or emotional state), we adopt a
            cautious posture:{" "}
            <strong>
              to the extent any special-category data within the meaning of
              Article 9(1) is processed, we do so only on the basis of your
              explicit consent under Article 9(2)(a).
            </strong>
          </p>
        </section>

        {/* 4 — Purposes */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. How we use your data (purposes)</h2>
          <p className="text-muted-foreground">
            We use your data to: create and manage your account; record,
            transcribe, and analyse your takes; generate coaching notes and
            assemble Ideal Text; enable peer review and coach review where you
            have opted in; improve our models as described in §5; process
            payments and manage your plan; provide support; secure and improve
            the Service; and comply with legal obligations.
          </p>
        </section>

        {/* 5 — Model improvement */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            5. How your content improves our models
          </h2>
          <p className="text-muted-foreground">
            <strong>We do use your content to improve our own models.</strong>{" "}
            Recordings, transcripts, derived measurements, ratings, and coach
            corrections may be used to train and calibrate the analysis and
            feedback systems that power WillpowerLab. An earlier version of this
            Policy said only that we do not train public AI foundation models.
            That was true, but incomplete. This section states the position
            accurately.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>We do not</strong> sell your personal data.
            </li>
            <li>
              <strong>We do not</strong> provide your content to third parties to
              train their own general-purpose or foundation models. Your Voice
              Data and transcripts are sent to OpenAI&apos;s developer API for
              analysis under a commercial API agreement providing for{" "}
              <strong>zero data retention</strong>, under which{" "}
              <strong>
                API inputs and outputs are not used to train OpenAI&apos;s
                foundation models.
              </strong>
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
              solely on that basis. We state this plainly so that it is not a
              surprise.
            </li>
          </ul>
          <p className="text-muted-foreground">
            <strong>
              You may object to this processing at any time (Art. 21).
            </strong>{" "}
            Write to us at the address in §15 and we will stop using your
            content to improve our models. Objecting does not affect your
            ability to use the Service. See §11 for this and your other rights.
          </p>
        </section>

        {/* 6 — What we infer */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            6. What we infer from your voice
          </h2>
          <p className="text-muted-foreground">
            The Service infers characteristics of <strong>speech delivery</strong>{" "}
            from your recordings. This inference is{" "}
            <strong>opt-in and off by default.</strong> What we measure:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>Acoustic measurements</strong> — variation in pitch, the
              regularity of your pauses, loudness dynamics, and how much of a
              take is voiced speech rather than silence.
            </li>
            <li>
              <strong>Verbal measurements</strong> — speech rate, filler words,
              and the structure of what you said.
            </li>
            <li>
              <strong>Derived delivery signals</strong> — qualitative readings
              built from the above, used to compare your takes against{" "}
              <strong>your own earlier recordings</strong> and to select which
              version of each part of your speech to assemble into your Ideal
              Text.
            </li>
          </ul>
          <p className="text-muted-foreground">
            <strong>
              These measurements are internal. They are not shown to you as
              scores, ratings, percentages, or verdicts, and they are not used to
              rank you against other users.
            </strong>{" "}
            What you see is a qualitative read: which version of a passage worked
            best, and coaching notes about it.
          </p>
          <p className="text-muted-foreground">
            We do <strong>not</strong> infer, and do not attempt to infer, your
            health, personality, ethnicity, or any comparable characteristic
            about you as a person. The measurements describe a recording, not a
            person, and are used for coaching only. See Terms of Service §7 for
            the prohibition on using the Service to assess employees, candidates,
            or students.
          </p>
        </section>

        {/* 7 — Community sharing & peer review */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            7. Community sharing and peer review
          </h2>
          <p className="text-muted-foreground">
            Parts of the Service involve listening to and rating short speech
            extracts. This is the one place where your personal data may be{" "}
            <strong>disclosed to other users of the Service</strong>.
          </p>
          <p className="text-muted-foreground">
            <strong>If you share.</strong> Sharing is{" "}
            <strong>opt-in, per recording, and revocable at any time.</strong> If
            you do not opt in, no other user will ever hear your voice. Extracts
            are presented to raters without your name — but{" "}
            <strong>
              a voice is inherently identifiable to anyone who knows you
            </strong>
            , and you should treat sharing as a meaningful disclosure. If you
            withdraw, the extract is removed from circulation; ratings already
            given remain in aggregate form, because they cannot be
            disentangled from the calibration they have already contributed to.
          </p>
          <p className="text-muted-foreground">
            <strong>If you rate.</strong> The perceptual judgements you give
            about other people&apos;s extracts are personal data about you as
            well. We retain them, linked to your account, and use them to
            calibrate the Service&apos;s analysis and to assess rater
            reliability. Raters are bound by the confidentiality obligations in
            Terms of Service §5.
          </p>
        </section>

        {/* 8 — Human coach review */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Human coach review</h2>
          <p className="text-muted-foreground">
            A <strong>human coach may listen to your recordings and read your
            transcripts</strong> in order to review, correct, or improve the
            feedback the Service gives you. Their corrections and labels are
            retained and used to calibrate our models, as described in §5.
          </p>
          <p className="text-muted-foreground">
            Coaches are bound by confidentiality obligations, and where a coach
            is not the operator they act under a written data-processing
            agreement. Human review happens only with your consent, and you can
            withdraw that consent at any time (see §11); feedback quality may be
            lower as a result.
          </p>
        </section>

        {/* 9 — Sub-processors */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            9. Sub-processors and international transfers
          </h2>
          <p className="text-muted-foreground">
            We use carefully selected third-party service providers
            (&quot;sub-processors&quot;) who process personal data on our behalf
            under written <strong>Data Processing Agreements (DPAs)</strong>.
            Where a sub-processor transfers data outside the European Economic
            Area (EEA), the transfer is governed by appropriate safeguards,
            primarily the European Commission&apos;s{" "}
            <strong>Standard Contractual Clauses (SCCs)</strong> and, where
            relevant, supplementary measures.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-foreground">
                  <th className="py-2 pr-4 font-semibold">Sub-processor</th>
                  <th className="py-2 pr-4 font-semibold">Purpose</th>
                  <th className="py-2 font-semibold">
                    Location / Transfer safeguard
                  </th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50 align-top">
                  <td className="py-2 pr-4">
                    <strong>Supabase</strong>
                  </td>
                  <td className="py-2 pr-4">
                    Database, authentication, and file storage
                  </td>
                  <td className="py-2">EU region hosting; DPA in place</td>
                </tr>
                <tr className="border-b border-border/50 align-top">
                  <td className="py-2 pr-4">
                    <strong>Railway</strong>
                  </td>
                  <td className="py-2 pr-4">Application backend hosting</td>
                  <td className="py-2">
                    DPA in place; SCCs where data is processed outside the EEA
                  </td>
                </tr>
                <tr className="border-b border-border/50 align-top">
                  <td className="py-2 pr-4">
                    <strong>Vercel</strong>
                  </td>
                  <td className="py-2 pr-4">
                    Web application hosting and delivery
                  </td>
                  <td className="py-2">DPA and SCCs</td>
                </tr>
                <tr className="border-b border-border/50 align-top">
                  <td className="py-2 pr-4">
                    <strong>Cloudflare</strong> (R2)
                  </td>
                  <td className="py-2 pr-4">
                    Object storage for uploaded audio and video
                  </td>
                  <td className="py-2">DPA and SCCs</td>
                </tr>
                <tr className="border-b border-border/50 align-top">
                  <td className="py-2 pr-4">
                    <strong>OpenAI</strong> (developer API)
                  </td>
                  <td className="py-2 pr-4">
                    AI speech analysis and transcription (zero data retention; no
                    foundation-model training)
                  </td>
                  <td className="py-2">
                    United States; DPA and SCCs; zero-retention API terms
                  </td>
                </tr>
                <tr className="border-b border-border/50 align-top">
                  <td className="py-2 pr-4">
                    <strong>Stripe</strong>
                  </td>
                  <td className="py-2 pr-4">
                    Payment processing (PCI-DSS compliant)
                  </td>
                  <td className="py-2">
                    DPA and SCCs; processes card data as an independent
                    controller/processor as applicable
                  </td>
                </tr>
                <tr className="border-b border-border/50 align-top">
                  <td className="py-2 pr-4">
                    <strong>Sentry</strong>
                  </td>
                  <td className="py-2 pr-4">
                    Error monitoring and diagnostics
                  </td>
                  <td className="py-2">DPA and SCCs</td>
                </tr>
                <tr className="align-top">
                  <td className="py-2 pr-4">
                    <strong>Resend</strong>
                  </td>
                  <td className="py-2 pr-4">Transactional and service email</td>
                  <td className="py-2">DPA and SCCs</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground">
            We keep an up-to-date list of sub-processors and will update this
            Policy when it changes materially.
          </p>
        </section>

        {/* 10 — Retention */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Data retention</h2>
          <p className="text-muted-foreground">
            We retain personal data only for as long as necessary for the
            purposes described above. Because some of those purposes outlast a
            single session, the criteria differ by category:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>Voice Data (audio files):</strong> retained for as long as
              needed to transcribe and analyse the take, to let you play it back,
              and — where you have not opted out — for the model improvement
              described in §5. Deleted on your request, and when you delete the
              take or your account.
            </li>
            <li>
              <strong>Shared extracts:</strong> retained while sharing is active,
              and removed from circulation when you withdraw sharing.
            </li>
            <li>
              <strong>Text Data (transcripts, coaching notes, Ideal Text):</strong>{" "}
              retained for as long as your account remains active, so that your
              coaching history and Ideal Text remain available to you. Deleted
              upon account deletion or valid erasure request, subject to any
              overriding legal retention obligation.
            </li>
            <li>
              <strong>Derived measurements, ratings, and labels:</strong>{" "}
              retained while your account is active. Once incorporated into an
              aggregate model, the model itself is not retrained solely because
              one contribution was later deleted (§5).
            </li>
            <li>
              <strong>Account Data:</strong> retained for the life of your
              account and deleted (or anonymised) following account closure,
              subject to legal retention periods.
            </li>
            <li>
              <strong>Payment/billing records:</strong> retained for the period
              required by applicable Polish accounting and tax law.
            </li>
          </ul>
        </section>

        {/* 11 — Rights */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">11. Your rights under the GDPR</h2>
          <p className="text-muted-foreground">
            Subject to the conditions in the GDPR, you have the right to:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>Access:</strong> obtain confirmation of whether we process
              your data and a copy of it (Art. 15).
            </li>
            <li>
              <strong>Rectification:</strong> correct inaccurate or incomplete
              data (Art. 16).
            </li>
            <li>
              <strong>Erasure (&quot;right to be forgotten&quot;):</strong>{" "}
              request deletion of your data (Art. 17).
            </li>
            <li>
              <strong>Restriction:</strong> request that we limit processing in
              certain circumstances (Art. 18).
            </li>
            <li>
              <strong>Data portability:</strong> receive your data in a
              structured, commonly used, machine-readable format and transmit it
              to another controller (Art. 20).
            </li>
            <li>
              <strong>Object:</strong> object at any time to processing based on
              our legitimate interests, including the use of your content to
              improve our models described in §5 (Art. 21).
            </li>
            <li>
              <strong>Withdraw consent:</strong> withdraw any consent at any
              time, without affecting the lawfulness of prior processing (Art.
              7(3)). This includes consent to voice inference (§6), to sharing
              your extracts (§7), and to human coach review (§8).
            </li>
            <li>
              <strong>
                Not be subject to solely automated decisions
              </strong>{" "}
              producing legal or similarly significant effects (Art. 22). Our AI
              analysis is advisory coaching and does not produce such effects; a
              human remains responsible for any consequential decisions.
            </li>
          </ul>
          <p className="text-muted-foreground">
            To exercise any right, contact us at{" "}
            <a
              href="mailto:contact@willpowerlab.com"
              className="text-primary no-underline hover:underline"
            >
              contact@willpowerlab.com
            </a>
            . We respond within one month, as required by the GDPR.
          </p>
          <p className="text-muted-foreground">
            <strong>Right to lodge a complaint.</strong> You have the right to
            lodge a complaint with the Polish supervisory authority:
          </p>
          <div className="rounded-md border border-border bg-muted/40 p-4 text-muted-foreground">
            <p>
              <strong>Urząd Ochrony Danych Osobowych (UODO)</strong>
            </p>
            <p>ul. Stawki 2, 00-193 Warszawa, Poland</p>
            <p>
              Website:{" "}
              <a
                href="https://uodo.gov.pl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary no-underline hover:underline"
              >
                uodo.gov.pl
              </a>
            </p>
          </div>
        </section>

        {/* 12 — Security */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">12. Security</h2>
          <p className="text-muted-foreground">
            We implement appropriate technical and organisational measures to
            protect your data, including encryption in transit, row-level access
            controls on our database, hosting within the EU region for our
            primary datastore, and the zero-retention API arrangement described
            above. No system is perfectly secure, but we work to protect your
            data commensurate with its sensitivity.
          </p>
        </section>

        {/* 13 — Children */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">13. Children</h2>
          <p className="text-muted-foreground">
            The Service is not directed to, and may not be used by, persons under
            the age of 18. We do not knowingly process the personal data of
            children. If we learn that we have collected such data, we will delete
            it.
          </p>
        </section>

        {/* 14 — Changes */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">14. Changes to this Policy</h2>
          <p className="text-muted-foreground">
            We may update this Policy from time to time. We will post the updated
            version with a new effective date and, for material changes, provide
            additional notice (e.g., by email or in-app). Continued use of the
            Service after the effective date constitutes acceptance of the updated
            Policy.
          </p>
        </section>

        {/* 15 — Contact */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">15. Contact</h2>
          <p className="text-muted-foreground">
            Questions or requests regarding this Policy or your personal data:{" "}
            <a
              href="mailto:contact@willpowerlab.com"
              className="text-primary no-underline hover:underline"
            >
              contact@willpowerlab.com
            </a>
            . WillpowerLab, operated by Artur Willoński, Poland. See also our{" "}
            <Link
              href="/terms"
              className="text-primary no-underline hover:underline"
            >
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </article>
    </div>
  );
}

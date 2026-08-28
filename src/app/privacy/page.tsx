import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | WillpowerLab",
  description:
    "How WillpowerLab collects, uses, discloses, and protects your personal data under the GDPR.",
};

/**
 * Privacy Policy v1.2 (effective 28 August 2026). This revision records the
 * approved bundled explicit-consent basis for personalized coaching and pooled
 * WillpowerLab model improvement. Article 6(1)(a) is the sole basis for those
 * two purposes; Article 9(2)(a) applies if the processed voice features are
 * special-category data. The consent is required for recording/coaching and is
 * withdrawable from the shipped Data & consent surface.
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
            Effective date: 28 August 2026. Version 1.2. Last updated: 28
            August 2026.
          </p>
        </header>

        {/* Change summary — keep consistent with the Terms page */}
        <section className="space-y-2">
          <div className="rounded-md border border-border bg-muted/40 p-4 text-muted-foreground">
            <p>
              <strong>What changed in version 1.2.</strong> We now use one
              explicit consent for personalized coaching and improvement of
              WillpowerLab&apos;s shared models. Recording and coaching require
              that consent. We also explain how to withdraw it and what happens
              next (§3, §5, §10 and §11).
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
              use this basis for account administration, purchases and other
              non-recording contractual operations. We do not use it as the
              basis for pooled model training.
            </li>
            <li>
              <strong>Explicit consent (Article 6(1)(a)).</strong> We record your
              voice, generate personalized coaching, and use eligible practice
              data to evaluate, train and improve WillpowerLab&apos;s shared models{" "}
              <strong>
                only after you have given clear, affirmative consent
              </strong>
              . These two connected purposes are accepted together and are
              required to use recording and coaching. Consent is also the basis
              for the inference described in §6. You may withdraw at any time
              (see §11); withdrawal ends recording and coaching access and does
              not affect processing lawfully carried out before withdrawal.
            </li>
            <li>
              <strong>Legitimate interests (Article 6(1)(f)).</strong> We process
              Usage Data to secure the Service, prevent abuse, and improve
              reliability where those interests are not overridden by your
              rights and freedoms. We do not use legitimate interests as the
              basis for pooled model training. You may object to legitimate-
              interests processing (see §11).
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
            <strong>You may withdraw this consent at any time (Art. 7(3)).</strong>{" "}
            Use Data &amp; consent in the account menu or contact us. We stop
            including your data in new training and start the applicable
            retention and purge process. Because the bundled consent is required
            for both connected purposes, withdrawal ends access to recording and
            coaching. See §11 for your other rights.
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
              and — while the required consent remains active — for the model
              improvement described in §5. Withdrawal starts the applicable
              retention and purge process; deletion requests remain available.
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
              our legitimate interests, including security and reliability
              processing (Art. 21). Pooled model improvement relies on consent,
              not legitimate interests.
            </li>
            <li>
              <strong>Withdraw consent:</strong> withdraw any consent at any
              time, without affecting the lawfulness of prior processing (Art.
              7(3)). This includes the bundled personalized-coaching and shared-
              model consent (§5–§6), sharing your extracts (§7), and human coach
              review (§8). Withdrawing the bundled consent ends recording and
              coaching access.
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

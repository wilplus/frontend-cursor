import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | WillpowerLab",
  description:
    "How WillpowerLab collects, uses, discloses, and protects your personal data under the GDPR.",
};

/**
 * Privacy Policy v1.0 (effective 23 July 2026). Body content is the operator's
 * commissioned draft. The wrapper, typography and back-link match the Terms
 * page and are stable.
 *
 * PRE-LAUNCH CHECKLIST (see also the Terms page):
 *  - Confirm the operator's exact legal name / diacritics for the controller block.
 *  - Confirm the 30-day voice-data deletion window is actually enforced by the backend.
 *  - Article 9 (voice as special-category data): confirm characterisation with
 *    admitted Polish counsel before go-live.
 *  - If user recordings/annotations are used to train the internal challenge model,
 *    ensure a specific, separate consent covers that (see the consent-copy pack).
 *  - Update the controller details once the activity is registered (JDG / sp. z o.o.).
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
            Effective date: 23 July 2026. Version 1.0. Last updated: 23 July
            2026.
          </p>
        </header>

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
                href="mailto:artur@willonski.com"
                className="text-primary no-underline hover:underline"
              >
                artur@willonski.com
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
              country) necessary to manage your account and comply with
              applicable obligations.
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
              . You may withdraw this consent at any time (see §7); withdrawal
              does not affect processing carried out before withdrawal.
            </li>
            <li>
              <strong>Legitimate interests (Article 6(1)(f)).</strong> We process
              Usage Data to secure the Service, prevent abuse, and improve
              reliability, where such interests are not overridden by your rights
              and freedoms.
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
            because voice can be sensitive and because coaching notes could
            incidentally touch on inferences a user might regard as sensitive
            (for example, indicators of stress or emotional state), we adopt a
            cautious posture:{" "}
            <strong>
              to the extent any special-category data within the meaning of
              Article 9(1) is processed, we do so only on the basis of your
              explicit consent under Article 9(2)(a).
            </strong>
          </p>
          <p className="text-muted-foreground">
            <strong>No AI foundation-model training.</strong> Your Voice Data and
            transcripts are sent to OpenAI&apos;s developer API for analysis
            under a commercial API agreement that provides for{" "}
            <strong>zero data retention</strong> and under which{" "}
            <strong>
              API inputs and outputs are NOT used to train OpenAI&apos;s
              foundation models.
            </strong>{" "}
            We do not use your content to train any public AI model, and we do
            not sell your personal data.
          </p>
          <blockquote className="border-l-2 border-border pl-4 text-muted-foreground">
            <strong>Note on the challenge/threat-detection model.</strong>{" "}
            WillpowerLab is developing an internal model to detect
            &quot;breakthrough / key moments&quot; in speech. Where recordings or
            annotations are used to train <strong>our own internal model</strong>
            , this is done only on the basis described above (contract and/or
            your explicit consent) and never shared for training third-party
            public models.
          </blockquote>
        </section>

        {/* 4 — Purposes */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. How we use your data (purposes)</h2>
          <p className="text-muted-foreground">
            We use your data to: create and manage your account; record,
            transcribe, and analyse your takes; generate coaching notes and
            assemble Ideal Text; enable coach review where applicable; process
            payments; provide support; secure and improve the Service; and comply
            with legal obligations.
          </p>
        </section>

        {/* 5 — Sub-processors */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            5. Sub-processors and international transfers
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
                    <strong>OpenAI</strong> (developer API)
                  </td>
                  <td className="py-2 pr-4">
                    AI speech analysis (zero data retention; no model training)
                  </td>
                  <td className="py-2">
                    United States; DPA and SCCs; zero-retention API terms
                  </td>
                </tr>
                <tr className="align-top">
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
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground">
            We keep an up-to-date list of sub-processors and will update this
            Policy when it changes materially.
          </p>
        </section>

        {/* 6 — Retention */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Data retention</h2>
          <p className="text-muted-foreground">
            We retain personal data only for as long as necessary for the
            purposes described above:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong>Voice Data (audio files):</strong> retained only as long as
              necessary to transcribe and process the take, and in any case{" "}
              <strong>automatically deleted no later than 30 days</strong> after
              creation, or earlier upon your request.
            </li>
            <li>
              <strong>Text Data (transcripts, coaching notes, Ideal Text):</strong>{" "}
              retained for as long as your account remains active, so that your
              coaching history and Ideal Text remain available to you. Deleted
              upon account deletion or valid erasure request, subject to any
              overriding legal retention obligation.
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

        {/* 7 — Rights */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Your rights under the GDPR</h2>
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
              <strong>Object:</strong> object to processing based on legitimate
              interests (Art. 21).
            </li>
            <li>
              <strong>Withdraw consent:</strong> withdraw any consent at any
              time, without affecting the lawfulness of prior processing (Art.
              7(3)).
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
              href="mailto:artur@willonski.com"
              className="text-primary no-underline hover:underline"
            >
              artur@willonski.com
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

        {/* 8 — Security */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Security</h2>
          <p className="text-muted-foreground">
            We implement appropriate technical and organisational measures to
            protect your data, including encryption in transit, access controls,
            hosting within the EU region for our primary datastore, and the
            zero-retention API arrangement described above. No system is
            perfectly secure, but we work to protect your data commensurate with
            its sensitivity.
          </p>
        </section>

        {/* 9 — Children */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Children</h2>
          <p className="text-muted-foreground">
            The Service is not directed to, and may not be used by, persons under
            the age of 18. We do not knowingly process the personal data of
            children. If we learn that we have collected such data, we will delete
            it.
          </p>
        </section>

        {/* 10 — Changes */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Changes to this Policy</h2>
          <p className="text-muted-foreground">
            We may update this Policy from time to time. We will post the updated
            version with a new effective date and, for material changes, provide
            additional notice (e.g., by email or in-app). Continued use of the
            Service after the effective date constitutes acceptance of the updated
            Policy.
          </p>
        </section>

        {/* 11 — Contact */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">11. Contact</h2>
          <p className="text-muted-foreground">
            Questions or requests regarding this Policy or your personal data:{" "}
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

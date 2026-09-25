import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublishedPolicyText } from "@/components/legal/PublishedPolicyText";
import { SectionLoadingState } from "@/components/willab/LoadingState";
import { DATA_CONSENT_COPY } from "@/lib/legal/dataConsentCopy";

export const metadata: Metadata = {
  title: "Privacy Policy | WillpowerLab",
  description:
    "How WillpowerLab collects, uses, discloses, and protects your personal data under the GDPR.",
};

/**
 * The Privacy Policy is the text the policy record stores, and nothing else
 * (PublishedPolicyText). Founder 2026-09-25, F3 = A: this page used to carry
 * the v1.2 text as its stand-in while that record loaded. v1.2 describes the
 * retired bundled training consent, so for a moment every visitor read a
 * policy that is no longer true. It now shows a loading line, and says so
 * plainly if the record cannot be read.
 *
 * Known cost: with no JavaScript (and for crawlers) the page shows only the
 * loading line, because the stored copy is read in the browser.
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

      <PublishedPolicyText
        which="privacy"
        unavailable={
          <p role="alert" className="text-sm text-muted-foreground">
            {DATA_CONSENT_COPY.privacyUnavailable}
          </p>
        }
      >
        <SectionLoadingState />
      </PublishedPolicyText>
    </div>
  );
}

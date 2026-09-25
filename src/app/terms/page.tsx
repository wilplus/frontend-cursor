import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublishedPolicyText } from "@/components/legal/PublishedPolicyText";
import { SectionLoadingState } from "@/components/willab/LoadingState";
import { DATA_CONSENT_PENDING_COPY } from "@/lib/legal/dataConsentCopy";
import { loadPublishedPolicyText } from "@/lib/legal/publishedPolicy.server";

export const metadata: Metadata = {
  title: "Terms of Service | WillpowerLab",
  description: "The terms that govern your use of WillpowerLab.",
};

/**
 * The Terms of Service are the text the policy record stores, and nothing else.
 *
 * Founder 2026-09-25, decision 2. This page used to carry the v1.2 text (28
 * August 2026, the retired bundled consent) as its stand-in, and a visitor the
 * old owner-bound read refused — anyone not signed in and without a guest
 * token — read only that. It now reads the stored copy on the server, as
 * /privacy does, with the same loading line and a plain line if the record
 * cannot be read at all.
 */
export const revalidate = 300;

export default async function TermsPage() {
  const initial = await loadPublishedPolicyText("terms");
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
        which="terms"
        initial={initial}
        unavailable={
          <p role="alert" className="text-sm text-muted-foreground">
            {DATA_CONSENT_PENDING_COPY.termsUnavailable}
          </p>
        }
      >
        <SectionLoadingState />
      </PublishedPolicyText>
    </div>
  );
}

"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cameFromDataConsent, markDataConsentReturn } from "./legalReturn";

/* The back link on /privacy and /terms. Opened from Data & consent (the
   links there carry ?from=data-consent) it returns there; from anywhere else
   it is the "Back home" it always was (founder 2026-10-07: "when I am on the
   Privacy policy and terms pages, and I click back I am brought back to the
   lounge and I should have been brought to the settings screen").

   It returns to the same spot without growing history (build plan D-CS-5):
   when the entry behind this page is Data & consent, "Back" is the browser's
   own back, so the back gesture afterwards does not reopen this page;
   otherwise the link REPLACES this page with Data & consent. Either way Data
   & consent restores where it was left (legalReturn.ts). */

export const DATA_CONSENT_PATH = "/account/data-consent";
export const FROM_DATA_CONSENT = "data-consent";

const LINK_CLASS =
  "mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground";

function Home() {
  return (
    <Link href="/" className={LINK_CLASS}>
      <ArrowLeft className="h-4 w-4" />
      Back home
    </Link>
  );
}

function Resolved() {
  const from = useSearchParams()?.get("from");
  const pathname = usePathname();
  const router = useRouter();
  if (from !== FROM_DATA_CONSENT) return <Home />;
  return (
    <Link
      href={DATA_CONSENT_PATH}
      replace
      scroll={false}
      className={LINK_CLASS}
      onClick={(event) => {
        const back = cameFromDataConsent(pathname);
        markDataConsentReturn();
        if (!back) return;
        event.preventDefault();
        router.back();
      }}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Link>
  );
}

export default function LegalBackLink() {
  // useSearchParams needs a Suspense boundary on a statically rendered page;
  // until it resolves the page shows the link it always had.
  return (
    <Suspense fallback={<Home />}>
      <Resolved />
    </Suspense>
  );
}

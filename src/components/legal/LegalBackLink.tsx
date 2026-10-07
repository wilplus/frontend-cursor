"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/* The back link on /privacy and /terms. Opened from Data & consent (the
   links there carry ?from=data-consent) it returns there; from anywhere else
   it is the "Back home" it always was (founder 2026-10-07: "when I am on the
   Privacy policy and terms pages, and I click back I am brought back to the
   lounge and I should have been brought to the settings screen"). */

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
  if (from !== FROM_DATA_CONSENT) return <Home />;
  return (
    <Link href={DATA_CONSENT_PATH} className={LINK_CLASS}>
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

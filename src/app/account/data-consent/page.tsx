"use client";

/* -------------------------------------------------------------------------- */
/*  Data & consent (founder 2026-09-25, F2 = A).                              */
/*                                                                            */
/*  This page used to show the MLC-2 founder-canary consent, whose backend    */
/*  answers 410 because pooled learning is switched off, so every visitor     */
/*  saw "No MLC-2 founder-canary consent applies". It now shows the choices   */
/*  a person can actually change: the practice tick and the sensitive-        */
/*  information consent. The body lives in DataConsentChoices, because a      */
/*  Next.js page file may export only Next's own fields.                      */
/* -------------------------------------------------------------------------- */

import Link from "next/link";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DataConsentChoices from "@/components/account/DataConsentChoices";
import TrainingConsentCard from "@/components/account/TrainingConsentCard";
import { DATA_CONSENT_COPY } from "@/lib/legal/dataConsentCopy";

export default function DataConsentPage() {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <DashboardHeader />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">
          {DATA_CONSENT_COPY.title}
        </h1>
        <DataConsentChoices />
        <div className="mt-6">
          <TrainingConsentCard />
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms of Service
          </Link>
        </p>
      </div>
    </main>
  );
}

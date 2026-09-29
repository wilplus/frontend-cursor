"use client";

/* -------------------------------------------------------------------------- */
/*  /account/model-improvement (Q7, founder 2026-09-29).                      */
/*                                                                            */
/*  The bundled model-improvement consent on its own page, reached from the   */
/*  announcement sheet's Phase-2 "yes". The body lives in                     */
/*  ModelImprovementConsent, because a Next.js page file may export only      */
/*  Next's own fields.                                                        */
/* -------------------------------------------------------------------------- */

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ModelImprovementConsent from "@/components/account/ModelImprovementConsent";
import { MODEL_IMPROVEMENT_COPY } from "@/lib/legal/modelImprovementCopy";

export default function ModelImprovementPage() {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <DashboardHeader />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">
          {MODEL_IMPROVEMENT_COPY.title}
        </h1>
        <div className="mt-6 flex flex-col">
          <ModelImprovementConsent />
        </div>
      </div>
    </main>
  );
}

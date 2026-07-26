"use client";

import { useRouter } from "next/navigation";
import { hasConsented } from "@/lib/life/types";
import { useLifePanel } from "@/components/life/PanelShell";
import FirstRun from "@/components/life/FirstRun";
import SetupFlow from "@/components/life/SetupFlow";

/** FE-3 — setup on its own route so a resume link, or the #-before-setup
 *  redirect, can land straight on the form. Consent still comes first: this
 *  page cannot be used to skip page 2 (N2). */
export default function SetupPage() {
  const { state, refresh } = useLifePanel();
  const router = useRouter();

  if (!hasConsented(state)) {
    return (
      <FirstRun
        requiredVersion={state.consent.requiredVersion}
        onConsented={() => void refresh()}
      />
    );
  }

  return (
    <SetupFlow
      resumeStep={state.setup.resumeStep}
      onComplete={() => {
        void refresh();
        router.push("/panel/principles");
      }}
    />
  );
}

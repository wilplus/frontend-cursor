"use client";

import { useEffect, useState } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import Phase1AcceptanceFlow from "../../../Phase1AcceptanceFlow";
import { useSignedIn } from "../../../useSignedIn";
import { useUserId } from "../../../useUserId";
import { baselineAuthorization, privateBaselineAuthorization, type LocalAuthorization } from "@/services/api/baselineAuthorization";
import { baselinePilot, BaselineAccessError, privateBaselinePilot } from "@/services/api/baselinePilot";
import BaselinePilot, { PilotAccessNotice } from "./BaselinePilot";

const COPY = {
  en: { checking: "Loading…", error: "The pilot could not be loaded.", retry: "Try again" },
  pl: { checking: "Wczytywanie…", error: "Nie udało się otworzyć pilotażu.", retry: "Spróbuj ponownie" },
};

// A changed account cannot keep the previous account's mounted pilot or recording.
export function PrivateBaselinePilotGate() {
  const signedIn = useSignedIn();
  const user = useUserId();
  const copy = COPY[useUiLocale()];
  if (signedIn === false) return <PilotAccessNotice kind="signed-out" />;
  return signedIn && user ? <BaselinePilotGate key={user} preview={false} />
    : <p role="status" className="p-6 text-center">{copy.checking}</p>;
}

type GateState = LocalAuthorization | { kind: "denied" | "signed-out" };

export default function BaselinePilotGate({ preview = true }: { preview?: boolean }) {
  const locale = useUiLocale();
  const copy = COPY[locale];
  const api = preview ? baselinePilot : privateBaselinePilot;
  const authorization = preview ? baselineAuthorization : privateBaselineAuthorization;
  const [initialLanguage] = useState(locale);
  const [state, setState] = useState<GateState | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState(null);
    // A signed-in user without the pilot grant must never see its consent.
    void api.status(initialLanguage).then(() => active ? authorization.status() : null)
      .then((value) => { if (active) setState(value); })
      .catch((error: unknown) => {
        if (active) setState({ kind: error instanceof BaselineAccessError ? error.kind : "unavailable" });
      });
    return () => { active = false; };
  }, [api, attempt, authorization, initialLanguage]);
  const readAgain = () => setAttempt((value) => value + 1);
  if (state?.kind === "signed-out" || state?.kind === "denied") return <PilotAccessNotice kind={state.kind} />;
  if (state?.kind === "authorized") return <BaselinePilot api={api} preview={preview} />;
  if (state?.kind === "required") return <div className="flex h-full flex-col overflow-y-auto">
    <Phase1AcceptanceFlow policy={state.policy} priorCountry={state.priorCountry}
      actions={authorization} onAccepted={readAgain} onStale={readAgain} />
  </div>;
  return <main className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
    <p role="status">{state ? copy.error : copy.checking}</p>
    {state ? <button type="button" onClick={readAgain} className="min-h-11 underline">{copy.retry}</button> : null}
  </main>;
}

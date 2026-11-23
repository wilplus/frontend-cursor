"use client";

import { useState } from "react";
import { TapRow } from "@/components/willab/WillQuestion";
import { clearHold } from "@/lib/willab/experiments/voiceHold";
import { NOT_ON_YET } from "@/lib/willab/experiments/voiceCatalog";
import { deleteVoiceData } from "@/services/api/voiceCatalog";

/* Consent and the AI line, before any recording. Results stay with this person. */

export function VoiceConsent({ onAgree, onSkip }: { onAgree: () => void; onSkip: () => void }) {
  const [note, setNote] = useState("");
  const remove = () => {
    clearHold();
    void deleteVoiceData().then((result) => setNote(result === "deleted" ? "Deleted." : NOT_ON_YET));
  };
  return (
    <div data-voice-consent="" className="flex flex-col gap-2 px-3 pb-2">
      <p className="m-0 text-[16px] font-semibold text-foreground">Before you record</p>
      <p className="m-0 text-[15px] leading-snug text-foreground">An AI reads the recording. It does not name a feeling.</p>
      <p className="m-0 text-[15px] leading-snug text-muted-foreground">Only you see the result. No host, admin, or employer sees it, or a total.</p>
      {note ? <p data-voice-deleted="" className="m-0 text-[15px] text-muted-foreground">{note}</p> : null}
      <button type="button" data-voice-delete="" className="self-start text-[15px] text-foreground underline" onClick={remove}>Delete my data</button>
      <TapRow even labels={["Not now", "I agree"]} onTap={(label) => (label === "I agree" ? onAgree() : onSkip())} dataAttr={{ "data-voice-consent-taps": "" }} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { WALK_QUOTES } from "@/lib/life/copy";
import { getWalkQuoteSetting, setWalkQuote, type WalkQuoteSetting as Setting } from "@/services/api/walkQuote";
import { PanelCard } from "./primitives";
import { SlotSwitch } from "./ReminderSettings";

/* -------------------------------------------------------------------------- */
/*  The walk quotes your notebook (backend N268; docs/flows/principles.md §1  */
/*  R5): "Not here" in the walk turns it off for every later walk; this      */
/*  switch turns it back on. Shown only to someone who has it (ring 5 and    */
/*  the notebook kept): for anyone else, nothing.                            */
/* -------------------------------------------------------------------------- */

export default function WalkQuoteSetting() {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let on = true;
    void getWalkQuoteSetting().then((s) => {
      if (on) setSetting(s);
    });
    return () => {
      on = false;
    };
  }, []);
  if (!setting?.available) return null;

  async function toggle(next: boolean) {
    setBusy(true);
    const saved = await setWalkQuote(next);
    if (saved) setSetting(saved);
    setBusy(false);
  }

  return (
    <PanelCard>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium text-foreground">{WALK_QUOTES.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{WALK_QUOTES.body}</p>
        </div>
        <SlotSwitch label={WALK_QUOTES.title} checked={setting.on} busy={busy} onChange={(next) => void toggle(next)} />
      </div>
      <p data-walk-quote-hint className="mt-3 text-sm text-muted-foreground">
        {setting.on ? WALK_QUOTES.onHint : WALK_QUOTES.offHint}
      </p>
    </PanelCard>
  );
}

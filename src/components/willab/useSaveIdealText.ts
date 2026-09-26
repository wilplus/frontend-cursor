"use client";

import { useEffect, useState } from "react";
import { saveIdealText } from "@/services/api/saveIdealText";

/** Save the ideal text — accept-and-freeze — as a hook, so it can live in the
 *  header's ⋯ menu (founder 2026-09-26: "Save the ideal text can be moved")
 *  without changing what it does.
 *
 *  Same lane and the same guards the bottom button had:
 *  - the edit lane is drained first (`onBeforeSave`), and a failed drain
 *    abandons the freeze rather than freezing the wrong words;
 *  - `busy` is released only when the host's refetch reports `saved`
 *    (review R-md3), so a second tap cannot re-run accept-and-freeze during
 *    the refetch round trip;
 *  - "unavailable" (lane not deployed) and "nothing" (nothing pending) are
 *    not the speaker's fault and show no failure. */
export function useSaveIdealText({
  arcId,
  saved,
  onBeforeSave,
  onSaved,
}: {
  arcId: string;
  saved: boolean | null;
  onBeforeSave?: () => Promise<boolean>;
  onSaved: () => void;
}): { save: () => Promise<void>; busy: boolean; failed: boolean } {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const busy = saving || justSaved;
  useEffect(() => {
    if (saved) setJustSaved(false);
  }, [saved]);

  const save = async () => {
    if (busy || saved) return;
    setSaving(true);
    setFailed(false);
    const flushed = (await onBeforeSave?.()) ?? true;
    if (!flushed) {
      setSaving(false);
      setFailed(true);
      return;
    }
    const r = await saveIdealText(arcId);
    setSaving(false);
    if (r.kind === "saved" || r.kind === "nothing") {
      setJustSaved(true);
      onSaved();
    } else if (r.kind !== "unavailable") {
      setFailed(true);
    }
  };

  return { save, busy, failed };
}

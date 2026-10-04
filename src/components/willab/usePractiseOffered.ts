"use client";

import { useEffect, useState } from "react";
import {
  practiseOfferedNow,
  readPractiseOffered,
} from "@/services/api/consentChoices";

/** Whether Practise may be offered on the speaker's sheets (F1 Repair Plan
 *  Phase 4). False only when the speaker has turned Personalised practice
 *  off: every practice route then answers 403 CONSENT_CHOICE_OFF, and the
 *  speaker used to record a whole attempt before hearing so. Wiring only --
 *  the sheet already draws itself without Practise when it has no practise
 *  handler, so nothing new is drawn and no string is added. */
export function usePractiseOffered(): boolean {
  const [offered, setOffered] = useState<boolean>(
    () => practiseOfferedNow() ?? true,
  );
  useEffect(() => {
    let live = true;
    void readPractiseOffered().then((value) => {
      if (live) setOffered(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return offered;
}

"use client";

import { useEffect, useState } from "react";
import { getPendingSend } from "./sendStatus";

/* -------------------------------------------------------------------------- */
/*  THE CHAT WAITS WHILE THE TAKE IS HANDED OVER (founder 2026-10-18: "after   */
/*  the sign up you should not be landing on the lounge but the walk's 1st    */
/*  screen").                                                                 */
/*                                                                            */
/*  A guest's sign-up comes back to /chat with the Take still to be claimed   */
/*  and sent (PendingCoachSend, mounted in the layout). That takes a moment,  */
/*  and when it is done the page opens the Take's walk. Until then the        */
/*  surface drew the Lounge, so a brand-new speaker saw the chat first and    */
/*  the walk second. While a pending send is on the device and the person is  */
/*  signed in, the surface shows its wait instead; the sender says when it    */
/*  is done without opening the walk (the claim or the send did not go        */
/*  through), and the chat shows then, as it did. A ceiling bounds the wait   */
/*  in case nothing ever says so.                                             */
/* -------------------------------------------------------------------------- */

export const PENDING_SEND_SETTLED_EVENT = "willab:pending-send-settled";

/** The longest the chat waits on the hand-off before showing anyway. */
export const PENDING_SEND_HOLD_CEILING_MS = 20_000;

/** The sender finished without opening the walk: the chat may show. */
export function notifyPendingSendSettled(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PENDING_SEND_SETTLED_EVENT));
}

export function usePendingSendHold(signedIn: boolean | null): boolean {
  const [holding, setHolding] = useState(false);
  useEffect(() => {
    if (getPendingSend() === null) return;
    setHolding(true);
    const release = () => setHolding(false);
    window.addEventListener(PENDING_SEND_SETTLED_EVENT, release);
    const ceiling = setTimeout(release, PENDING_SEND_HOLD_CEILING_MS);
    return () => {
      window.removeEventListener(PENDING_SEND_SETTLED_EVENT, release);
      clearTimeout(ceiling);
    };
  }, []);
  return signedIn === true && holding;
}

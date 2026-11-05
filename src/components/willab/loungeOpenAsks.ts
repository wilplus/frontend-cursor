import { afterChatBoot } from "@/lib/chatBoot";

/* -------------------------------------------------------------------------- */
/*  The Lounge opened: the day's asks, after the thread (2026-11-05)          */
/*                                                                            */
/*  Each time the Lounge opens, three asks may be written into the thread by */
/*  the backend: the quarter that is due (life goals), the ask or the day's  */
/*  why, one kept strength the day before a talk (strengths). They           */
/*  used to go out the moment the Lounge mounted, beside the read of the      */
/*  thread the speaker is waiting for, and each that wrote read the whole     */
/*  thread again, so a busy morning read it three more times.                 */
/*                                                                            */
/*  Now each starts once the thread has painted (chatBoot.ts), and however    */
/*  many of the asks that went out together wrote, the thread is read again   */
/*  once, when the last of them has answered. The same asks, the same rows,   */
/*  the same reload: only when.                                               */
/* -------------------------------------------------------------------------- */

interface Round {
  pending: number;
  wrote: boolean;
  reload: () => Promise<unknown>;
}

let round: Round | null = null;

/** Write the day's ask once the thread has painted; read the thread again
 *  if it (or an ask beside it) wrote. Returns a cancel for an unmount before
 *  the ask has gone out. */
export function askWhenLoungeOpens(
  write: () => Promise<boolean>,
  reload: () => Promise<unknown>,
): () => void {
  return afterChatBoot(() => {
    const current = round ?? (round = { pending: 0, wrote: false, reload });
    current.pending += 1;
    current.reload = reload;
    void write()
      .catch(() => false)
      .then((wrote) => {
        if (wrote) current.wrote = true;
        current.pending -= 1;
        if (current.pending > 0) return;
        if (round === current) round = null;
        if (current.wrote) void current.reload().catch(() => undefined);
      });
  });
}

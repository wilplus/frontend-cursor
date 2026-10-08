import { WALK_COPY, WALK_LINE_BANK } from "@/components/willab/idealEditCopy";
import type { WalkStep } from "./walkPlan";

/* -------------------------------------------------------------------------- */
/*  NEVER THE SAME LINE TWICE IN A ROW (build plan D-FW-3; founder lock        */
/*  2026-10-06, the Feedback walk, "Line bank"; docs/SIGNED-line-bank-         */
/*  2026-10-06.md "Rotation"; backend 0438).                                   */
/*                                                                            */
/*  Within one bank the app never shows the same line twice in a row, for one */
/*  speaker, across reloads, Takes and devices. The memory is the server's    */
/*  (line_bank_memory): as the walk opens it reads the line each bank says    */
/*  next; each line screen takes the next line of its bank the first time it */
/*  is drawn in this opening, keeps it when the speaker comes back to it (‹), */
/*  and is recorded as said when it is on screen. With no memory to read      */
/*  (a guest, a failed read, the dev harness) the walk starts each bank at    */
/*  its first line and still never repeats one within the opening.           */
/*                                                                            */
/*  Pure apart from the object it keeps. The words are the signed ones; this */
/*  file only picks among them. No later line is ever said here: the walk     */
/*  has no read to prove one true.                                            */
/* -------------------------------------------------------------------------- */

/** A signed bank the walk says lines from: B01 to B14, the encouragement
 *  when nothing moved (NX3a) and the thank-you after the third try (CM3b). */
export type WalkBankKey = keyof typeof WALK_LINE_BANK | "NX3a" | "CM3b";

/** The bank's signed lines, in their signed order. */
export function linesOf(bank: WalkBankKey): readonly string[] {
  if (bank === "NX3a") return WALK_COPY.encourageNothingMoved;
  if (bank === "CM3b") return WALK_COPY.afterThirdTry;
  return WALK_LINE_BANK[bank].lines;
}

/** The server's memory, as the walk calls it (services/api/lineBank.ts). */
export type WalkLinesIO = {
  /** {bank: index} each bank says next; null when it cannot be read. */
  next: () => Promise<Record<string, number> | null>;
  /** A line of `bank` is on screen: record it as said. */
  shown: (bank: string) => Promise<void>;
};

/** Says a line of `bank` on `step`'s screen. */
export type SayLine = (step: WalkStep, bank: WalkBankKey) => string;

/** A screen's place, the same each time it is drawn in one opening. */
export function lineSlot(step: WalkStep, bank: WalkBankKey): string {
  return [step.key, step.moment ?? "", step.attempt ?? "", step.kind ?? "", bank].join(":");
}

const slotOfStep = (step: WalkStep) => lineSlot(step, "B01").replace(/:B01$/, ":");

export type LineTurns = {
  /** The line for `step`'s screen: the one it was given, else the next of
   *  its bank. */
  say: SayLine;
  /** The banks whose lines `step`'s screen took and were not yet recorded;
   *  they are recorded now. */
  takeUnrecorded: (step: WalkStep) => WalkBankKey[];
  /** The memory, as read: banks this opening already said a line of keep
   *  their own next (the read may predate that line's record). */
  adopt: (next: Record<string, number>) => void;
  /** A new opening of the walk: every screen takes a fresh line. */
  reopen: () => void;
};

export function createLineTurns(): LineTurns {
  const next = new Map<WalkBankKey, number>();
  const given = new Map<string, { bank: WalkBankKey; index: number }>();
  const recorded = new Set<string>();
  const touched = new Set<WalkBankKey>();
  return {
    say(step, bank) {
      const lines = linesOf(bank);
      const slot = lineSlot(step, bank);
      let mine = given.get(slot);
      if (!mine) {
        const index = ((next.get(bank) ?? 0) % lines.length + lines.length) % lines.length;
        mine = { bank, index };
        given.set(slot, mine);
        next.set(bank, (index + 1) % lines.length);
        touched.add(bank);
      }
      return lines[mine.index];
    },
    takeUnrecorded(step) {
      const prefix = slotOfStep(step);
      const out: WalkBankKey[] = [];
      for (const [slot, mine] of given) {
        if (!slot.startsWith(prefix) || recorded.has(slot)) continue;
        recorded.add(slot);
        out.push(mine.bank);
      }
      return out;
    },
    adopt(read) {
      for (const [bank, index] of Object.entries(read)) {
        const key = bank as WalkBankKey;
        if (touched.has(key)) continue;
        if (!Number.isInteger(index) || index < 0) continue;
        next.set(key, index);
      }
    },
    reopen() {
      given.clear();
      recorded.clear();
      touched.clear();
    },
  };
}

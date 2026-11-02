/* -------------------------------------------------------------------------- */
/*  The times in the chats (backend N322 item 2; rules:                        */
/*  docs/flows/customer-requests.md §1 C1): a clock time in each message and   */
/*  on each row of the list ("06:12", local), and the day above the messages   */
/*  ("Today", otherwise the date, "2 November"; never "Yesterday"). A clock    */
/*  time is not about the speaker (Never 1). A time that cannot be read is     */
/*  drawn as nothing.                                                          */
/* -------------------------------------------------------------------------- */

/** Signed in N322 (Never 4). */
export const TODAY = "Today";

const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
const DATE_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

function read(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Milliseconds since the epoch, or null when it cannot be read. */
export function timeOf(iso: string | null | undefined): number | null {
  return read(iso)?.getTime() ?? null;
}

/** "06:12", in the person's own time zone. */
export function clockTime(iso: string | null | undefined): string {
  const at = read(iso);
  return at ? CLOCK.format(at) : "";
}

const localDay = (at: Date) => `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;

/** The local day a message was written on, as a key ("2026-11-2"). */
export function dayKey(iso: string | null | undefined): string {
  const at = read(iso);
  return at ? localDay(at) : "";
}

/** The day above a day's messages: "Today", or "2 November" (with the year
 *  when it is not this year). */
export function dayLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const at = read(iso);
  if (!at) return "";
  if (localDay(at) === localDay(now)) return TODAY;
  return (at.getFullYear() === now.getFullYear() ? DATE : DATE_YEAR).format(at);
}

/** The time on a row of the list: the clock time today, the date before. */
export function listTime(iso: string | null | undefined, now: Date = new Date()): string {
  const label = dayLabel(iso, now);
  return label === TODAY ? clockTime(iso) : label;
}

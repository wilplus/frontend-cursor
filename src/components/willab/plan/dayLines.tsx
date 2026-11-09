import { fmtDay, weekdayName } from "@/lib/willab/planCopy";

/* The day line (rules: the-plan.md §1 G3; backend N169): in a chat that
   spans several days, a small grey line, "Monday 26 October", before the
   first message of each day, in the speaker's own time zone (the phone's).
   A row that draws its own day line (the plan's hello, backend `day_line`)
   keeps it, and gets no second one. */

/** "Monday 26 October", in local time. */
export function dayLineText(d: Date): string {
  return `${weekdayName(d)} ${fmtDay(d)}`;
}

function localDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Where the chat draws a day line: the index of each day's first row, and
 *  the line's words. None in a chat that is all one day. */
export function dayLinesFor(rows: { at: string; ownLine?: boolean }[]): Map<number, string> {
  const days = rows.map((r) => localDay(r.at));
  const out = new Map<number, string>();
  if (new Set(days.filter((d): d is string => d !== null)).size < 2) return out;
  let last: string | null = null;
  rows.forEach((r, i) => {
    const day = days[i];
    if (day === null || day === last) return;
    last = day;
    if (!r.ownLine) out.set(i, dayLineText(new Date(r.at)));
  });
  return out;
}

export function DayLine({ text }: { text: string }) {
  return (
    <div className="self-center py-1.5 text-[12.5px] text-[#737373]" data-day-line>
      {text}
    </div>
  );
}

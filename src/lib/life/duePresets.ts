/* -------------------------------------------------------------------------- */
/*  duePresets — tappable due labels per horizon (founder 2026-07-27)          */
/*                                                                            */
/*  The goal's due field is FREE TEXT and stays free text: the label is the    */
/*  source of truth, and a date picker would quietly normalise "[Jul '27]"     */
/*  into a concrete day the user never chose (spec §3.2). So instead of        */
/*  replacing the field, this offers the common answers as chips — the same    */
/*  affordance the recording flow's length presets use — and typing anything   */
/*  else still works.                                                          */
/*                                                                            */
/*  A chip WRITES THE LABEL VERBATIM. Nothing here parses, sorts or converts a */
/*  due label, so §3.2 holds by construction: the stored value is either what  */
/*  the user typed or what they saw on the chip they tapped.                   */
/*                                                                            */
/*  `now` is a parameter, never read from the clock inside, so the output is a */
/*  pure function of its inputs and a test can pin a date.                     */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** The presets for a horizon, in the notation the placeholders already use.
 *  An unknown key returns none — the field is then simply free text, which is
 *  the safe degrade rather than a guess at what its horizon means. */
export function duePresets(horizonKey: string, now: Date): string[] {
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthLabel = (offset: number) => `[${MONTHS[(month + offset) % 12]}]`;

  switch (horizonKey) {
    case "daily":
      return ["[NOW]", "[today]", "[tonight]"];
    case "weekly":
      return ["[this week]", "[Mon]", "[Fri]"];
    case "monthly":
      // This month and the two after it — the horizon is a month, so a month
      // name is the answer, and the useful ones are the near ones.
      return [monthLabel(0), monthLabel(1), monthLabel(2)];
    case "quarterly":
      return ["[Q1]", "[Q2]", "[Q3]", "[Q4]"];
    case "yearly":
      // Quarter ends, which is how a year's goals usually land.
      return ["[Mar]", "[Jun]", "[Sep]", "[Dec]"];
    case "five_year":
      return [`${year + 4}`, `${year + 5}`, `${year + 6}`];
    case "ten_year":
      return [`${year + 9}`, `${year + 10}`, `${year + 11}`];
    case "twenty_year":
      return [`${year + 19}`, `${year + 20}`, `${year + 21}`];
    default:
      return [];
  }
}

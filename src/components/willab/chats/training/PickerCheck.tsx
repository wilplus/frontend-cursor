"use client";

import { useEffect, useState } from "react";
import { Bubble } from "./ui";
import { patternRequest, speakingPatternPath } from "./speakingPatterns";

/* Your labels as the golden set for both pickers (backend N702). Founder
   only, a report: nothing here changes what the app serves. */

type Tally = { agree: number; differ: number; unknown: number };
type Golden = { moment: Tally; intervention: Tally; corpus_labels: number };

function line(name: string, t: Tally): string {
  const judged = t.agree + t.differ;
  if (!judged) return `${name}: nothing to compare yet.`;
  const waiting = t.unknown ? ` ${t.unknown} not served yet.` : "";
  return `${name}: agrees with you on ${t.agree} of ${judged}.${waiting}`;
}

export default function PickerCheck() {
  const [golden, setGolden] = useState<Golden | null>(null);
  useEffect(() => {
    let active = true;
    void patternRequest<Golden>(`${speakingPatternPath}/golden`)
      .then((got) => { if (active) setGolden(got?.moment && got?.intervention ? got : null); })
      .catch(() => { if (active) setGolden(null); });
    return () => { active = false; };
  }, []);
  if (!golden) return null;
  return <div data-picker-check="" className="flex flex-col gap-2">
    <Bubble>{line("Moment picker", golden.moment)}</Bubble>
    <Bubble>{line("Intervention picker", golden.intervention)}</Bubble>
    {golden.corpus_labels ? <Bubble>{`${golden.corpus_labels} Training Corpus labels are kept for training; they have no walk to compare.`}</Bubble> : null}
  </div>;
}

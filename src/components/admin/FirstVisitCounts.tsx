"use client";

import { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  FirstVisitCounts — where people leave between the landing page and their  */
/*  first feedback, the last 30 days (backend N271). Every step in order,     */
/*  with how many reached it and how many the step before lost; the sign-up   */
/*  screen and the accounts made by way come from their own count (N207 item  */
/*  6), which this card took over from SignupCounts. The founder's only; no   */
/*  speaker sees it.                                                          */
/* -------------------------------------------------------------------------- */

type Step =
  | "landing"
  | "enter"
  | "agreed"
  | "recording"
  | "recorded"
  | "ready"
  | "signup_seen"
  | "account_made"
  | "walk";

interface Counts {
  since: string;
  path: { step: Step; n: number }[];
  ways: Record<string, number>;
  days: { day: string; steps: Record<Step, number> }[];
}

const LABELS: Record<Step, string> = {
  landing: "Saw the landing page",
  enter: "Tapped Enter the lab",
  agreed: "Agreed",
  recording: "Started recording",
  recorded: "Finished the Take",
  ready: "Result ready",
  signup_seen: "Opened sign-up",
  account_made: "Made an account",
  walk: "Opened the walk",
};

const SHORT: Record<Step, string> = {
  landing: "Landing",
  enter: "Enter",
  agreed: "Agreed",
  recording: "Rec",
  recorded: "Done",
  ready: "Ready",
  signup_seen: "Sign-up",
  account_made: "Account",
  walk: "Walk",
};

const WAYS: [string, string][] = [
  ["email", "Email"],
  ["google", "Google"],
  ["linkedin_oidc", "LinkedIn"],
];

function ways(counts: Record<string, number>): string {
  const known = WAYS.map(([key, label]) => `${label} ${counts[key] ?? 0}`);
  const other = Object.entries(counts)
    .filter(([key]) => !WAYS.some(([k]) => k === key))
    .map(([key, n]) => `${key} ${n}`);
  return [...known, ...other].join(" · ");
}

/** The step that loses the most people, by count, among steps that follow a
 *  step someone reached. */
function biggestDrop(path: Counts["path"]): number {
  let at = -1;
  let most = 0;
  for (let i = 1; i < path.length; i++) {
    const lost = path[i - 1].n - path[i].n;
    if (lost > most) {
      most = lost;
      at = i;
    }
  }
  return at;
}

export default function FirstVisitCounts() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch("/api/v2/admin/first-visit-counts", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as Counts;
      })
      .then((body) => live && setCounts(body))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  return (
    <section aria-label="First visit, last 30 days" className="mt-6 rounded-2xl border border-foreground/12 p-4">
      <h2 className="text-sm font-semibold">First visit, last 30 days</h2>
      <p className="mt-1 text-xs text-foreground/60">
        Visitors without an account, once per browser tab. Made an account counts every new account.
      </p>
      {failed ? (
        <p className="mt-2 text-sm text-foreground/60">Could not read the counts.</p>
      ) : !counts ? (
        <p className="mt-2 text-sm text-foreground/60">Loading…</p>
      ) : (
        <Path counts={counts} />
      )}
    </section>
  );
}

function Path({ counts }: { counts: Counts }) {
  const top = Math.max(1, ...counts.path.map((s) => s.n));
  const drop = biggestDrop(counts.path);
  return (
    <>
      <ol className="mt-3 flex flex-col gap-1.5 text-sm">
        {counts.path.map((s, i) => {
          const lost = i > 0 ? counts.path[i - 1].n - s.n : 0;
          return (
            <li key={s.step} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3.5rem_4.5rem] items-center gap-3">
              <span className="truncate">{LABELS[s.step]}</span>
              <span className="h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
                <span
                  className={`block h-full rounded-full ${i === drop ? "bg-primary" : "bg-foreground/40"}`}
                  style={{ width: `${(s.n / top) * 100}%` }}
                />
              </span>
              <span className="text-right font-semibold tabular-nums">{s.n}</span>
              <span className={`text-right text-xs tabular-nums ${i === drop ? "font-semibold text-primary" : "text-foreground/50"}`}>
                {lost > 0 ? `−${lost}` : ""}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-foreground/60">Accounts by way: {ways(counts.ways)}</p>
      {counts.days.length > 0 ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-foreground/60">By day</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-foreground/50">
                <tr>
                  <th className="py-1 pr-2 font-medium">Day</th>
                  {counts.path.map((s) => (
                    <th key={s.step} className="py-1 pr-2 text-right font-medium" title={LABELS[s.step]}>
                      {SHORT[s.step]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {counts.days.map((d) => (
                  <tr key={d.day} className="border-t border-foreground/10">
                    <td className="py-1 pr-2">{d.day}</td>
                    {counts.path.map((s) => (
                      <td key={s.step} className="py-1 pr-2 text-right tabular-nums">
                        {d.steps[s.step] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </>
  );
}

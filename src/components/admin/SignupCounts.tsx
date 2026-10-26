"use client";

import { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  SignupCounts — how many people opened the sign-up screen and how many     */
/*  made an account, by way, the last 30 days (backend N207 item 6; N174 item  */
/*  6: count the sign-up screen before deciding on signing up with WhatsApp). */
/*  The founder's only; no speaker sees it.                                    */
/* -------------------------------------------------------------------------- */

interface Day {
  day: string;
  seen: number;
  made: number;
  ways: Record<string, number>;
}

interface Counts {
  since: string;
  total: { seen: number; made: number; ways: Record<string, number> };
  days: Day[];
}

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

export default function SignupCounts() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch("/api/v2/admin/signup-counts", { cache: "no-store" })
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
    <section aria-label="Sign-up, last 30 days" className="mt-6 rounded-2xl border border-foreground/12 p-4">
      <h2 className="text-sm font-semibold">Sign-up, last 30 days</h2>
      {failed ? (
        <p className="mt-2 text-sm text-foreground/60">Could not read the counts.</p>
      ) : !counts ? (
        <p className="mt-2 text-sm text-foreground/60">Loading…</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-foreground/60">Opened the sign-up screen</dt>
              <dd className="text-lg font-semibold">{counts.total.seen}</dd>
            </div>
            <div>
              <dt className="text-foreground/60">Made an account</dt>
              <dd className="text-lg font-semibold">{counts.total.made}</dd>
              <dd className="text-xs text-foreground/60">{ways(counts.total.ways)}</dd>
            </div>
          </dl>
          {counts.days.length > 0 ? (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-foreground/60">By day</summary>
              <table className="mt-2 w-full text-left text-xs">
                <thead className="text-foreground/50">
                  <tr>
                    <th className="py-1 font-medium">Day</th>
                    <th className="py-1 font-medium">Opened</th>
                    <th className="py-1 font-medium">Made</th>
                    <th className="py-1 font-medium">By way</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.days.map((d) => (
                    <tr key={d.day} className="border-t border-foreground/10">
                      <td className="py-1">{d.day}</td>
                      <td className="py-1">{d.seen}</td>
                      <td className="py-1">{d.made}</td>
                      <td className="py-1 text-foreground/60">{d.made ? ways(d.ways) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  "Not now", one person (backend N504 item 2).                              */
/*                                                                            */
/*  Each time the person said "Not now" to a Take or a question someone       */
/*  asked them in a chat: how many times, and the newest, with when, what,    */
/*  whose and the flow. Nobody is ever told about a "Not now" (N483 item 3,   */
/*  N485 item 3); it is behavioural data beside the voice data of their       */
/*  Takes, so it sits under the Takes. Founder only: the backend answers 403  */
/*  to any other admin, and then this section is not drawn at all. A speaker  */
/*  never sees any of this (Never 1).                                         */
/* -------------------------------------------------------------------------- */

interface Decline {
  at: string | null;
  what: "take" | "question" | null;
  flow: "list" | "match" | null;
  asker: string | null;
}

interface History {
  count: number;
  declines: Decline[];
}

const WHAT: Record<string, string> = { take: "a Take", question: "a question" };
const FLOW: Record<string, string> = { list: "from their chats", match: "a match" };

function when(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function NotNowHistory({ id }: { id: string }) {
  const [data, setData] = useState<History | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/v2/admin/people/${encodeURIComponent(id)}/not-now`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: History | null) => live && setData(body && Array.isArray(body.declines) ? body : null))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [id]);

  if (!data) return null;

  return (
    <section data-admin-not-now="">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Not now</h2>
      <div className="rounded-2xl border border-border px-4 py-3">
        <p className="text-sm">
          {data.count === 0 ? "Never said Not now." : `Said Not now ${data.count} ${data.count === 1 ? "time" : "times"}.`}
        </p>
        {data.declines.length ? (
          <ul className="mt-2 grid gap-1">
            {data.declines.map((d, i) => (
              <li key={`${d.at ?? ""}-${i}`} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-3 py-0.5 text-sm">
                <span className="text-muted-foreground tabular-nums">{when(d.at)}</span>
                <span>
                  {WHAT[d.what ?? ""] ?? "something"}
                  {d.asker ? ` from ${d.asker}` : ""}
                  {d.flow ? ` · ${FLOW[d.flow] ?? d.flow}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Only you see this. Nobody is told about a Not now.</p>
    </section>
  );
}

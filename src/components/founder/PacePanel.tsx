"use client";

/* -------------------------------------------------------------------------- */
/*  The pace panel (founder 2026-09-30, C9; ML-4): one row per jar with its    */
/*  count, its bar, the pace the weekly job observed and the weeks to the    */
/*  bar at that pace; a slider per row asks "and at N a week?"; the four     */
/*  doors as the code constants say them; the stored weeks with any          */
/*  migration a READY cue drafted. Nothing here opens a door or merges a     */
/*  draft: the founder copies the draft into a PR.                            */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { fill, formatRate, jarLabel, paceLine, sliderMax, weeksAt, type LedgerWeek, type PaceRow } from "@/lib/founder/pace";
import { founderLearning, type LedgerRead } from "@/services/api/founderLearning";
import { FounderFrame, Meter, Panel, Refusal } from "./FounderFrame";

const DOOR_LABELS: Record<string, string> = {
  consent: "Door 1 · the training yes (consent)",
  dataset_release: "Door 2 · dataset releases",
  training: "Door 3 · training runs",
  promotion: "Door 4 · promotion",
};

function WhatIf({ row }: { row: PaceRow }) {
  const max = sliderMax(row);
  const [rate, setRate] = useState<number>(Math.max(1, Math.min(max, Math.round(row.observedRate ?? 1))));
  const weeks = weeksAt(row.current, row.bar, rate);
  return (
    <label className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span>and at</span>
      <input
        type="range"
        min={1}
        max={max}
        step={1}
        value={rate}
        onChange={(e) => setRate(Number(e.target.value))}
        aria-label={`Weekly rate to try for ${jarLabel(row.jar)}`}
        className="w-40 accent-foreground"
      />
      <span className="tabular-nums">
        {rate} a week → {weeks === null ? "—" : weeks === 0 ? "already there" : `${weeks} ${weeks === 1 ? "week" : "weeks"}`}
      </span>
    </label>
  );
}

function JarRow({ row }: { row: PaceRow }) {
  const current = row.current ?? 0;
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{jarLabel(row.jar)}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.current === null ? "—" : current} / {row.bar}
          {row.caughtBar !== null ? ` · caught ${row.caughtRate === null ? "—" : formatRate(row.caughtRate * 100) + "%"} of ${Math.round(row.caughtBar * 100)}%` : ""}
          {row.ready ? " · READY" : ""}
        </span>
      </div>
      <div className="mt-2">
        <Meter value={current} of={row.bar} label={`${jarLabel(row.jar)}: ${current} of ${row.bar}`} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{paceLine(row)}</p>
      {row.current !== null && row.current < row.bar ? <WhatIf row={row} /> : null}
    </li>
  );
}

function Doors({ doors }: { doors: Record<string, unknown> }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {Object.entries(DOOR_LABELS).map(([key, label]) => {
        const door = (doors[key] ?? {}) as Record<string, unknown>;
        const open = door.open === true;
        return (
          <li key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
            <span>{label}</span>
            <span className={open ? "font-medium" : "text-muted-foreground"}>{open ? "open" : "closed"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Weeks({ weeks }: { weeks: LedgerWeek[] }) {
  if (weeks.length === 0) return <p className="text-sm text-muted-foreground">No week stored yet. The job runs Mondays 06:00 UTC once its cron service exists; “Run the weekly job now” stores this week.</p>;
  return (
    <ul className="grid gap-2">
      {[...weeks].reverse().map((week) => (
        <li key={week.weekStart} className="rounded-xl border border-border p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium tabular-nums">week of {week.weekStart}</span>
            <span className="text-xs text-muted-foreground">{week.readyCues.length === 0 ? "no cue ready" : `ready: ${week.readyCues.join(", ")}`}</span>
          </div>
          {week.exported.map((e) => (
            <p key={e.surface} className="mt-1 text-xs text-muted-foreground">
              {e.surface}: {e.exported} exported{e.why ? ` — ${e.why}` : ""}
            </p>
          ))}
          {Object.values(week.migrationDrafts).map((draft) => (
            <details key={draft.file} className="mt-2">
              <summary className="cursor-pointer text-xs font-medium">migration drafted: {draft.file} (copy into a PR; merging it is the promotion)</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs">{draft.sql}</pre>
              <p className="mt-1 text-xs text-muted-foreground">manifest line: <code>{draft.manifest_line}</code></p>
            </details>
          ))}
        </li>
      ))}
    </ul>
  );
}

export default function PacePanel() {
  const [read, setRead] = useState<LedgerRead | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await founderLearning.ledger();
    if (result.ok) {
      setRead(result.value);
      setRefusal(null);
    } else {
      setRefusal(result.code);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runNow() {
    setRunning(true);
    const result = await founderLearning.runWeekly();
    setRan(result.ok ? `stored the week of ${result.value.weekStart ?? "?"}` : `refused (${result.code})`);
    setRunning(false);
    void load();
  }

  const ledger = read?.ledger ?? {};
  const unavailable = Array.isArray(ledger.unavailable) ? (ledger.unavailable as string[]) : [];
  return (
    <FounderFrame title="Pace" line="founder only · how each jar fills, and the weeks to its bar at the observed pace">
      {refusal ? <Refusal code={refusal} /> : null}
      {read ? (
        <div className="grid gap-4">
          <Panel title="Jars" note="A pace is the mean weekly change over the last four stored weeks; with fewer than two, the panel says so instead of guessing.">
            <ul className="grid gap-2">
              {read.pace.map((row) => (
                <JarRow key={row.jar} row={row} />
              ))}
            </ul>
            {unavailable.length > 0 ? <p className="mt-2 text-xs text-muted-foreground">unavailable this read: {unavailable.join(", ")}</p> : null}
          </Panel>
          <Panel title="Doors" note="As the code constants say them. Nothing on this page opens one.">
            <Doors doors={(ledger.doors ?? {}) as Record<string, unknown>} />
          </Panel>
          <Panel title="Stored weeks" note="One row per ISO week from the weekly job; a second run in the same week replaces it.">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void runNow()}
                disabled={running}
                className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {running ? "Running…" : "Run the weekly job now"}
              </button>
              {ran ? <span className="text-xs text-muted-foreground">{ran}</span> : null}
            </div>
            <Weeks weeks={read.weeks} />
          </Panel>
        </div>
      ) : refusal ? null : (
        <p className="text-sm text-muted-foreground">Reading…</p>
      )}
    </FounderFrame>
  );
}

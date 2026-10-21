"use client";

/* -------------------------------------------------------------------------- */
/*  The founder's roadmap (founder 2026-10-21): where each planned piece of   */
/*  work stands, per version, read from GitHub by the backend. An overview    */
/*  only: nothing to decide or tick here. It reads again every two minutes   */
/*  while the page is on screen and whenever it comes back into view.         */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { readRoadmap, type Roadmap, type RoadmapItem, type RoadmapState } from "@/services/api/roadmap";
import { cn } from "@/lib/utils";
import { FounderFrame, Meter, Panel, Refusal } from "./FounderFrame";

const REFRESH_MS = 120_000;

const CHIP: Record<RoadmapState, { label: string; cls: string }> = {
  done: { label: "Done", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  in_review: { label: "In review", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  draft: { label: "Draft", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  in_progress: { label: "In progress", cls: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  not_started: { label: "Not started", cls: "bg-muted text-muted-foreground" },
  unknown: { label: "Not checked", cls: "border border-dashed border-border text-muted-foreground" },
};

function ago(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 36 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

function day(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
}

function ItemRow({ item }: { item: RoadmapItem }) {
  const chip = CHIP[item.state];
  return (
    <li className="grid grid-cols-[104px_1fr] gap-x-3 gap-y-1 border-t border-border py-3 first:border-t-0 max-sm:grid-cols-1">
      <span className={cn("h-fit w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold", chip.cls)}>{chip.label}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{item.title}</p>
        {item.why ? <p className="text-sm text-muted-foreground">{item.why}</p> : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {item.note}
          {item.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="ml-2 underline underline-offset-2">
              {l.label}
            </a>
          ))}
        </p>
      </div>
    </li>
  );
}

export default function RoadmapPanel() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const result = await readRoadmap();
    if (result.ok) {
      setRoadmap(result.value);
      setRefusal(null);
    } else {
      setRefusal(result.code);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
      else tick((n) => n + 1);
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const line = roadmap?.checkedAt
    ? `Where each planned piece of work stands, read from GitHub ${ago(roadmap.checkedAt)}.`
    : "Where each planned piece of work stands, read from GitHub.";

  return (
    <FounderFrame title="Roadmap" line={line}>
      {refusal && !roadmap ? <Refusal code={refusal} /> : null}
      {roadmap && !roadmap.ok && roadmap.problem ? (
        <p className="mb-4 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{roadmap.problem}</p>
      ) : null}
      {roadmap ? (
        <div className="grid gap-4">
          {roadmap.versions.map((v) => (
            <Panel key={v.key} title={`${v.key} · ${v.name}`} note={v.line}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Meter value={v.done} of={v.total} label={`${v.key}: ${v.done} of ${v.total} done`} />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {v.done} of {v.total} done
                </span>
              </div>
              <ul className="mt-3">
                {v.items.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ul>
            </Panel>
          ))}
          <Panel title="Recently merged">
            <ul className="grid gap-2">
              {roadmap.merged.map((m) => (
                <li key={`${m.repo}-${m.number}`} className="grid grid-cols-[64px_1fr] gap-x-3 text-sm">
                  <span className="text-xs tabular-nums text-muted-foreground">{day(m.mergedAt)}</span>
                  <span className="min-w-0">
                    <span className="mr-2 rounded border border-border px-1 text-[11px] text-muted-foreground">{m.repo}</span>
                    {m.url ? (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                        #{m.number} {m.title}
                      </a>
                    ) : (
                      `#${m.number} ${m.title}`
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
    </FounderFrame>
  );
}

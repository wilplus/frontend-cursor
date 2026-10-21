/* -------------------------------------------------------------------------- */
/*  The founder's roadmap (founder 2026-10-21): GET /api/v2/admin/roadmap.     */
/*  The backend reads the plan and both GitHub repositories and says where    */
/*  each item stands; this page only shows it.                                */
/* -------------------------------------------------------------------------- */

import { codedCall, type CodedResult } from "@/lib/api/bffCall";

export type RoadmapState = "done" | "in_review" | "draft" | "in_progress" | "not_started" | "unknown";

export interface RoadmapItem {
  id: string;
  title: string;
  why: string;
  state: RoadmapState;
  note: string;
  links: { label: string; url: string }[];
}

export interface RoadmapVersion {
  key: string;
  name: string;
  line: string;
  done: number;
  total: number;
  items: RoadmapItem[];
}

export interface RoadmapMerged {
  repo: string;
  number: number;
  title: string;
  mergedAt: string;
  url: string;
}

export interface Roadmap {
  checkedAt: string | null;
  ok: boolean;
  problem: string | null;
  versions: RoadmapVersion[];
  merged: RoadmapMerged[];
}

const STATES: RoadmapState[] = ["done", "in_review", "draft", "in_progress", "not_started", "unknown"];

const text = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
const github = (u: unknown) => (typeof u === "string" && u.startsWith("https://github.com/") ? u : "");

function mapItem(r: Record<string, unknown>): RoadmapItem {
  const state = STATES.includes(r.state as RoadmapState) ? (r.state as RoadmapState) : "unknown";
  return {
    id: text(r.id),
    title: text(r.title),
    why: text(r.why),
    state,
    note: text(r.note),
    links: list(r.links).map((l) => ({ label: text(l.label), url: github(l.url) })).filter((l) => l.url),
  };
}

export function mapRoadmap(b: Record<string, unknown>): Roadmap {
  return {
    checkedAt: typeof b.checked_at === "string" ? b.checked_at : null,
    ok: b.ok === true,
    problem: typeof b.problem === "string" ? b.problem : null,
    versions: list(b.versions).map((v) => {
      const items = list(v.items).map(mapItem);
      return {
        key: text(v.key),
        name: text(v.name),
        line: text(v.line),
        done: items.filter((i) => i.state === "done").length,
        total: items.length,
        items,
      };
    }),
    merged: list(b.merged).map((m) => ({
      repo: text(m.repo),
      number: Number(m.number) || 0,
      title: text(m.title),
      mergedAt: text(m.merged_at),
      url: github(m.url),
    })),
  };
}

export const readRoadmap = (): Promise<CodedResult<Roadmap>> =>
  codedCall("/api/v2/admin/roadmap", { method: "GET", cache: "no-store", credentials: "include" }, mapRoadmap);

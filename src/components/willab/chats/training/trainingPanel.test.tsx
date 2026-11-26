// @vitest-environment jsdom
/*
STORY    As the founder, I want to train the moment picker and the
         intervention picker one question at a time, so that the only thing
         I do is say which clip needs feedback and what it should get.
OUTCOME
  O1  Screen 1 shows up to three clips of one recording and asks "Which one
      needs feedback?"; picking one opens Screen 2, "What should it get?".
  O2  A tool saves the clip as needing feedback with that tool, then the
      next three clips come; "None needs it" saves every clip of the three
      as needing nothing.
  O3  Your past answers lists what was saved, and Undo removes it.
PROVES   O1 -> "one question per screen"
         O2 -> "a tool saves the clip and its tool; None saves the three"
         O3 -> "past answers can be undone"
WHY      Backend N704: the founder's whole Training panel.
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bffFetch } from "@/lib/api/bffFetch";
import type { PatternExample } from "./speakingPatterns";

vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: vi.fn() }));
vi.mock("@/services/api/trainings", () => ({
  fetchTrainings: async () => [{ topic: "Pitch", takes: [{ sessionId: "take-1", takeIndex: 1 }] }],
}));
const clip = (n: number) => ({ id: `m${n}`, transcript: `Words ${n}.`, audioRef: "/t.ogg", startOffsetMs: n * 1000, durationMs: 4000 });
vi.mock("@/services/api/sessionReadout", () => ({
  fetchSessionReadout: async () => ({ readout: { snippets: [1, 2, 3, 4, 5, 6].map(clip) } }),
}));
vi.mock("../../walk/WalkPlayer", () => ({ default: ({ seed }: { seed: string }) => <span data-player={seed} /> }));

import TrainingPanel from "./TrainingPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
let rows: PatternExample[];
let calls: { method: string; url: string; json: Record<string, unknown> | undefined }[];

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  rows = [];
  calls = [];
  vi.mocked(bffFetch).mockImplementation(async (path, options) => {
    const url = String(path);
    const method = options?.method ?? "GET";
    const json = options?.json as Record<string, unknown> | undefined;
    calls.push({ method, url, json });
    const snippet = url.split("/").pop() ?? "";
    if (method === "POST") rows.push({ ...(json as object), id: `x${rows.length}`, source: "take", session_id: "take-1",
      snippet_id: snippet, intervention: null } as PatternExample);
    if (method === "DELETE") rows = rows.filter((row) => row.id !== json?.example_id);
    const body = url.endsWith("/golden") ? { moment: { agree: 1, differ: 0, unknown: 0 }, intervention: { agree: 0, differ: 0, unknown: 0 }, corpus_labels: 0 }
      : method === "GET" ? { examples: rows, next_offset: null }
      : { examples: rows.filter((row) => row.snippet_id === snippet), cues: {} };
    return { kind: "response", ok: true, status: 200, body, headers: new Headers() };
  });
});

afterEach(() => { act(() => root.unmount()); host.remove(); vi.clearAllMocks(); });

async function settle() {
  for (let i = 0; i < 6; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
async function press(text: string, at = 0) {
  const button = [...host.querySelectorAll("button")].filter((b) => b.textContent?.trim() === text)[at];
  if (!button) throw Error("No button " + text);
  await act(async () => button.click());
  await settle();
}
const shown = () => [...host.querySelectorAll("[data-train-clip]")].map((n) => n.getAttribute("data-train-clip"));

it("one question per screen", async () => {
  await act(async () => root.render(<TrainingPanel />));
  await settle();
  expect(host.textContent).toContain("Which one needs feedback?");
  expect(shown()).toEqual(["m1", "m2", "m3"]);
  await press("This one", 1);
  expect(host.textContent).toContain("What should it get?");
  expect(host.textContent).not.toContain("Which one needs feedback?");
  expect(shown()).toEqual(["m2"]);
});

it("a tool saves the clip and its tool; None saves the three", async () => {
  await act(async () => root.render(<TrainingPanel />));
  await settle();
  await press("This one", 1);
  await press("Sniper");
  const saved = calls.filter((c) => c.method !== "GET");
  expect(saved[0]).toMatchObject({ method: "POST", json: { kind: "error", start_ms: 0, end_ms: 4000 } });
  expect(saved[0].url).toContain("/take/take-1/m2");
  expect(saved[1]).toMatchObject({ method: "PUT", json: { intervention: { tool: "sniper", status: "approved" } } });
  expect(shown()).toEqual(["m4", "m5", "m6"]);
  await press("None needs it");
  expect(rows.filter((row) => row.kind === "control").map((row) => row.snippet_id)).toEqual(["m4", "m5", "m6"]);
  expect(host.textContent).toContain("Every clip of your Takes has an answer.");
});

it("past answers can be undone", async () => {
  await act(async () => root.render(<TrainingPanel />));
  await settle();
  await press("This one", 0);
  await press("Nothing");
  expect(calls.some((c) => c.method === "PUT")).toBe(false);
  await press("Your past answers");
  expect(host.textContent).toContain("Needs feedback · Nothing");
  await press("Undo");
  expect(rows).toEqual([]);
  expect(host.querySelector("[data-past-row]")).toBeNull();
});

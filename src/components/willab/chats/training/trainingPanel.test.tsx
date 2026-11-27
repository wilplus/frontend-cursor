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
  O4  More than one fix can be picked; Sniper keeps its pace and pause
      places, Rephrase keeps the better words next to the app's suggestion
      (backend N705).
  O5  AI Audio: the founder records the line the right way, hears it back
      in their own voice copy, and Keep saves the words they said (N706).
  O6  Act it: the founder names a mistake in the tense state, records it,
      and once it is written out says what fixes it; each fix is saved on
      the acted clip under their name for it (N708).
PROVES   O1 -> "one question per screen"
         O2 -> "a tool saves the clip and its tool; None saves the three"
         O3 -> "past answers can be undone"
         O4 -> "several fixes, each shaped before it is kept"
         O5 -> "AI Audio is said the right way and heard back in your voice"
         O6 -> "an acted mistake is named, recorded and given its fixes"
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
    const body = url.endsWith("/rewrite") ? { words: "Words 2.", rewrite: "Better words." }
      : url.endsWith("/golden") ? { moment: { agree: 1, differ: 0, unknown: 0 }, intervention: { agree: 0, differ: 0, unknown: 0 }, corpus_labels: 0 }
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
  await press("Continue");
  expect(host.querySelector("[data-shape='sniper']")).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>("[data-pause-after='0']")!.click());
  await press("Keep");
  const saved = calls.filter((c) => c.method !== "GET");
  expect(saved[0]).toMatchObject({ method: "POST", json: { kind: "error", start_ms: 0, end_ms: 4000 } });
  expect(saved[0].url).toContain("/take/take-1/m2");
  expect(saved[1]).toMatchObject({ method: "PUT", json: { intervention: { tool: "sniper", status: "approved", marks: { speed: 1, pauses: [0] } } } });
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
  await press("Continue");
  expect(calls.some((c) => c.method === "PUT")).toBe(false);
  await press("Your past answers");
  expect(host.textContent).toContain("Needs feedback · Nothing");
  await press("Undo");
  expect(rows).toEqual([]);
  expect(host.querySelector("[data-past-row]")).toBeNull();
});

it("several fixes, each shaped before it is kept", async () => {
  await act(async () => root.render(<TrainingPanel />));
  await settle();
  await press("This one", 1);
  await press("Coach video");
  await press("Rephrase");
  await press("Continue");
  const puts = () => calls.filter((c) => c.method === "PUT").map((c) => c.json?.intervention as Record<string, unknown>);
  expect(puts().map((i) => i.tool)).toEqual(["coach_video"]);
  expect(host.querySelector("[data-shape='rewrite']")).not.toBeNull();
  expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("Better words.");
  await press("Accept");
  expect(puts()[1]).toMatchObject({ tool: "rewrite", text: "Better words.", suggested: "Better words." });
  expect(shown()).toEqual(["m4", "m5", "m6"]);
});

it("AI Audio is said the right way and heard back in your voice", async () => {
  const stop = vi.fn();
  class FakeRecorder {
    state = "inactive"; mimeType = "audio/webm";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["a"], { type: "audio/webm" }) }); this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) } });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:voice", revokeObjectURL: () => undefined }));
  const revoice = vi.fn(async () => new Response("mp3", { status: 200, headers: { "content-type": "audio/mpeg" } }));
  vi.stubGlobal("fetch", revoice);
  const listen = vi.mocked(bffFetch).getMockImplementation()!;
  const heard = { kind: "response", ok: true, status: 200, body: { text: "We start in March.", cues: { wpm: 128 } } };
  vi.mocked(bffFetch).mockImplementation(async (path, options) =>
    String(path).endsWith("/coach") ? heard as unknown as Awaited<ReturnType<typeof bffFetch>> : listen(path, options));
  await act(async () => root.render(<TrainingPanel />));
  await settle();
  await press("This one", 0);
  await press("AI Audio");
  await press("Continue");
  expect(host.querySelector("[data-shape='ai_audio']")).not.toBeNull();
  await press("Record it the right way");
  await press("Stop");
  expect(revoice).toHaveBeenCalledTimes(1);
  expect(host.querySelector("[data-ai-voice]")?.getAttribute("src")).toBe("blob:voice");
  expect(host.querySelector("[data-train-empty]")).toBeNull();
  await press("Keep");
  const put = calls.find((c) => c.method === "PUT")?.json?.intervention as Record<string, unknown>;
  expect(put).toMatchObject({ tool: "ai_audio", text: "We start in March.", values: { wpm: 128 } });
  vi.unstubAllGlobals();
});

it("an acted mistake is named, recorded and given its fixes", async () => {
  class FakeRecorder {
    state = "inactive"; mimeType = "audio/webm";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["a"], { type: "audio/webm" }) }); this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) } });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:mistake", revokeObjectURL: () => undefined }));
  let sent: FormData | null = null;
  const ready = { session_id: "acted-1", state: "tense", pattern: "Rushing", status: "ready",
    clips: [{ snippet_id: "a1", words: "We start in March.", duration_ms: 3000, start_offset_ms: 0, src: "https://audio" }] };
  const base = vi.mocked(bffFetch).getMockImplementation()!;
  vi.mocked(bffFetch).mockImplementation(async (path, options) => {
    if (String(path).endsWith("/acted")) {
      if (options?.method === "POST") {
        sent = options.body as FormData;
        return { kind: "response", ok: true, status: 202, body: { session_id: "acted-1" }, headers: new Headers() };
      }
      return { kind: "response", ok: true, status: 200, headers: new Headers(),
        body: { recordings: sent ? [ready] : [], names: ["Flat voice"] } };
    }
    return base(path, options);
  });
  await act(async () => root.render(<TrainingPanel />));
  await settle();
  await press("Act it");
  expect(host.textContent).toContain("Tense (high arousal, negative)");
  const own = host.querySelector<HTMLInputElement>("input[aria-label='Your own name']")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(own, "Rushing");
    own.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await press("Continue");
  await press("Record the mistake");
  await press("Stop");
  await press("Keep");
  expect(sent!.get("state")).toBe("tense");
  expect(sent!.get("pattern")).toBe("Rushing");
  await settle();
  expect(host.textContent).toContain("What fixes it?");
  expect(host.textContent).not.toContain("Nothing");
  await press("Rephrase");
  await press("Continue");
  await press("Accept");
  const saved = calls.filter((c) => c.method === "POST" || c.method === "PUT");
  expect(saved[0].url).toContain("/corpus/acted-1/a1");
  expect(saved[0].json).toMatchObject({ kind: "error", pattern: "Rushing", start_ms: 0, end_ms: 3000 });
  expect(saved[1].json).toMatchObject({ intervention: { tool: "rewrite", text: "Better words." } });
  expect(host.textContent).toContain("Saved.");
  vi.unstubAllGlobals();
});

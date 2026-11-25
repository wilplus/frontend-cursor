// @vitest-environment jsdom
/*
STORY    The founder marks a strong opening and a rushed ending in one corpus clip.
OUTCOME
  O1  Both labels and intervention matches stay on the original time ranges.
  O2  The library reopens the exact clip from either source.
PROVES   O1 -> "labels and matches a corpus clip"
         O2 -> "reopens an owned Take from the same library"
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SpeakingCalibration from "./SpeakingCalibration";
import { bffFetch } from "@/lib/api/bffFetch";
import type { PatternExample } from "./speakingPatterns";

vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: vi.fn() }));
vi.mock("@/services/api/trainings", () => ({
  fetchTrainings: async () => [{ topic: "My conversation", takes: [{ sessionId: "take-1", takeIndex: 1 }] }],
}));
vi.mock("@/services/api/sessionReadout", () => ({
  fetchSessionReadout: async () => ({ readout: { snippets: [
    { id: "moment-1", transcript: "One complete point.", audioRef: "/take.ogg", startOffsetMs: 1000, durationMs: 5000 },
  ] } }),
}));
vi.mock("@/services/api/trainingCorpus", () => ({
  fetchTrainingImportsPage: async () => ({ imports: [
    { sessionId: "import-1", topic: "Synthetic training recording", state: "done", setupComplete: true },
  ], nextOffset: null }),
  fetchConfidenceQueueResult: async () => ({ ok: true, queue: { queue: [{ snippetId: "clip-1" }] } }),
}));
vi.mock("@/hooks/useCorpusClip", () => ({
  useCorpusClip: () => ({ clip: { src: "/synthetic.ogg", startOffsetMs: 3000, durationMs: 5000 }, error: null }),
}));
vi.mock("../../walk/WalkPlayer", () => ({
  default: ({ seed, startOffsetMs, durationMs }: { seed: string; startOffsetMs: number; durationMs: number }) =>
    <span data-play-window={`${seed}/${startOffsetMs}/${durationMs}`} />,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let rows: PatternExample[];

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  rows = [];
  vi.mocked(bffFetch).mockImplementation(async (path, options) => {
    const url = String(path);
    const source = url.includes("/corpus/") ? "corpus" : "take";
    const json = options?.json as Partial<PatternExample> & { example_id?: string } | undefined;
    const example = rows.find(row => row.id === json?.example_id);
    if (options?.method === "POST") rows.push({
      ...json, source, session_id: "import-1", snippet_id: "clip-1", id: String(rows.length), intervention: null,
    } as PatternExample);
    if (options?.method === "PUT" && example) example.intervention = json?.intervention ?? null;
    if (url.includes("speaking-patterns")) {
      return { kind: "response", ok: true, status: 200, body: {
        examples: rows, next_offset: null, cues: rows.length ? { wpm: 180 } : {},
      }, headers: new Headers() };
    }
    return { kind: "response", ok: true, status: 200, body: { record: null, revision: 0, cues: {} }, headers: new Headers() };
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

async function open() {
  await act(async () => root.render(<SpeakingCalibration />));
}
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(node => node.textContent?.trim() === text);
  if (!button) throw Error("Couldn’t find " + text);
  await act(async () => button.click());
}

async function edit(label: string, value: string) {
  const field = [...container.querySelectorAll("label")].find(node => node.firstChild?.textContent?.trim() === label)
    ?.querySelector("select, input");
  if (!field) throw Error("Couldn’t find " + label);
  const nativeValue = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")?.set;
  await act(async () => {
    nativeValue?.call(field, value);
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

it("labels and matches a corpus clip", async () => {
  await open();
  await click("Training Corpus");
  await edit("Corpus recording", "import-1");
  await click("Listen to clip 1");
  expect(container.querySelector('[data-play-window="clip-1/3000/5000"]')).toBeTruthy();
  expect(container.textContent).not.toContain("Vocal cues");
  expect(container.textContent).not.toContain("Assign intervention pattern");

  await edit("Pattern", "Rushed ending");
  await edit("Start (seconds into clip)", "3.5");
  await click("Save listening label");
  expect(container.textContent).toContain("0:06.500–0:08.000");
  expect(container.textContent).toContain("180.00");
  await click("Assign intervention pattern");
  expect(container.textContent).toContain("Error intervention pattern");
  await edit("Pause in milliseconds", "500");
  await click("Save intervention pattern");

  await edit("Label type", "praise");
  await edit("Pattern", "Clear, concise point");
  await edit("End (seconds into clip)", "3.5");
  await click("Save listening label");
  await click("Assign intervention pattern");
  expect(container.textContent).toContain("Praise intervention pattern");
  await click("Save intervention pattern");
  expect(rows.map(row => [row.kind, row.start_ms, row.end_ms, row.intervention?.tool])).toEqual([
    ["error", 3500, 5000, "sniper"], ["praise", 0, 3500, "name_strength"],
  ]);

  expect(rows[0].intervention?.values).toEqual({ pause_ms: 500 });
  await click("Pattern Library");
  await click("Open example");
  expect(container.querySelector('[data-play-window="clip-1/3000/5000"]')).toBeTruthy();
  expect(container.textContent).toContain("Clear, concise point");
  expect(container.textContent).toContain("Rushed ending");
  expect(container.textContent).not.toContain("Record a retry");
});

it("reopens an owned Take from the same library", async () => {
  rows.push({
    id: "earlier", source: "take", session_id: "take-1", snippet_id: "moment-1", kind: "control",
    pattern: "Pace OK", start_ms: 0, end_ms: 5000, note: "", intervention: null,
  });
  await open();
  await click("Pattern Library");
  await click("Open example");
  expect(container.querySelector('[data-play-window="moment-1/1000/5000"]')).toBeTruthy();
  expect(container.textContent).toContain("Pace OK");
  await click("Calibration chat and retry");
  expect(container.textContent).toContain("What did you hear?");
  expect(container.querySelectorAll("[data-chat-composer]")).toHaveLength(1);
});

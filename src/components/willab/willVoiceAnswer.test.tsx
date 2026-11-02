// @vitest-environment jsdom
/*
 * STORY    As a speaker in the Lounge after a Take, I want to see that Will
 *          is waiting for my answer and to answer him by voice, so that I
 *          say it the way I would say it in my talk, in a second.
 * OUTCOME
 *   O1  While Will's question waits, the bar keeps "+", "Type here" and the
 *       mic, and the same mic fills orange, for every speaker (backend
 *       N296 state 2, N306 item 1); with no question waiting the mic is as
 *       before: there only with the voice notebook, not orange.
 *   O2  Tapping it records with the one bar (the trash, the strip with
 *       Stop inside); Stop sends the recording as the answer to that
 *       question, it shows at once as my voice bubble, and once Will has
 *       heard it, my bubble carries the words (N294 items 2 and 3, N319
 *       item 1).
 *   O3  After I answer, the chat lands on the newest bubble even when I had
 *       scrolled up (N319 item 9).
 * PROVES   O1 -> "the mic fills orange while Will waits, and only then"
 *          O2 -> "a voice answer answers Will's question and lands as my
 *                 voice bubble with the words"
 *          O3 -> "after an answer the chat lands on the newest bubble"
 * WHY      Founder 2026-10-31 (N296): "the mic fills orange (colour only)";
 *          N294: "The key line is recorded"; 2026-11-01 (N319): "after the
 *          speaker answers, the chat moves to the new bubble".
 */
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const bffFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch }));
vi.mock("@/services/api/voiceNotebook", () => ({ hearPiece: vi.fn(async () => null) }));

import { VoiceNoteMic, type VoiceNotebook } from "./useVoiceNotebook";
import { useWillVoice, WillVoiceBubble } from "./WillVoiceAnswer";
import { followNewest, usePinThreadBottom } from "./usePinThreadBottom";

class FakeRecorder {
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  static isTypeSupported = () => true;
  start() {
    this.state = "recording";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => this.onstop?.());
  }
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:answer"), revokeObjectURL: vi.fn() }));
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    configurable: true,
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function flush() {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
}

const ASKED = {
  offer: "will_question",
  will_question: "key_line",
  will_question_step: "ask",
  chips: [],
  arc_id: "arc-1",
  take_session_id: "take-1",
};
/** A speaker without the voice notebook. */
const NO_NOTEBOOK = { enabled: false, held: false, tapMic: vi.fn() } as unknown as VoiceNotebook;

function Bar({ shown, reload, onAnswered }: { shown: { metadata: Record<string, unknown> }[]; reload: () => Promise<void>; onAnswered: () => void }) {
  const will = useWillVoice({ shown, reload, onAnswered });
  return createElement(
    "div",
    null,
    will.pending,
    will.bar,
    createElement("form", { className: will.composerDisplay("flex"), "data-composer": "" },
      createElement(VoiceNoteMic, { notebook: NO_NOTEBOOK, draft: "", waiting: will.waiting })),
  );
}

it("the mic fills orange while Will waits, and only then", async () => {
  const reload = vi.fn(async () => undefined);
  act(() => root.render(createElement(Bar, { shown: [{ metadata: ASKED }], reload, onAnswered: vi.fn() })));
  const mic = host.querySelector('[data-testid="voice-note-mic"]') as HTMLButtonElement;
  expect(mic).not.toBeNull();
  expect(mic.hasAttribute("data-will-waits")).toBe(true);
  expect(mic.className).toContain("bg-primary");
  expect(mic.className).toContain("h-10 w-10"); // the same mic, its size and shape

  // Answered (Will thanked them): no question waits; without the notebook, no mic.
  act(() => root.render(createElement(Bar, {
    shown: [{ metadata: ASKED }, { metadata: { will_question: "key_line", will_question_step: "thanks" } }],
    reload, onAnswered: vi.fn(),
  })));
  expect(host.querySelector('[data-testid="voice-note-mic"]')).toBeNull();
  // With the notebook, the mic is as it always was: not orange.
  const notebook = { enabled: true, held: false, tapMic: vi.fn() } as unknown as VoiceNotebook;
  act(() => root.render(createElement(VoiceNoteMic, { notebook, draft: "" })));
  const plain = host.querySelector('[data-testid="voice-note-mic"]') as HTMLButtonElement;
  expect(plain.hasAttribute("data-will-waits")).toBe(false);
  expect(plain.className).not.toContain("bg-primary");
});

it("a voice answer answers Will's question and lands as my voice bubble with the words", async () => {
  const said = "We match every transaction the moment it lands.";
  bffFetch.mockResolvedValue({
    kind: "response", ok: true,
    body: { messages: [{ client_id: "said-1", role: "user", body: said, metadata: { will_voice: true, duration_ms: 3200 } }] },
  });
  const reload = vi.fn(async () => undefined);
  const onAnswered = vi.fn();
  act(() => root.render(createElement(Bar, { shown: [{ metadata: ASKED }], reload, onAnswered })));
  await act(async () => (host.querySelector('[data-testid="voice-note-mic"]') as HTMLButtonElement).click());
  await flush();
  // Recording: the one bar in the message box's place.
  expect(host.querySelector("[data-recording-bar] [data-walk-recording-strip]")).not.toBeNull();
  expect(host.querySelector("[data-composer]")!.className).toBe("hidden");
  await act(async () => (host.querySelector('[data-recording-bar] button[aria-label="Stop"]') as HTMLButtonElement).click());
  await flush();

  const [url, init] = bffFetch.mock.calls[0]!;
  expect(url).toBe("/api/v2/explore/arc/arc-1/will-question/voice");
  const form = (init as { body: FormData }).body;
  expect(form.get("take_session_id")).toBe("take-1");
  expect(form.get("audio")).toBeInstanceOf(Blob);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(onAnswered).toHaveBeenCalled(); // the chat follows (N319 item 9)

  act(() => root.render(createElement(WillVoiceBubble, {
    message: { client_id: "said-1", body: said, metadata: { will_voice: true, duration_ms: 3200 } },
  })));
  const bubble = host.querySelector("[data-will-voice]")!;
  expect(bubble.getAttribute("data-row")).toBe("me");
  expect(bubble.textContent).toContain(said);
  expect(bubble.querySelector("audio, button")).not.toBeNull(); // it plays back in this sitting
});

it("after an answer the chat lands on the newest bubble", () => {
  let thread: HTMLDivElement | null = null;
  function Thread() {
    const ref = useRef<HTMLDivElement | null>(null);
    const opened = useRef(true);
    usePinThreadBottom(ref, 3, false, opened);
    return createElement("div", { ref: (el: HTMLDivElement | null) => { ref.current = el; thread = el; } });
  }
  act(() => root.render(createElement(Thread)));
  Object.defineProperty(thread!, "scrollHeight", { value: 2000, configurable: true });
  thread!.scrollTop = 120; // scrolled up to read
  act(() => followNewest());
  expect(thread!.scrollTop).toBe(2000);
});

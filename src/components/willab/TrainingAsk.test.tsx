// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  FOUNDER 2026-10-03 — "Turn on the learning?" before a Take.               */
/*                                                                            */
/*  Pinned here:                                                              */
/*    1. the switch closed, already on, or unreadable passes straight through */
/*       and renders nothing;                                                 */
/*    2. off and open shows the founder's question, the four signed lines,    */
/*       the backend's sentence, Yes as the CTA and Skip stacked below;       */
/*    3. Yes sends the yes against exactly what was shown, then passes;       */
/*    4. Skip sends nothing and passes;                                       */
/*    5. a failed save says so and does not pass.                             */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchTrainingConsent: vi.fn(),
  setTrainingConsent: vi.fn(),
}));

let authToken: string | null = "session-token";
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => Promise.resolve(authToken),
}));

vi.mock("@/services/api/trainingConsent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/trainingConsent")>();
  return { ...actual, ...api };
});

import TrainingAsk, {
  TRAINING_ASK_COPY,
  TrainingAskGate,
  prefetchTrainingAsk,
  resetTrainingAsk,
} from "./TrainingAsk";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import type { TrainingConsent } from "@/services/api/trainingConsent";

const SENTENCE =
  "Keep separate copies of short moments from my recordings (the audio, its words and my coach's rating) to train WillpowerLab. I can turn this off at any time, and my copies are then deleted.";

function state(over: Partial<TrainingConsent> = {}): TrainingConsent {
  return {
    available: true,
    active: false,
    policyVersion: "training-v1",
    copy: SENTENCE,
    copySha256: "c".repeat(64),
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;
let done: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  done = vi.fn<() => void>();
  authToken = "session-token";
  resetTrainingAsk();
  api.fetchTrainingConsent.mockReset();
  api.setTrainingConsent.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
});
const button = (label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((b) => b.textContent === label);

async function renderWith(value: TrainingConsent | null) {
  api.fetchTrainingConsent.mockResolvedValue(value);
  act(() => root.render(createElement(TrainingAsk, { onDone: done })));
  await flush();
}

describe("passes straight through", () => {
  it("when the backend keeps the switch closed", async () => {
    await renderWith(null);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("when there is no training policy", async () => {
    await renderWith(state({ available: false }));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("when the learning is already on", async () => {
    await renderWith(state({ active: true }));
    expect(done).toHaveBeenCalledTimes(1);
    expect(container.querySelector("h2")).toBeNull();
  });
});

describe("while the learning is off", () => {
  it("asks the founder's question over the signed lines and the sentence", async () => {
    await renderWith(state());
    expect(done).not.toHaveBeenCalled();
    expect(container.querySelector("h2")?.textContent).toBe("Turn on the learning?");
    const lines = Array.from(container.querySelectorAll("li")).map((li) => li.textContent);
    expect(lines).toEqual([...COPY.trainingBeforeLines]);
    expect(container.textContent).toContain(SENTENCE);
    const html = container.innerHTML;
    expect(html.indexOf(SENTENCE)).toBeLessThan(html.indexOf(">Yes<"));
    expect(html.indexOf(">Yes<")).toBeLessThan(html.indexOf(">Skip<"));
    expect(TRAINING_ASK_COPY).toMatchObject({ yes: "Yes", skip: "Skip" });
  });

  it("Yes sends the yes against exactly what was shown, then passes", async () => {
    await renderWith(state());
    api.setTrainingConsent.mockResolvedValue(state({ active: true }));
    await act(async () => button("Yes")?.click());
    await flush();
    expect(api.setTrainingConsent).toHaveBeenCalledWith(true, state());
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("Skip sends nothing and passes", async () => {
    await renderWith(state());
    await act(async () => button("Skip")?.click());
    expect(api.setTrainingConsent).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("a failed save says so and does not pass", async () => {
    await renderWith(state());
    api.setTrainingConsent.mockResolvedValue(null);
    await act(async () => button("Yes")?.click());
    await flush();
    expect(container.querySelector("[role=alert]")?.textContent).toBe(COPY.failed);
    expect(done).not.toHaveBeenCalled();
    expect(button("Yes")).toBeTruthy();
  });
});

describe("the gate over the pre-recording screens", () => {
  it("shows the question first and the screen once answered", async () => {
    api.fetchTrainingConsent.mockResolvedValue(state());
    const screen = createElement("p", { id: "screen" }, "Start recording");
    act(() => root.render(createElement(TrainingAskGate, { asked: false, onDone: done }, screen)));
    await flush();
    expect(container.querySelector("#screen")).toBeNull();
    expect(container.querySelector("h2")?.textContent).toBe("Turn on the learning?");

    act(() => root.render(createElement(TrainingAskGate, { asked: true, onDone: done }, screen)));
    await flush();
    expect(container.querySelector("#screen")?.textContent).toBe("Start recording");
    expect(container.querySelector("h2")).toBeNull();
  });
});

describe("never a blank screen (founder 2026-10-04)", () => {
  it("a guest is never asked and never waits: no read at all", async () => {
    authToken = null;
    await renderWith(state());
    expect(api.fetchTrainingConsent).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("while the read is in flight the loading state shows, not an empty screen", async () => {
    api.fetchTrainingConsent.mockReturnValue(new Promise(() => undefined));
    act(() => root.render(createElement(TrainingAsk, { onDone: done })));
    await flush();
    expect(container.innerHTML).not.toBe("");
    expect(container.querySelector("h2")).toBeNull();
  });

  it("read as the Lab opens, the question is there on the first frame", async () => {
    api.fetchTrainingConsent.mockResolvedValue(state());
    prefetchTrainingAsk();
    await flush();
    act(() => root.render(createElement(TrainingAsk, { onDone: done })));
    expect(container.querySelector("h2")?.textContent).toBe("Turn on the learning?");
    expect(api.fetchTrainingConsent).toHaveBeenCalledTimes(1);
  });
});


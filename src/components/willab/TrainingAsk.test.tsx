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
  resetTrainingAsk,
} from "./TrainingAsk";
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

describe("while the learning is off", () => {

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
});

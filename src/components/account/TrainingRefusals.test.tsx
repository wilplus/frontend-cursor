// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TrainingConsentCard from "@/components/account/TrainingConsentCard";
import TrainingAsk, { resetTrainingAsk } from "@/components/willab/TrainingAsk";
import type { TrainingConsent } from "@/services/api/trainingConsent";

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

const FAILED = "Couldn’t save that. Try again.";

function state(over: Partial<TrainingConsent> = {}): TrainingConsent {
  return {
    available: true,
    active: false,
    policyVersion: "training-v1",
    copy: "The approved sentence.",
    copySha256: "c".repeat(64),
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  authToken = "session-token";
  resetTrainingAsk();
  api.fetchTrainingConsent.mockReset();
  api.setTrainingConsent.mockReset();
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  error.mockRestore();
});

const flush = () => act(async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
});

const button = (label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((b) => b.textContent === label);

describe("training refusals stay off the screen", () => {
  it.each(["REACCEPT_REQUIRED", "TRAINING_COPY_CHANGED", "TRAINING_NOT_AVAILABLE", "HTTP_500"])(
    "card and ask show only the alert for %s",
    async (code) => {
      api.fetchTrainingConsent.mockResolvedValue(state());
      api.setTrainingConsent.mockResolvedValue({ ok: false, code });
      act(() => root.render(createElement(TrainingConsentCard)));
      await flush();
      const turnOn = button("Turn on");
      expect(turnOn).toBeTruthy();
      await act(async () => {
        turnOn?.click();
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
      });
      expect(container.querySelector("[role='alert']")?.textContent).toBe(FAILED);
      expect(container.textContent).not.toContain(code);
      expect(container.querySelector("[role='switch']")?.getAttribute("aria-checked")).toBe("false");
      expect(error).toHaveBeenCalledWith("[training-consent] save refused", { code, where: "card" });

      act(() => root.unmount());
      container.replaceChildren();
      root = createRoot(container);
      resetTrainingAsk();
      error.mockClear();
      api.fetchTrainingConsent.mockResolvedValue(state());
      api.setTrainingConsent.mockResolvedValue({ ok: false, code });
      const done = vi.fn<() => void>();
      act(() => root.render(createElement(TrainingAsk, { onDone: done })));
      await flush();
      const yes = button("Yes");
      expect(yes).toBeTruthy();
      await act(async () => {
        yes?.click();
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
      });
      expect(container.querySelector("[role='alert']")?.textContent).toBe(FAILED);
      expect(done).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain(code);
      expect(error).toHaveBeenCalledWith("[training-consent] save refused", { code, where: "ask" });
    },
  );
});

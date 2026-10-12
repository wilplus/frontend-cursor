import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setTrainingConsent,
  type TrainingConsent,
} from "@/services/api/trainingConsent";

const shown: TrainingConsent = {
  available: true,
  active: false,
  policyVersion: "training-v1",
  copy: "The approved sentence.",
  copySha256: "c".repeat(64),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("setTrainingConsent refusals", () => {

  it("maps a thrown fetch to NETWORK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    await expect(setTrainingConsent(true, shown)).resolves.toEqual({
      ok: false,
      code: "NETWORK",
    });
  });
});

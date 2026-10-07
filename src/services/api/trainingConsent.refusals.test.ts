import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setTrainingConsent,
  trainingRefusalCode,
  type TrainingConsent,
  type TrainingConsentRefusal,
} from "@/services/api/trainingConsent";

const shown: TrainingConsent = {
  available: true,
  active: false,
  policyVersion: "training-v1",
  copy: "The approved sentence.",
  copySha256: "c".repeat(64),
};

function stubJson(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("setTrainingConsent refusals", () => {
  it.each(["REACCEPT_REQUIRED", "TRAINING_COPY_CHANGED", "TRAINING_NOT_AVAILABLE"])(
    "keeps a 409 %s",
    async (code) => {
      stubJson(409, { code });
      await expect(setTrainingConsent(true, shown)).resolves.toEqual({ ok: false, code });
    },
  );

  it("maps a non-JSON 502 to HTTP_502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad gateway", { status: 502 })),
    );
    await expect(setTrainingConsent(true, shown)).resolves.toEqual({
      ok: false,
      code: "HTTP_502",
    });
  });

  it("rejects a code that is not a token", async () => {
    stubJson(409, { code: "drop table" });
    await expect(setTrainingConsent(false, shown)).resolves.toEqual({
      ok: false,
      code: "HTTP_409",
    });
  });

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

  it("maps a 200 body the mapper rejects to BAD_RESPONSE", async () => {
    stubJson(200, {});
    await expect(setTrainingConsent(true, shown)).resolves.toEqual({
      ok: false,
      code: "BAD_RESPONSE",
    });
  });

  it("returns the mapped state on a 200 the mapper accepts", async () => {
    stubJson(200, {
      available: true,
      active: true,
      policy_version: "training-v1",
      copy: "The approved sentence.",
      copy_sha256: "a".repeat(64),
    });
    await expect(setTrainingConsent(true, shown)).resolves.toEqual({
      available: true,
      active: true,
      policyVersion: "training-v1",
      copy: "The approved sentence.",
      copySha256: "a".repeat(64),
    });
  });
});

describe("trainingRefusalCode", () => {
  it("is null for a saved state, the code for a refusal, and NO_STATE for null", () => {
    const saved: TrainingConsent = { ...shown, active: true };
    const refusal: TrainingConsentRefusal = { ok: false, code: "REACCEPT_REQUIRED" };
    expect(trainingRefusalCode(saved)).toBeNull();
    expect(trainingRefusalCode(refusal)).toBe("REACCEPT_REQUIRED");
    expect(trainingRefusalCode(null)).toBe("NO_STATE");
    expect(trainingRefusalCode(undefined)).toBe("NO_STATE");
  });
});

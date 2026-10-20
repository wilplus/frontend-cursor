/*
STORY    As a speaker, I want a training-consent change that fails to say why,
         so that my screen never shows a choice that did not save (consent).
OUTCOME
  O1  Offline: the save is refused with NETWORK.
  O2  A server refusal comes back with the server's own code (e.g. a stale
      copy of the sentence), never as a saved state.
  O3  A refusal without a readable code becomes HTTP_<status>.
  O4  A saved change returns the state now in force.
PROVES   O1 -> "maps a thrown fetch to NETWORK"
         O2 -> "passes the server's refusal code through"
         O3 -> "falls back to HTTP_<status> when the refusal has no code"
         O4 -> "returns the state now in force when the save went through"
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setTrainingConsent,
  type TrainingConsent,
} from "@/services/api/trainingConsent";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

const shown: TrainingConsent = {
  available: true,
  active: false,
  policyVersion: "training-v1",
  copy: "The approved sentence.",
  copySha256: "c".repeat(64),
};

function reply(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

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

  it("passes the server's refusal code through", async () => {
    reply(409, { code: "TRAINING_COPY_CHANGED" });
    await expect(setTrainingConsent(true, shown)).resolves.toEqual({
      ok: false,
      code: "TRAINING_COPY_CHANGED",
    });
  });

  it("falls back to HTTP_<status> when the refusal has no code", async () => {
    reply(500, { code: "not a code" });
    await expect(setTrainingConsent(false, shown)).resolves.toEqual({
      ok: false,
      code: "HTTP_500",
    });
  });

  it("returns the state now in force when the save went through", async () => {
    const fetchMock = reply(200, {
      available: true,
      active: true,
      policy_version: "training-v1",
      copy: "The approved sentence.",
      copy_sha256: "c".repeat(64),
    });
    await expect(setTrainingConsent(true, shown)).resolves.toEqual({
      ...shown,
      active: true,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v2/user/training-consent");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      accepted: true,
      policy_version: "training-v1",
      copy_sha256: "c".repeat(64),
    });
  });
});

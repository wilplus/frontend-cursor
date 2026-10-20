// @vitest-environment jsdom
/*
STORY    As a visitor who said yes to training before signing in, I want that yes sent once after sign-in and only for the words I saw, so that my consent is honest.
OUTCOME
  O1  The yes is sent once after sign-in, with the words I saw.
  O2  If the words have changed since, it is dropped and never sent.
  O3  If my account cannot take it yet, it is kept for later.
PROVES   O1 -> is sent once after sign-in, for the words they saw
         O2 -> is never sent once the words in force changed
         O3 -> is kept for later when the account has not accepted the policy yet
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({ read: vi.fn(), set: vi.fn() }));
vi.mock("@/services/api/trainingConsent", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTrainingConsent: io.read,
  setTrainingConsent: io.set,
}));

import { keepPendingTrainingYes, sendPendingTrainingYes } from "./pendingTrainingYes";

const SHOWN = {
  available: true, active: false, policyVersion: "training-only-v4",
  copy: "We'd train our feedback on your practice.", copySha256: "e".repeat(64),
};

describe("a visitor's kept training yes", () => {
  beforeEach(() => {
    window.localStorage.clear();
    io.read.mockReset();
    io.set.mockReset();
  });

  it("is sent once after sign-in, for the words they saw", async () => {
    keepPendingTrainingYes(SHOWN);
    io.read.mockResolvedValue(SHOWN);
    io.set.mockResolvedValue({ ...SHOWN, active: true });
    await sendPendingTrainingYes();
    await sendPendingTrainingYes();
    expect(io.set).toHaveBeenCalledTimes(1);
    expect(io.set).toHaveBeenCalledWith(true, SHOWN);
  });

  it("is never sent once the words in force changed", async () => {
    keepPendingTrainingYes(SHOWN);
    io.read.mockResolvedValue({ ...SHOWN, policyVersion: "training-only-v5", copySha256: "f".repeat(64) });
    await sendPendingTrainingYes();
    expect(io.set).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("willab.pendingTrainingYes")).toBeNull();
  });

  it("is kept for later when the account has not accepted the policy yet", async () => {
    keepPendingTrainingYes(SHOWN);
    io.read.mockResolvedValue(SHOWN);
    io.set.mockResolvedValue({ ok: false, code: "TRAINING_CONSENT_NEEDS_POLICY_RECEIPT" });
    await sendPendingTrainingYes();
    expect(window.localStorage.getItem("willab.pendingTrainingYes")).not.toBeNull();
  });
});

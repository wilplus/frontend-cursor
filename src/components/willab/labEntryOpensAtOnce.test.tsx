// @vitest-environment jsdom
/*
STORY    As a speaker, I want "How do you feel?" on screen the moment I tap
         "Record Take N", so that the next Take never makes me wait on a
         screen I already passed (founder 2026-11-09, backend N549).
OUTCOME
  O1  Once this tab has read "authorized", the Lab's first screen draws on
      the first render, while the Lab's own read is still out.
  O2  The door still holds: until that read answers the entry is not
      fresh (nothing starts a Take), and a read that says the terms changed
      puts the acceptance flow in front of the screen.
PROVES   O1 -> "draws the first screen at once after an earlier authorized read"
         O2 -> "the fresh read still decides, and can put the acceptance flow in front"
WHY      The Lab used to wait for a network read behind a loader before
         every later Take's first screen.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => Promise.resolve("session-token"),
}));
vi.mock("./Phase1AcceptanceFlow", () => ({
  default: () => createElement("p", null, "acceptance flow"),
}));

import { fetchAuthorization } from "@/services/api/processingAuthorization";
import { LabEntryGate, useLabEntry, type LabEntry } from "./LabEntryGate";

function row(authorized: boolean) {
  return {
    authorized,
    code: authorized ? "PROCESSING_AUTHORIZED" : "PROCESSING_AUTHORIZATION_REQUIRED",
    policy_available: true,
    policy_id: "policy-uuid",
    policy_version: "phase1-2026.1",
    terms_version: "2.0",
    terms_copy: "Terms text",
    terms_copy_sha256: "a".repeat(64),
    privacy_version: "2.0",
    privacy_copy: "Privacy text",
    privacy_copy_sha256: "b".repeat(64),
    ai_notice_version: "1.0",
    ai_notice_copy: "AI notice text",
    ai_notice_copy_sha256: "c".repeat(64),
    agreement_copy: "I agree and continue",
    agreement_copy_sha256: "d".repeat(64),
    minimum_age: 18,
    allowed_countries: ["pl"],
    ai_notice_rendered: true,
  };
}

/** Each read waits until the test answers it. */
let answers: Array<(body: unknown) => void>;
let root: Root;
let host: HTMLDivElement;
let seen: LabEntry | null;

function Lab() {
  const entry = useLabEntry();
  seen = entry;
  return createElement(LabEntryGate, { entry }, createElement("p", null, "How do you feel?"));
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  answers = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          answers.push((body) => resolve({ ok: true, status: 200, json: async () => body } as unknown as Response));
        }),
    ),
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
  seen = null;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function readOnceAuthorized() {
  const read = fetchAuthorization();
  await flush();
  answers.shift()!(row(true));
  expect((await read).kind).toBe("authorized");
}

describe("the Lab opens a later Take's first screen at once", () => {
  it("draws the first screen at once after an earlier authorized read", async () => {
    await readOnceAuthorized();
    act(() => root.render(createElement(Lab)));
    expect(host.textContent).toContain("How do you feel?");
    expect(seen?.fresh).toBe(false);
    await flush();
    answers.shift()!(row(true));
    await flush();
    expect(seen?.fresh).toBe(true);
    expect(host.textContent).toContain("How do you feel?");
  });

  it("the fresh read still decides, and can put the acceptance flow in front", async () => {
    await readOnceAuthorized();
    act(() => root.render(createElement(Lab)));
    expect(host.textContent).toContain("How do you feel?");
    await flush();
    answers.shift()!(row(false));
    await flush();
    expect(seen?.fresh).toBe(true);
    expect(host.textContent).toContain("acceptance flow");
    expect(host.textContent).not.toContain("How do you feel?");
  });
});

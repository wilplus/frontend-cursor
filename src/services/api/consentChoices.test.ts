/*
STORY    As a speaker who withdrew sensitive-information or personalised-
         practice consent, I want Practise hidden from my sheets, so that
         nothing new is recorded against my choice (consent).
OUTCOME
  O1  Both choices in force: Practise is offered.
  O2  Sensitive information withdrawn, personalised practice still on:
      Practise is withheld (B6-3).
  O3  Personalised practice off: Practise is withheld.
  O4  No agreement yet, or a failed read: the server decides (offered).
PROVES   O1 -> "offers Practise while both choices are in force"
         O2 -> "withholds Practise when sensitive information is withdrawn (B6-3)"
         O3 -> "withholds Practise when Personalised practice is off"
         O4 -> "leaves the server to decide when there is no agreement yet"
         O4 -> "leaves the server to decide when the read fails"
WHY      B6-3: a practice attempt is new recording, and withdrawing sensitive
         information stops new recording.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetPractiseOffered,
  readPractiseOffered,
} from "./consentChoices";

function answer(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response),
  );
}

beforeEach(() => forgetPractiseOffered());
afterEach(() => {
  vi.unstubAllGlobals();
  forgetPractiseOffered();
});

describe("readPractiseOffered (B6-3)", () => {
  it("offers Practise while both choices are in force", async () => {
    answer({ has_receipt: true, personalised_practice: true, sensitive_information: true });
    expect(await readPractiseOffered()).toBe(true);
  });

  it("withholds Practise when sensitive information is withdrawn (B6-3)", async () => {
    answer({ has_receipt: true, personalised_practice: true, sensitive_information: false });
    expect(await readPractiseOffered()).toBe(false);
  });

  it("withholds Practise when Personalised practice is off", async () => {
    answer({ has_receipt: true, personalised_practice: false, sensitive_information: true });
    expect(await readPractiseOffered()).toBe(false);
  });

  it("leaves the server to decide when there is no agreement yet", async () => {
    answer({ has_receipt: false, personalised_practice: false, sensitive_information: false });
    expect(await readPractiseOffered()).toBe(true);
  });

  it("leaves the server to decide when the read fails", async () => {
    answer(null, false);
    expect(await readPractiseOffered()).toBe(true);
  });
});

/* B6-3: Practise is offered only while both choices the practice attempt
   route requires are in force. Withdrawing sensitive information stops new
   recording, and a practice attempt is new recording, so the sheets drop
   Practise just as they do when Personalised practice is off. Unknown (no
   agreement yet, a failed read) still leaves the server to decide. */
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

  it("withholds Practise when Personalised practice is off", async () => {
    answer({ has_receipt: true, personalised_practice: false, sensitive_information: true });
    expect(await readPractiseOffered()).toBe(false);
  });

  it("leaves the server to decide when there is no agreement yet", async () => {
    answer({ has_receipt: false, personalised_practice: false, sensitive_information: false });
    expect(await readPractiseOffered()).toBe(true);
  });
});

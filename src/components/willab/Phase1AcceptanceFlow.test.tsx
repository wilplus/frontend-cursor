// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  CHOOSING A COUNTRY CARRIES YOU FORWARD. TICKING A CONSENT DOES NOT.        */
/*  (founder 2026-09-23: auto-transition after selecting the country, like     */
/*  Typeform)                                                                  */
/*                                                                            */
/*  Both halves are the test. The country is a fact about the user that        */
/*  decides which law applies, and asking for a second tap to confirm a tap    */
/*  buys nothing — so it advances on its own.                                  */
/*                                                                            */
/*  The two attestations on `confirm` are the AGREEMENT. Auto-advancing off a  */
/*  tick box is exactly how a mis-tap becomes a recorded receipt, and a        */
/*  receipt naming bytes the user never meant to accept is worse than no       */
/*  receipt, because it looks like evidence. If somebody later generalises     */
/*  the auto-advance "for consistency", the second test here is what stops     */
/*  them.                                                                      */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api/processingAuthorization", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recordAiNoticeRendered: vi.fn(async () => undefined),
  acceptAuthorization: vi.fn(async () => ({ kind: "accepted" as const })),
}));

import Phase1AcceptanceFlow from "./Phase1AcceptanceFlow";
import {
  acceptAuthorization,
  type ProcessingPolicy,
} from "@/services/api/processingAuthorization";

const POLICY: ProcessingPolicy = {
  policyId: "policy-uuid",
  policyVersion: "phase1-test",
  terms: { version: "2.0", copy: "TERMS BYTES", sha256: "a".repeat(64) },
  privacy: { version: "2.0", copy: "PRIVACY BYTES", sha256: "b".repeat(64) },
  aiNotice: { version: "1.0", copy: "NOTICE BYTES", sha256: "c".repeat(64) },
  agreementCopy: "I agree and continue",
  agreementCopySha256: "d".repeat(64),
  allowedCountries: ["pl", "de"],
  minimumAge: 18,
  aiNoticeRendered: true,
};

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function buttonSaying(text: string): HTMLButtonElement {
  const match = [...host.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").trim().startsWith(text),
  );
  if (!match) throw new Error(`no button starting "${text}" in: ${host.textContent}`);
  return match as HTMLButtonElement;
}

const click = async (text: string) =>
  act(async () => {
    buttonSaying(text).click();
  });

/** notice -> terms -> privacy -> ai -> country, the way a first-timer walks.
 *  `priorCountry` is what a re-accepting person gave last time (Q21 A). */
async function walkToCountry(priorCountry?: string | null) {
  await act(async () => {
    root.render(
      createElement(Phase1AcceptanceFlow, {
        policy: POLICY,
        priorCountry,
        onAccepted: () => {},
        onStale: () => {},
      }),
    );
  });
  await click("Continue");        // notice -> terms
  await click("Done reading");    // terms  -> privacy
  await click("Done reading");    // privacy-> ai
  await click("Done reading");    // ai     -> country
  expect(host.textContent).toContain("Where do you live?");
}

describe("the country step", () => {
  it("advances on its own once a country is chosen", async () => {
    await walkToCountry();

    await click("Poland");
    // The choice is visible first — the step has not moved yet.
    expect(host.textContent).toContain("Where do you live?");

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(host.textContent).toContain("Two things to confirm");
  });

  it("lets a second choice replace the first, and the last tap wins", async () => {
    await walkToCountry();

    await click("Poland");
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await click("Germany");

    // The first transition was cancelled, not queued: one advance, not two.
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(host.textContent).toContain("Two things to confirm");
  });
});

describe("the confirm step", () => {
  it("NEVER advances on its own — consent stays a deliberate act", async () => {
    await walkToCountry();
    await click("Poland");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(host.textContent).toContain("Two things to confirm");

    // Tick the age attestation and let far more time pass than the country
    // step needs. Nothing may move.
    await click("I am 18");
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(host.textContent).toContain("Two things to confirm");
  });
});

/* -------------------------------------------------------------------------- */
/*  ASKED ONCE, PREFILLED AFTER (founder 2026-10-05, N48.4 Q21 A).            */
/*                                                                            */
/*  A re-acceptance shows the person's own earlier answer already chosen. It  */
/*  is not a guess: a first-timer still sees nothing chosen, and a country    */
/*  the new policy no longer allows is asked again rather than sent to be    */
/*  refused. The answer stays theirs to change, and nothing advances on its  */
/*  own: a prefill is not a tap.                                             */
/* -------------------------------------------------------------------------- */

function chosen(label: string): boolean {
  return buttonSaying(label).getAttribute("aria-pressed") === "true";
}

describe("a re-acceptance (Q21 A)", () => {
  it("shows the earlier country chosen, and sends it", async () => {
    vi.mocked(acceptAuthorization).mockClear();
    await walkToCountry("DE");
    expect(chosen("Germany")).toBe(true);
    expect(chosen("Poland")).toBe(false);
    // A prefill is not a tap: the step waits for the person.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(host.textContent).toContain("Where do you live?");
    expect(buttonSaying("Continue").disabled).toBe(false);

    await click("Continue");
    expect(host.textContent).toContain("Two things to confirm");
    await click("I am 18");
    await click("I agree that a recording");
    await click("Agree and continue");
    expect(vi.mocked(acceptAuthorization)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(acceptAuthorization).mock.calls[0][0].countryOfResidence).toBe("de");
  });

  it("can still be changed", async () => {
    await walkToCountry("de");
    await click("Poland");
    expect(chosen("Poland")).toBe(true);
    expect(chosen("Germany")).toBe(false);
  });

  it("asks again when the policy in force no longer allows it", async () => {
    await walkToCountry("fr");
    expect(chosen("Poland")).toBe(false);
    expect(chosen("Germany")).toBe(false);
    expect(buttonSaying("Continue").disabled).toBe(true);
  });

  it("a first-timer sees nothing chosen", async () => {
    await walkToCountry(null);
    expect(chosen("Poland")).toBe(false);
    expect(chosen("Germany")).toBe(false);
    expect(buttonSaying("Continue").disabled).toBe(true);
  });
});

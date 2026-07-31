// @vitest-environment jsdom
//
// Needs a real `window`: the balance refresh is a window event, and
// `notifyTokensSpent` is SSR-safe (it no-ops without a window), so in the
// default node environment this whole file would silently pass by measuring
// nothing.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchArcFeedback } from "./arcFeedback";
import { WILLAB_TOKENS_SPENT_EVENT } from "@/lib/willabWindowEvents";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

/* -------------------------------------------------------------------------- */
/*  Opening a take's feedback is METERED: the BE charges the `insights` price   */
/*  on this GET, once per arc, silently and fail-open. Nothing about that is    */
/*  visible on the way in, so without a balance re-read the header number is    */
/*  simply lower the next time it polls — which reads as a bug, or as a charge  */
/*  the user never made.                                                       */
/*                                                                            */
/*  These tests pin the re-read to the cases that actually spent something.    */
/* -------------------------------------------------------------------------- */

const PAYLOAD = {
  arc_id: "arc_1",
  takes: [
    { take_index: 1, session_id: "s1", free: true, locked: false, full_text: "hi", key_moments: [] },
  ],
};

function reply(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })
  );
}

/** Count of balance-refresh events fired while running `fn`. */
async function spentEvents(fn: () => Promise<unknown>): Promise<number> {
  let n = 0;
  const onSpent = () => n++;
  window.addEventListener(WILLAB_TOKENS_SPENT_EVENT, onSpent);
  try {
    await fn();
  } finally {
    window.removeEventListener(WILLAB_TOKENS_SPENT_EVENT, onSpent);
  }
  return n;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchArcFeedback — the metered read", () => {
  it("re-reads the balance after a successful feedback load", async () => {
    reply(200, PAYLOAD);
    expect(await spentEvents(() => fetchArcFeedback("arc_1"))).toBe(1);
  });

  it("does not claim a spend when the endpoint failed", async () => {
    // Nothing was charged, so nothing should twitch the balance. Firing here
    // would make an unreachable backend look like a purchase.
    reply(502, null);
    expect(await spentEvents(() => fetchArcFeedback("arc_1"))).toBe(0);
  });

  it("still re-reads when the BE served a 200 the mapper cannot use", async () => {
    // The charge belongs to the request the BE served, not to the FE's ability
    // to parse the answer. Skipping the refresh here would drop it in exactly
    // the case where the user paid and got nothing back.
    reply(200, { nonsense: true });
    expect(await spentEvents(() => fetchArcFeedback("arc_1"))).toBe(1);
  });

  it("still returns the feedback — the charge never gates the read", async () => {
    // Fail-open by contract: metering must not change what the user gets.
    reply(200, PAYLOAD);
    const r = await fetchArcFeedback("arc_1");
    expect(r?.takes).toHaveLength(1);
    expect(r?.takes[0].fullText).toBe("hi");
  });
});

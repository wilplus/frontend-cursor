// @vitest-environment jsdom
/*
STORY    As a speaker, I want my token balance refreshed right after opening
         a Take's feedback charges me, and never when nothing was charged, so
         that a balance drop is never a mystery (payments; feedback after
         every Take).
OUTCOME
  O1  A served feedback read (200) fires exactly one balance-refresh event.
  O2  A failed read fires none: nothing was charged.
  O3  A served read returns the feedback; the charge never gates it.
PROVES   O1 -> "fires one balance refresh when the read was served"
         O2 -> "does not claim a spend when the endpoint failed"
         O3 -> "still returns the feedback; the charge never gates the read"
WHY      The backend charges the insights price on this GET, silently and
         fail-open. Needs jsdom: notifyTokensSpent no-ops without a window, so
         in node this file would pass by measuring nothing.
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchArcFeedback } from "./arcFeedback";
import { WILLAB_TOKENS_SPENT_EVENT } from "@/lib/willabWindowEvents";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

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
  it("fires one balance refresh when the read was served", async () => {
    reply(200, PAYLOAD);
    expect(await spentEvents(() => fetchArcFeedback("arc_1"))).toBe(1);
  });

  it("does not claim a spend when the endpoint failed", async () => {
    // Nothing was charged, so nothing should twitch the balance. Firing here
    // would make an unreachable backend look like a purchase.
    reply(502, null);
    expect(await spentEvents(() => fetchArcFeedback("arc_1"))).toBe(0);
  });

  it("still returns the feedback; the charge never gates the read", async () => {
    // Fail-open by contract: metering must not change what the user gets.
    reply(200, PAYLOAD);
    const r = await fetchArcFeedback("arc_1");
    expect(r?.takes).toHaveLength(1);
    expect(r?.takes[0].fullText).toBe("hi");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  answerRetirePrompt,
  deriveFromWins,
  setItemStatus,
} from "./life";

/* -------------------------------------------------------------------------- */
/*  Piece 6 wire contract (BE handoff 2026-08-03): the derive call, the        */
/*  approve/dismiss PATCH with its additive retire_prompt, and the retire      */
/*  answer. The rules a machine can hold:                                      */
/*    · an outcome the FE does not know never becomes a claim about the wins;  */
/*    · a retire prompt missing its question or its target degrades to "no     */
/*      prompt" rather than to a broken dialog, because the approve has        */
/*      already landed and must not look failed;                               */
/*    · rows written before the provenance migration carry [] and render,      */
/*      just without grounding chips.                                          */
/* -------------------------------------------------------------------------- */

function stub(handler: () => unknown) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      });
      const out = handler() as { status?: number; json?: unknown };
      const status = out.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => out.json ?? {},
      };
    })
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const PROPOSAL = {
  id: "p-1",
  kind: "principle",
  title: "Name the ask in the first sentence.",
  body: "",
  status: "proposed",
  origin_win_ids: ["w-1", "w-2"],
};

describe("deriveFromWins", () => {
  it("POSTs to /wins/derive and maps a full ok response", async () => {
    const calls = stub(() => ({
      json: {
        outcome: "ok",
        proposed: [PROPOSAL],
        wins_read: 20,
        wins_total: 34,
        already_held: 1,
      },
    }));
    const run = await deriveFromWins();

    expect(calls[0].url).toBe("/api/v2/life/wins/derive");
    expect(calls[0].method).toBe("POST");
    expect(run.outcome).toBe("ok");
    expect(run.proposed).toEqual([
      {
        id: "p-1",
        title: "Name the ask in the first sentence.",
        body: "",
        originWinIds: ["w-1", "w-2"],
      },
    ]);
    expect(run.winsRead).toBe(20);
    expect(run.winsTotal).toBe(34);
    expect(run.alreadyHeld).toBe(1);
  });

  it("passes the two honest non-answers through", async () => {
    stub(() => ({ json: { outcome: "no_wins", proposed: [] } }));
    await expect(deriveFromWins()).resolves.toMatchObject({
      outcome: "no_wins",
    });
    stub(() => ({ json: { outcome: "no_derivation", proposed: [] } }));
    await expect(deriveFromWins()).resolves.toMatchObject({
      outcome: "no_derivation",
    });
  });

  it("never turns an unknown outcome into a claim about the wins", async () => {
    // With rows in hand the run plainly worked; without them, "try again"
    // (no_derivation) is the only reading that cannot be a lie. "Your wins
    // teach nothing" on a garbled payload would be one.
    stub(() => ({ json: { outcome: "???", proposed: [PROPOSAL] } }));
    await expect(deriveFromWins()).resolves.toMatchObject({ outcome: "ok" });

    stub(() => ({ json: { outcome: "???", proposed: [] } }));
    await expect(deriveFromWins()).resolves.toMatchObject({
      outcome: "no_derivation",
    });
  });

  it("defaults grounding to [] for rows written before the migration", async () => {
    const { origin_win_ids: _dropped, ...bare } = PROPOSAL;
    stub(() => ({ json: { outcome: "ok", proposed: [bare] } }));
    const run = await deriveFromWins();
    expect(run.proposed[0].originWinIds).toEqual([]);
  });
});

describe("setItemStatus", () => {
  it("PATCHes the status and reads a null retire prompt", async () => {
    const calls = stub(() => ({ json: { item: {}, retire_prompt: null } }));
    const out = await setItemStatus("p-1", "active");
    expect(calls[0].url).toBe("/api/v2/life/items/p-1");
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].body).toEqual({ status: "active" });
    expect(out.retirePrompt).toBeNull();
  });

  it("maps a full retire prompt", async () => {
    stub(() => ({
      json: {
        item: {},
        retire_prompt: {
          question: "Does this retire #12?",
          retires: { id: "old-1", title: "The old rule." },
          number: 12,
        },
      },
    }));
    const out = await setItemStatus("p-1", "active");
    expect(out.retirePrompt).toEqual({
      question: "Does this retire #12?",
      retiresId: "old-1",
      retiresTitle: "The old rule.",
    });
  });

  it("degrades a prompt that cannot render or act to no prompt at all", async () => {
    // The approve has ALREADY landed by the time the prompt arrives, so a
    // half-formed prompt must cost the question, never the approve.
    stub(() => ({
      json: { item: {}, retire_prompt: { question: "", retires: { id: "x" } } },
    }));
    await expect(setItemStatus("p-1", "active")).resolves.toEqual({
      retirePrompt: null,
    });

    stub(() => ({
      json: { item: {}, retire_prompt: { question: "Retire?", retires: {} } },
    }));
    await expect(setItemStatus("p-1", "active")).resolves.toEqual({
      retirePrompt: null,
    });
  });
});

describe("answerRetirePrompt", () => {
  it("POSTs the decision to the new principle's retire endpoint", async () => {
    const calls = stub(() => ({ json: {} }));
    await answerRetirePrompt("new-1", "old-1", "no");
    expect(calls[0].url).toBe("/api/v2/life/principles/new-1/retire");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({ retires_id: "old-1", decision: "no" });
  });
});

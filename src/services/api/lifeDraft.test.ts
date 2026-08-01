import { afterEach, describe, expect, it, vi } from "vitest";
import { applyConfirmedItems, proposeFromDocument } from "./life";

/* -------------------------------------------------------------------------- */
/*  The drafting round trip, against the contract the backend answered with    */
/*  on 2026-07-31 (kind honoured, phrase/principle/win emitted, provenance     */
/*  stamped from an optional document_id).                                     */
/*                                                                            */
/*  Three things here are worth a machine holding:                             */
/*    · the kind hint reaches the wire, and a rejection of it does not cost    */
/*      the user their draft;                                                  */
/*    · the document id makes the round trip, INCLUDING on the un-hinted       */
/*      "draft from my document" path where only the response knows it;        */
/*    · a long line's title/body pair survives the review row. That last one   */
/*      is N5: the row that lands must be the row that was displayed.          */
/* -------------------------------------------------------------------------- */

function stub(handler: (url: string, init?: RequestInit) => unknown) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: init?.body ? JSON.parse(init.body as string) : {},
      });
      const out = handler(url, init) as { status?: number; json?: unknown };
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

const PHRASE = {
  kind: "phrase",
  title: "The line itself.",
  body: "",
  collection: "wall",
  external_id: "phrase:sha:abc",
  order_key: 1000,
};

describe("proposeFromDocument", () => {
  it("sends the kind hint and reads back the document it was read from", async () => {
    const calls = stub(() => ({
      json: { document: { id: "doc-1" }, items: [PHRASE], kind: "phrase" },
    }));
    const draft = await proposeFromDocument({ kind: "phrase" });

    expect(calls[0].body).toEqual({ kind: "phrase" });
    expect(draft.documentId).toBe("doc-1");
    expect(draft.items).toHaveLength(1);
    // `collection` on the way out is `bet` on the way in. The backend accepts
    // either spelling, so this mapping is belt and braces, but the wall is
    // what makes a drafted phrase land under Wall rather than Uncollected.
    expect(draft.items[0]).toMatchObject({ kind: "phrase", bet: "wall" });
  });

  it("learns the document id on the un-hinted draft-again path", async () => {
    // This press names no document: the backend picks the newest readable one,
    // so its answer is the ONLY place that says which file the rows came from.
    // Without reading it back, this path could never stamp provenance.
    const calls = stub(() => ({
      json: { document: { id: "doc-newest" }, items: [PHRASE] },
    }));
    const draft = await proposeFromDocument();

    expect(calls[0].body).toEqual({});
    expect(draft.documentId).toBe("doc-newest");
  });

  it("keeps the draft when a backend refuses the kind field", async () => {
    // Belt and braces against an older deploy. The retry drops the hint, not
    // the upload: losing someone's document to a field the server has not
    // heard of is the failure this exists to prevent.
    let seen = 0;
    const calls = stub(() => {
      seen += 1;
      return seen === 1
        ? { status: 422, json: { error: "unknown field" } }
        : { json: { document: { id: "doc-1" }, items: [PHRASE] } };
    });
    const draft = await proposeFromDocument({ kind: "phrase" });

    expect(calls).toHaveLength(2);
    expect(calls[0].body).toEqual({ kind: "phrase" });
    expect(calls[1].body).toEqual({});
    expect(draft.items).toHaveLength(1);
  });

  it("drops a kind the panel cannot render rather than showing it", async () => {
    // The nine are closed on both sides. A tenth is an FE change, and until
    // then an unrenderable row must not reach a tick box.
    stub(() => ({ json: { items: [{ ...PHRASE, kind: "reflection" }] } }));
    await expect(proposeFromDocument()).resolves.toMatchObject({ items: [] });
  });
});

describe("the long-line truncation pair", () => {
  const LONG = "x".repeat(600);

  it("is marked when body is the whole line and title its opening", async () => {
    stub(() => ({
      json: {
        items: [{ ...PHRASE, title: LONG.slice(0, 500), body: LONG }],
      },
    }));
    const { items } = await proposeFromDocument();
    expect(items[0].titleCut).toBe(500);
  });

  it("is NOT marked when body is a genuine description", async () => {
    // A goal's body describes the goal; it is not a longer copy of the title.
    // Collapsing the two into one editable text would destroy the description.
    stub(() => ({
      json: {
        items: [{ ...PHRASE, kind: "goal", title: "Ship it", body: "By March." }],
      },
    }));
    const { items } = await proposeFromDocument();
    expect(items[0].titleCut).toBeNull();
  });

  it("round-trips an untouched pair byte-identically", async () => {
    stub(() => ({
      json: { items: [{ ...PHRASE, title: LONG.slice(0, 500), body: LONG }] },
    }));
    const { items } = await proposeFromDocument();

    const calls = stub(() => ({ json: { count: 1 } }));
    await applyConfirmedItems(items);
    const sent = (calls[0].body.items as Array<Record<string, unknown>>)[0];
    expect(sent.title).toBe(LONG.slice(0, 500));
    expect(sent.body).toBe(LONG);
  });
});

describe("applyConfirmedItems", () => {
  const row = {
    kind: "phrase" as const,
    title: "A line",
    body: "",
    titleCut: null,
    horizon: null,
    strategyHorizon: null,
    dueLabel: null,
    bet: "wall",
    externalId: null,
    orderKey: 0,
    checked: true,
  };

  it("stamps provenance when it knows the document", async () => {
    const calls = stub(() => ({ json: { count: 1 } }));
    await applyConfirmedItems([row], "doc-1");
    expect(calls[0].body.document_id).toBe("doc-1");
  });

  it("omits the field entirely when it does not", async () => {
    // Optional on both sides. A null must not be sent as a key the backend
    // then has to resolve and reject.
    const calls = stub(() => ({ json: { count: 1 } }));
    await applyConfirmedItems([row], null);
    expect("document_id" in calls[0].body).toBe(false);
  });

  it("sends only ticked rows, and never calls out with none", async () => {
    const calls = stub(() => ({ json: { count: 0 } }));
    await expect(
      applyConfirmedItems([{ ...row, checked: false }], "doc-1")
    ).resolves.toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("reports the backend's count even when it is lower than the ticks", async () => {
    // Deduped by content hash: a ticked line the user already has is not
    // duplicated, so a short count is correct rather than a partial failure.
    stub(() => ({ json: { count: 1 } }));
    await expect(
      applyConfirmedItems([row, { ...row, title: "Another" }], "doc-1")
    ).resolves.toBe(1);
  });
});

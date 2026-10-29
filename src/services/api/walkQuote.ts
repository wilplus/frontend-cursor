import { bffFetch } from "@/lib/api/bffFetch";

/* The walk quotes your notebook (backend N268; services/walk_quote.py;
   rules: docs/flows/principles.md §1 R, docs/flows/feedback-walk-and-chat.md
   C5). Ring 5 (row walk_quotes) with the notebook kept: for anyone else the
   backend answers no quote and no switch. A call that fails is read as
   nothing, so the walk never waits on it. */

export type WalkQuote = {
  kind: "strength" | "vision" | "yours";
  /** The signed line above the quote. */
  line: string;
  /** The speaker's own words, word for word. */
  quote: string;
  /** The day they wrote them (YYYY-MM-DD); null for the vision. */
  said_on: string | null;
  /** The sentence it answered. */
  said: string;
  /** The first quote ever shown: the notebook line and "Not here" with it. */
  first: boolean;
};

export type WalkQuoteSetting = { available: boolean; on: boolean };

async function call(path: string, init: Parameters<typeof bffFetch>[1]): Promise<unknown | null> {
  try {
    const result = await bffFetch(path, { cache: "no-store", ...init });
    return result.kind === "response" && result.ok ? (result.body ?? {}) : null;
  } catch {
    return null;
  }
}

const quoteOf = (body: unknown): WalkQuote | null => {
  const q = (body as { quote?: WalkQuote | null } | null)?.quote;
  return q && typeof q.line === "string" && typeof q.quote === "string" ? q : null;
};

/** Asked while the speaker practises a Clearer version. */
export async function askWalkQuote(takeId: string, said: string): Promise<WalkQuote | null> {
  return quoteOf(await call("/api/v2/walk-quote", { method: "POST", json: { take_id: takeId, said } }));
}

/** A walk played again: the quote it already showed. */
export async function replayWalkQuote(takeId: string): Promise<WalkQuote | null> {
  return quoteOf(await call("/api/v2/walk-quote/replay", { method: "POST", json: { take_id: takeId } }));
}

export async function walkQuoteShown(takeId: string): Promise<void> {
  await call("/api/v2/walk-quote/shown", { method: "POST", json: { take_id: takeId } });
}

export async function getWalkQuoteSetting(): Promise<WalkQuoteSetting> {
  const body = (await call("/api/v2/walk-quote/setting", { method: "GET" })) as Partial<WalkQuoteSetting> | null;
  return { available: body?.available === true, on: body?.on === true };
}

/** "Not here" (false) or the Life Panel's switch. */
export async function setWalkQuote(on: boolean): Promise<WalkQuoteSetting | null> {
  const body = (await call("/api/v2/walk-quote/setting", { method: "POST", json: { on } })) as Partial<WalkQuoteSetting> | null;
  return body ? { available: body.available === true, on: body.on === true } : null;
}

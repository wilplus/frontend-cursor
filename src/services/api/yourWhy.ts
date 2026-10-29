import { bffFetch } from "@/lib/api/bffFetch";

/* Your why, every day (backend N255, signed N258; services/your_why.py;
   rules: docs/flows/principles.md §1 Q). Ring 5 (row your_why): the backend
   answers 404 for anyone else, read here as off. Writes that put rows into
   the Lounge answer them; the caller reloads. */

export type WhyLine = "why" | "vision" | "treat";
export const WHY_LINES: readonly WhyLine[] = ["why", "vision", "treat"];

export type YourWhyState = {
  enabled: boolean;
  lines: Record<WhyLine, string | null>;
  set_on: string | null;
  /** Each line's newest change: its date and the words before it. */
  changes: Partial<Record<WhyLine, { on: string; earlier: string | null }>>;
};

/** Will's draft of one line, from their words, and the words it came from. */
export type WhyDraft = Record<WhyLine, { line: string; quote: string } | null>;

const OFF: YourWhyState = { enabled: false, lines: { why: null, vision: null, treat: null }, set_on: null, changes: {} };

async function call(path: string, init: Parameters<typeof bffFetch>[1]): Promise<unknown | null> {
  try {
    const result = await bffFetch(path, { cache: "no-store", ...init });
    return result.kind === "response" && result.ok ? (result.body ?? {}) : null;
  } catch {
    return null;
  }
}

function stateOf(body: unknown): YourWhyState {
  const raw = body as Partial<YourWhyState> | null;
  if (!raw || !raw.lines) return OFF;
  return { enabled: true, lines: { ...OFF.lines, ...raw.lines }, set_on: raw.set_on ?? null, changes: raw.changes ?? {} };
}

export async function getYourWhy(): Promise<YourWhyState> {
  return stateOf(await call("/api/v2/your-why", { method: "GET" }));
}

/** The Lounge opened: the ask, or the day's why; true when rows were
 *  written, so the caller reloads. */
export async function yourWhyToday(): Promise<boolean> {
  const body = (await call("/api/v2/your-why/today", { method: "POST", json: {} })) as { messages?: unknown } | null;
  return Array.isArray(body?.messages) && body.messages.length > 0;
}

export async function answerYourWhyAsk(choice: "start" | "not_now"): Promise<boolean> {
  return (await call("/api/v2/your-why/ask", { method: "POST", json: { choice } })) !== null;
}

export async function draftYourWhy(answers: Partial<Record<WhyLine, string | null>>): Promise<WhyDraft | null> {
  return (await call("/api/v2/your-why/draft", { method: "POST", json: { answers } })) as WhyDraft | null;
}

export async function saveYourWhy(lines: Partial<Record<WhyLine, string>>): Promise<boolean> {
  return (await call("/api/v2/your-why", { method: "POST", json: { lines } })) !== null;
}

export async function changeYourWhy(line: WhyLine, text: string): Promise<YourWhyState | null> {
  const body = await call(`/api/v2/your-why/${line}`, { method: "POST", json: { text } });
  return body ? stateOf(body) : null;
}

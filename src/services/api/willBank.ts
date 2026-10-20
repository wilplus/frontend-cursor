import { bffFetch } from "@/lib/api/bffFetch";

/* Will's questions after a Take, the founder's only (founder 2026-10-20,
 * N83): read them with how often each was asked, and save the founder's
 * words. The backend checks the words (no numbers, the speaker's own words
 * kept in place, the same number of tap answers) and says what is wrong. */

export type WillBankItem = {
  key: string;
  /** When Will asks it, in the backend's words. */
  when: string;
  question: string;
  chips: string[];
  /** Answered in the speaker's own words, no taps. */
  ownWords: boolean;
  /** An empty slot: no question yet. */
  empty: boolean;
  asked: number;
};
export type WillBankGroup = { label: string; items: WillBankItem[] };
export type WillBank = { groups: WillBankGroup[]; questions: number; empty: number };

const str = (v: unknown) => (typeof v === "string" ? v : "");

function itemOf(raw: Record<string, unknown>): WillBankItem {
  return {
    key: str(raw.key),
    when: str(raw.when),
    question: str(raw.question),
    chips: Array.isArray(raw.chips) ? raw.chips.filter((c): c is string => typeof c === "string") : [],
    ownWords: raw.own_words === true,
    empty: raw.empty === true,
    asked: typeof raw.asked === "number" ? raw.asked : 0,
  };
}

/** The bank as the backend serves it; null when it is not there to read. Pure. */
export function willBankOf(body: unknown): WillBank | null {
  const b = body as Record<string, unknown> | null;
  if (!b || !Array.isArray(b.groups)) return null;
  const groups = (b.groups as Record<string, unknown>[]).map((g) => ({
    label: str(g.label),
    items: Array.isArray(g.items) ? (g.items as Record<string, unknown>[]).map(itemOf) : [],
  }));
  return { groups, questions: Number(b.questions) || 0, empty: Number(b.empty) || 0 };
}

/** The bank, or null (not the founder, or it could not be read). */
export async function fetchWillBank(): Promise<WillBank | null> {
  try {
    const result = await bffFetch("/api/v2/admin/will-questions", { method: "GET", cache: "no-store" });
    return result.kind === "response" && result.ok ? willBankOf(result.body) : null;
  } catch {
    return null;
  }
}

/** Save the founder's words: the bank as saved, or the backend's sentence
 *  saying what is wrong. */
export async function saveWillBank(
  items: readonly Pick<WillBankItem, "key" | "question" | "chips">[],
): Promise<{ bank: WillBank } | { error: string }> {
  try {
    const result = await bffFetch("/api/v2/admin/will-questions", {
      method: "PUT",
      cache: "no-store",
      json: { questions: items.map(({ key, question, chips }) => ({ key, question, chips })) },
    });
    if (result.kind !== "response") return { error: "" };
    const bank = result.ok ? willBankOf(result.body) : null;
    if (bank) return { bank };
    return { error: str((result.body as Record<string, unknown> | null)?.error) };
  } catch {
    return { error: "" };
  }
}

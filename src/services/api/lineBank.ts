import { getAuthToken } from "@/lib/api/auth-client";
import type { WalkLinesIO } from "@/lib/willab/walkLines";

/* -------------------------------------------------------------------------- */
/*  The signed line bank's memory, for the Feedback walk (build plan D-FW-3;   */
/*  backend 0438, routes/v2/line_bank.py). The walk reads which line each      */
/*  bank says next as it opens, and records each line it shows, so the same   */
/*  line is never said twice in a row for a speaker, across Takes and          */
/*  devices. Indexes only. Best-effort: a failed read leaves the walk on its   */
/*  own turn, a failed record is not retried, and the walk never waits.       */
/* -------------------------------------------------------------------------- */

async function authed(): Promise<Record<string, string> | null> {
  const token = await getAuthToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/** {bank: index} each bank says next; null when it cannot be read. */
export async function fetchLineBankNext(): Promise<Record<string, number> | null> {
  const headers = await authed();
  if (!headers) return null;
  try {
    const res = await fetch("/api/v2/user/line-bank", { headers, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { next?: unknown } | null;
    const next = data?.next;
    if (!next || typeof next !== "object" || Array.isArray(next)) return null;
    const out: Record<string, number> = {};
    for (const [bank, index] of Object.entries(next as Record<string, unknown>)) {
      if (typeof index === "number" && Number.isInteger(index) && index >= 0) out[bank] = index;
    }
    return out;
  } catch {
    return null;
  }
}

/** A line of `bank` was shown: record it as said. */
export async function recordLineShown(bank: string): Promise<void> {
  const headers = await authed();
  if (!headers) return;
  try {
    await fetch("/api/v2/user/line-bank/shown", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ bank }),
    });
  } catch {
    // Not retried: the next read follows whatever the memory holds.
  }
}

/** The walk's calls. */
export const lineBankIO: WalkLinesIO = { next: fetchLineBankNext, shown: recordLineShown };

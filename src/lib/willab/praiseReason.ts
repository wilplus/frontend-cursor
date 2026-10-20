/* -------------------------------------------------------------------------- */
/*  WHY THE GREEN MOMENT LANDED (founder 2026-10-18)                          */
/*                                                                            */
/*  "on that screen we need to explain why it was a good take; not only it    */
/*  was a good take". The backend's GPT surface (services/praise_reason)      */
/*  writes up to three short paragraphs from the clip's own evidence, checked */
/*  in code: the speaker's own quote, plain facts, no number (AC-9). Shown in */
/*  its own bubble after the praise, the quote in orange. Prototype approved  */
/*  2026-10-18: https://claude.ai/artifact/Wdaznuffm9SJEkkjPEuSaR (v4).       */
/* -------------------------------------------------------------------------- */

/** One green moment's reason: its paragraphs and the words it quotes. */
export type PraiseReason = {
  paragraphs: readonly string[];
  quote: string | null;
};

/** What the walk knows about reasons still being written: the one for a
 *  clip, and whether it is still worth waiting for. */
export type WalkPraiseReasons = {
  of: (snippetId: string | null | undefined) => PraiseReason | null;
  waiting: (snippetId: string | null | undefined) => boolean;
};

/** A served `praise_reason`, or null when it is missing or malformed. Pure. */
export function readPraiseReason(raw: unknown): PraiseReason | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const paragraphs = Array.isArray(record.paragraphs)
    ? record.paragraphs.filter((p): p is string => typeof p === "string" && p.trim() !== "").slice(0, 3)
    : [];
  if (paragraphs.length === 0) return null;
  const quote = typeof record.quote === "string" && record.quote.trim() ? record.quote.trim() : null;
  return { paragraphs, quote };
}

const QUOTE_MARKS = "\"'“”‘’";

/** A paragraph as runs, the quoted words (with the marks around them) set
 *  apart so the screen can draw them in orange. Pure. */
export function reasonRuns(paragraph: string, quote: string | null): { text: string; quoted: boolean }[] {
  if (!quote) return [{ text: paragraph, quoted: false }];
  let start = paragraph.toLowerCase().indexOf(quote.toLowerCase());
  if (start < 0) return [{ text: paragraph, quoted: false }];
  let end = start + quote.length;
  if (start > 0 && QUOTE_MARKS.includes(paragraph[start - 1])) start -= 1;
  // The closing mark, after any full stop the speaker's words ended on.
  while (end < paragraph.length && ".,?".includes(paragraph[end]) && QUOTE_MARKS.includes(paragraph[end + 1] ?? "")) end += 1;
  if (end < paragraph.length && QUOTE_MARKS.includes(paragraph[end])) end += 1;
  return [
    { text: paragraph.slice(0, start), quoted: false },
    { text: paragraph.slice(start, end), quoted: true },
    { text: paragraph.slice(end), quoted: false },
  ].filter((run) => run.text !== "");
}

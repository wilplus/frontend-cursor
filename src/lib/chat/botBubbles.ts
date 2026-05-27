/**
 * `botBubblesFromText` — split a backend `assistant_text` payload
 * into one-or-more `bot_text` BubbleInputs, deferring the splitting
 * to `splitAiBubbleText` (the canonical 75-char visual segmentation).
 *
 * Lives in `src/lib/chat/` next to `splitAiBubbleText` /
 * `snippetLabel` / `closedOutSnippets` because every chat-surface
 * hook that emits assistant bubbles uses it. Moved out of
 * `page.client.tsx` in the Week 2 hook-extraction pass so the new
 * hooks under `src/components/chat/hooks/` can share it without
 * each importing from the page client.
 *
 * Returns bubbles WITHOUT ids — `useThread`'s `appendBubble`
 * generates client-UUID ids at append time. Callers iterate and
 * append each.
 */
import type { BubbleInput } from "@/components/chat/thread/types";
import { splitAiBubbleText } from "@/lib/chat/bubbleSplit";

export function botBubblesFromText(text: string): BubbleInput[] {
  const chunks = splitAiBubbleText(text);
  return chunks.map((t) => ({
    kind: "bot_text" as const,
    text: t,
  }));
}

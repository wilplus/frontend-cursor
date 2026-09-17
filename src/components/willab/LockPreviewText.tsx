"use client";

import { RichText } from "@/components/willab/RichText";
import { quoteSpan } from "@/lib/willab/phraseTokens";

/** The paragraph as it will be committed: its own markers rendered, and the
 *  phrase the speaker just chose painted in the accent.
 *
 *  FOUNDER 2026-09-17: "on the lock-in screen show the whole text that is
 *  being locked in WITH the boldening and orange that was tapped in the step
 *  earlier." The lock step drew the raw paragraph, so the one thing the
 *  previous screen was about — which words turn orange — was invisible at the
 *  moment of committing it. Confirming a decision means seeing it.
 *
 *  A PREVIEW, NOT AN EDIT, which is the rule the whole lock path already runs
 *  on: `onLockIn` still receives the paragraph byte-for-byte as the speaker
 *  read it, and the phrase travels separately as a SPAN through
 *  onSetRootPhrase (§5). Nothing here writes a marker into the text.
 *
 *  The span is RESOLVED against the text rather than carried as an offset,
 *  for the reason the lock path gives: an accepted emphasis rewraps words in
 *  `**` and moves every raw index after it, while the readable text does not.
 *  A phrase that no longer resolves simply renders untinted — the same
 *  "never guess" the anchor itself follows.
 *
 *  Its own component so the branching stays out of DeckChunkModal, which is
 *  grandfathered at the complexity ratchet and may only come down.
 */
export default function LockPreviewText({
  text,
  phrase,
}: {
  text: string;
  /** The words chosen on the emphasis step, if any. */
  phrase?: string | null;
}) {
  const span = phrase ? quoteSpan(text, phrase) : null;
  return (
    <p className="pr-8 text-[15px] leading-relaxed text-foreground">
      <RichText
        text={text}
        tint={span ? [[span.start, span.end]] : undefined}
      />
    </p>
  );
}

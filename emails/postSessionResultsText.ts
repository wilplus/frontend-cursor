/**
 * Plain-text fallback for PostSessionResultsEmail.
 *
 * Sent as the `text` part of the multipart MIME so clients that
 * can't (or refuse to) render HTML still get a useful message:
 *   • text-only clients (lynx, mail-user-agents in screen readers)
 *   • Gmail's "Show original" view
 *   • spam filters and the Apple Mail privacy summary
 *
 * Per spec §6, this is exported as a pure builder fn so the same
 * props that drive the React Email template drive the plaintext —
 * no risk of the two drifting.
 *
 * Footer mirrors the .tsx: Unsubscribe / Privacy / Terms only,
 * no "delivered to <email>" line, no copyright.
 */

import {
  momentsLine,
  type PostSessionResultsEmailProps,
} from "./PostSessionResultsEmail";

export function buildPostSessionResultsText(
  props: PostSessionResultsEmailProps
): string {
  const { snippetCount, topTheme, journeyUrl, unsubscribeUrl } = props;

  // Founder 2026-09-25: the same words as the HTML part.
  return [
    `WillpowerLab`,
    ``,
    (topTheme ?? "").trim().toUpperCase(),
    ``,
    `Your coach's feedback is in.`,
    ``,
    momentsLine(snippetCount),
    `Open it to hear each moment, say how it sounded to you, and see`,
    `your coach's notes and exercises.`,
    ``,
    `Open the feedback:`,
    `  ${journeyUrl}`,
    ``,
    `--`,
    `Unsubscribe: ${unsubscribeUrl}`,
    `Privacy:     https://www.willpowerlab.com/privacy`,
    `Terms:       https://www.willpowerlab.com/terms`,
  ].join("\n");
}

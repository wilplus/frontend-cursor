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
 */

import type { PostSessionResultsEmailProps } from "./PostSessionResultsEmail";

export function buildPostSessionResultsText(
  props: PostSessionResultsEmailProps
): string {
  const {
    userFirstName,
    snippetCount,
    topTheme,
    journeyUrl,
    unsubscribeUrl,
    subscribedEmail,
  } = props;

  const greeting = userFirstName?.trim()
    ? `Hi ${userFirstName.trim()},`
    : `Hi there,`;
  const snippetWord = snippetCount === 1 ? "moment" : "moments";
  const year = new Date().getFullYear();

  return [
    `willab.`,
    ``,
    `YOUR VOICE JOURNEY`,
    ``,
    greeting,
    `your latest voice ${snippetWord} are ready.`,
    ``,
    `Your coach finished pulling out the moments where your delivery`,
    `hit hardest — and the ones worth a second pass. Open your journey`,
    `to listen back, read the coach's notes, and pick what to push on next.`,
    ``,
    `  • Published snippets: ${snippetCount} new`,
    `  • Top theme:          ${topTheme}`,
    ``,
    `Open your Voice Journey:`,
    `  ${journeyUrl}`,
    ``,
    `Each snippet has a coach note, a one-tap player, and a CTA back`,
    `into a contextual chat — pick the moment that grabs you and push`,
    `on it.`,
    ``,
    `--`,
    `You're receiving this at ${subscribedEmail} because your coach`,
    `published new snippets for you.`,
    ``,
    `Unsubscribe: ${unsubscribeUrl}`,
    `Privacy:     https://www.willonski.com/privacy`,
    ``,
    `© ${year} Willab. All rights reserved.`,
  ].join("\n");
}

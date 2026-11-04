/* -------------------------------------------------------------------------- */
/*  WillpowerLab by invitation (backend N471): the signed words (Never 4,     */
/*  founder 2026-11-04, "words are signed"), and how a pasted link is read.   */
/*  Rules: docs/flows/consent-screens.md §1, "By invitation".                 */
/* -------------------------------------------------------------------------- */

export const INVITE_COPY = {
  paste: "Paste your link",
  wrongLink: "This link doesn’t work. Ask whoever sent it for a new one.",
  joinWaitlist: "No link yet? Join the waitlist",
  waitlistWith: "Join the waitlist with:",
  waitingTitle: "You’re on the waitlist",
  waitingLine: (email: string) => `If we say yes, we’ll email a link to ${email}.`,
  /** "Sign in" is the app's own word, already signed. */
  signIn: "Sign in",
  /** The send arrow's name for screen readers, as the chat's "Send". */
  open: "Open",
} as const;

/** Where "No link yet? Join the waitlist" goes: the sign-up page in its
 *  waitlist mode. */
export const WAITLIST_HREF = "/signup?waitlist=1";

/** The token of a join link (/c/<token>, backend chat_links), from whatever
 *  was pasted: the whole link, the path, or the token alone. */
export function inviteToken(pasted: string): string | null {
  const text = pasted.trim();
  const inLink = text.match(/\/c\/([A-Za-z0-9_-]{16,64})(?:[/?#]|$)/);
  if (inLink) return inLink[1];
  return /^[A-Za-z0-9_-]{16,64}$/.test(text) ? text : null;
}

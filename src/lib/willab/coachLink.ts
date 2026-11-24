/* -------------------------------------------------------------------------- */
/*  THE COACH'S LINK, SIGNED OUT (founder 2026-10-21, WIL-93)                  */
/*                                                                            */
/*  The WhatsApp, push and email links open the coach's bubble in the chat    */
/*  (`/chat?take=<session_id>`, backend N691 item 3). Tapped where the        */
/*  speaker is not signed in (WhatsApp's or the mail app's browser, a new     */
/*  phone), the link goes to log in and comes back to itself; login and       */
/*  sign-up both honour `redirectTo`.                                          */
/*                                                                            */
/*  Once per link per tab: should the server hold a session the browser does  */
/*  not (a refresh that failed offline), /login sends the speaker straight    */
/*  back here, and a second trip would never end. The rule is pure; the       */
/*  surface asks it and keeps the mark.                                        */
/* -------------------------------------------------------------------------- */

const SENT_KEY = "willab.coach_link_login";

export function coachLinkLogin(link: {
  /** The link asks for the coach's bubble (`?take=`, chatLink.ts). */
  coach: boolean;
  signedIn: boolean | null;
  /** The link as opened: path and query. */
  path: string;
  /** The link this tab already sent to log in, if any. */
  sentBefore: string | null;
}): string | null {
  if (link.signedIn !== false || !link.coach || link.sentBefore === link.path) return null;
  return `/login?redirectTo=${encodeURIComponent(link.path)}`;
}

/** The link this tab sent to log in (sessionStorage; null when blocked). */
export function readCoachLinkSent(): string | null {
  try {
    return window.sessionStorage.getItem(SENT_KEY);
  } catch {
    return null;
  }
}

export function markCoachLinkSent(path: string | null): void {
  try {
    if (path) window.sessionStorage.setItem(SENT_KEY, path);
    else window.sessionStorage.removeItem(SENT_KEY);
  } catch {
    /* storage blocked: the guard is gone, the link still goes to log in */
  }
}

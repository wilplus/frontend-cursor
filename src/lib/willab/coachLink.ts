/* -------------------------------------------------------------------------- */
/*  THE COACH'S LINK, SIGNED OUT (founder 2026-10-21, WIL-93)                  */
/*                                                                            */
/*  The WhatsApp and email links open the coach's feedback (`?lens=<arc>`,     */
/*  `?idealArc=<arc>&feedback=1`). Tapped where the speaker is not signed in   */
/*  (WhatsApp's or the mail app's browser, a new phone), the page showed the   */
/*  guest's "Done" screen, whose "Create an account" went to /signup without   */
/*  the link: an account holder who logged in from there landed on the chat,  */
/*  not on the feedback. The link now goes to log in and comes back to        */
/*  itself; login and sign-up both honour `redirectTo`.                        */
/*                                                                            */
/*  The lens writes `?lens=` into the bar for its own walk too, so a guest who */
/*  reloads mid-Take can carry it: a project this device holds as a guest's    */
/*  work stays where it is, on the guest's own screens.                        */
/*                                                                            */
/*  Once per link per tab: should the server hold a session the browser does  */
/*  not (a refresh that failed offline), /login sends the speaker straight    */
/*  back here, and a second trip would never end. The rule is pure; the       */
/*  surface asks it and keeps the mark.                                        */
/* -------------------------------------------------------------------------- */

const SENT_KEY = "willab.coach_link_login";

export function coachLinkLogin(link: {
  /** The project the link opens (`idealArc`, else `lens`). */
  arcId: string | null;
  /** "feedback" for the coach's links (see /chat's page). */
  mode: "feedback" | "review" | null;
  signedIn: boolean | null;
  /** The projects this device is working on as a guest. */
  guestArcIds: readonly (string | null | undefined)[];
  /** The link as opened: path and query. */
  path: string;
  /** The link this tab already sent to log in, if any. */
  sentBefore: string | null;
}): string | null {
  if (link.signedIn !== false || link.mode !== "feedback" || !link.arcId) return null;
  if (link.guestArcIds.includes(link.arcId) || link.sentBefore === link.path) return null;
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

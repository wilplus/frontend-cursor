/* -------------------------------------------------------------------------- */
/*  THE COACH PANEL'S ONE SWITCH (founder lock 2026-10-06, the coach panel     */
/*  redrawn; build plan P0)                                                    */
/*                                                                            */
/*  The new panel is built behind this and nothing else, the same way as the  */
/*  Feedback walk's switch (feedbackWalkSwitch.ts). It is on only when the     */
/*  deploy says so (NEXT_PUBLIC_COACH_PANEL_V2=on), or, outside production,    */
/*  when the page's address carries ?coach2=1 so a developer can look at it    */
/*  without a redeploy. Production never reads the address: a shared link     */
/*  cannot turn an unapproved surface on for a coach.                          */
/*                                                                            */
/*  Off, the coach's Lounge door is exactly today's. The switch is not flipped */
/*  until the founder approves the pictures (P6) and the diagnosis endpoint    */
/*  exists.                                                                    */
/* -------------------------------------------------------------------------- */

export type CoachPanelSwitchEnv = {
  /** process.env.NEXT_PUBLIC_COACH_PANEL_V2 */
  flag?: string | undefined;
  /** process.env.NODE_ENV */
  nodeEnv?: string | undefined;
  /** window.location.search, or "" on the server */
  search?: string | undefined;
};

/** Pure: the decision, from its three inputs. */
export function coachPanelSwitchFrom({ flag, nodeEnv, search }: CoachPanelSwitchEnv): boolean {
  if (flag === "on") return true;
  if (nodeEnv === "production") return false;
  if (!search) return false;
  return new URLSearchParams(search).get("coach2") === "1";
}

/** Is the new coach panel on for this page? */
export function coachPanelOn(): boolean {
  return coachPanelSwitchFrom({
    flag: process.env.NEXT_PUBLIC_COACH_PANEL_V2,
    nodeEnv: process.env.NODE_ENV,
    search: typeof window === "undefined" ? "" : window.location.search,
  });
}

/** The same decision on the server, for a page that picks between today's
 *  screen and the panel's before anything is drawn (the founder's Library and
 *  Speaking errors pages, Q-CP645 A): `searchParams` is the page's own. */
export function coachPanelOnForPage(searchParams?: Record<string, string | string[] | undefined>): boolean {
  const coach2 = searchParams?.coach2;
  return coachPanelSwitchFrom({
    flag: process.env.NEXT_PUBLIC_COACH_PANEL_V2,
    nodeEnv: process.env.NODE_ENV,
    search: coach2 === "1" ? "?coach2=1" : "",
  });
}

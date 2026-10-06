/* -------------------------------------------------------------------------- */
/*  THE FEEDBACK WALK'S ONE SWITCH (founder lock 2026-10-06; build plan P1)    */
/*                                                                            */
/*  The walk is built behind this and nothing else. It is on only when the     */
/*  deploy says so (NEXT_PUBLIC_FEEDBACK_WALK=on), or, outside production, when */
/*  the page's address carries ?walk=1 so a developer can look at it without a */
/*  redeploy. Production never reads the address: a shared link cannot turn   */
/*  an unapproved surface on for a speaker.                                    */
/*                                                                            */
/*  Nothing live reads it yet (P1). Phase 6 switches it on, and only after the */
/*  founder approves the pictures.                                             */
/* -------------------------------------------------------------------------- */

export type WalkSwitchEnv = {
  /** process.env.NEXT_PUBLIC_FEEDBACK_WALK */
  flag?: string | undefined;
  /** process.env.NODE_ENV */
  nodeEnv?: string | undefined;
  /** window.location.search, or "" on the server */
  search?: string | undefined;
};

/** Pure: the decision, from its three inputs. */
export function walkSwitchFrom({ flag, nodeEnv, search }: WalkSwitchEnv): boolean {
  if (flag === "on") return true;
  if (nodeEnv === "production") return false;
  if (!search) return false;
  return new URLSearchParams(search).get("walk") === "1";
}

/** Is the Feedback walk on for this page? */
export function feedbackWalkOn(): boolean {
  return walkSwitchFrom({
    flag: process.env.NEXT_PUBLIC_FEEDBACK_WALK,
    nodeEnv: process.env.NODE_ENV,
    search: typeof window === "undefined" ? "" : window.location.search,
  });
}

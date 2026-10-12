"use client";

/* -------------------------------------------------------------------------- */
/*  The Lounge's door for a coach (founder 2026-09-30, A7; build plan P2-8).    */
/*                                                                            */
/*  Mounted by the Lounge only when the user is a coach. The door is the       */
/*  redrawn coach panel's (CoachPanelDoor, founder lock 2026-10-06): the       */
/*  founder made it permanent on 2026-10-11 ("keep the new designs, make them */
/*  permanent"), so the old door and the switch that chose between them are   */
/*  gone. The Lounge still mounts this one file, so it gains no branch.       */
/* -------------------------------------------------------------------------- */

import { CoachWalkBubble } from "./CoachWalkBubble";
import CoachPanelDoor from "../coachpanel/CoachPanelDoor";

export { CoachWalkBubble };

type EntryProps = {
  /** The thread bubble; off where the host draws its own. */
  bubble?: boolean;
};

export default function CoachWalkEntry({ bubble }: EntryProps) {
  return <CoachPanelDoor bubble={bubble} />;
}

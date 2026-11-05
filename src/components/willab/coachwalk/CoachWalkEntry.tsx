"use client";

/* -------------------------------------------------------------------------- */
/*  The Lounge's door for a coach (founder 2026-09-30, A7; build plan P2-8).    */
/*                                                                            */
/*  Mounted by the Lounge only when the user is a coach. It draws nothing of   */
/*  its own in Will's chat: the way in is the row in the list of chats         */
/*  (CoachChatRow, backend N521); the door keeps the panel mounted under it,  */
/*  so the row and a goal card's "Open speaker" both open it.                 */
/* -------------------------------------------------------------------------- */

import CoachPanelDoor from "../coachpanel/CoachPanelDoor";

export default function CoachWalkEntry() {
  return <CoachPanelDoor />;
}

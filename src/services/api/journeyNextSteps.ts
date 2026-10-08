import { bffFetch } from "@/lib/api/bffFetch";

export async function postJourneyNextSteps(arcId: string): Promise<boolean> {
  const result = await bffFetch(
    `/api/v2/explore/arc/${encodeURIComponent(arcId)}/journey/next-steps`,
    { method: "POST", cache: "no-store" }
  );
  return result.kind === "response" && result.ok;
}

/* -------------------------------------------------------------------------- */
/*  THE LOUNGE'S TAKE 1–3 JOURNEY MESSAGES, POSTED WHEN THE TAKE IS SAVED      */
/*  (founder 2026-10-08, Q-IT643 A; with Q-B10 A, which removed "See next     */
/*  steps", the button that used to post them).                               */
/*                                                                            */
/*  A signed-in speaker's Take counts once its processing has finished and    */
/*  its text has landed: that is the moment the processing marker settles,   */
/*  in the Lab or in the Lounge, whichever is on screen. The backend picks   */
/*  the message for the Take it counts and keys it on (user, project, Take), */
/*  so a second post for the same Take is a no-op, never a duplicate. Takes  */
/*  past the third have no message (the backend answers 409), so they are    */
/*  not asked. A guest has no account to post to and is never asked.         */
/* -------------------------------------------------------------------------- */
export async function postJourneyForSavedTake(
  take: { arcId: string | null; takeIndex: number | null },
  signedIn: boolean | null,
): Promise<boolean> {
  if (signedIn !== true || !take.arcId) return false;
  const index = take.takeIndex;
  if (index !== null && (index < 1 || index > 3)) return false;
  return postJourneyNextSteps(take.arcId).catch(() => false);
}

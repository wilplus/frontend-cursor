import { isLabOverlay, type WillabState } from "./useWillabFlow";

/* -------------------------------------------------------------------------- */
/*  When the Lounge may mount the top-up card.                                */
/*                                                                            */
/*  A plain .ts on purpose, mirroring speakerSexAskGate.ts: vitest here runs   */
/*  with no JSX transform, so a rule kept inside a .tsx cannot be tested at    */
/*  all. This one decides when a PAYMENT offer may appear, which is exactly    */
/*  the kind of rule that has to be testable.                                  */
/* -------------------------------------------------------------------------- */

/**
 * May the top-up card be mounted in this flow state?
 *
 * `isLabOverlay` covers lab_recording AND lab_processing / readout / sendgate:
 * the whole span where the Lab owns the screen, not merely where it owns the
 * mic. An upgrade offer surfacing mid-take is precisely what the LIVE LOOP
 * fence forbids — and it would be the worst possible moment for one, since
 * running out of tokens never blocks a recording in the first place.
 * `lab_project_pick` sits outside that set (it precedes the Lab) but is still
 * setup, so it is excluded too.
 *
 * This answers "may we mount at all", never "should this person be offered a
 * plan". That second question lives in one place, LoungeTopUpCard, alongside
 * the balance, tier and snooze checks — splitting it across two owners is how
 * the speaker-sex card's four states nearly drifted apart.
 */
export function canMountTopUpCard(
  state: WillabState,
  threadLoading: boolean
): boolean {
  if (threadLoading) return false;
  if (state === "lab_project_pick") return false;
  return !isLabOverlay(state);
}

import { isLabOverlay, type WillabState } from "./useWillabFlow";

/* -------------------------------------------------------------------------- */
/*  When the Lounge may mount the speaker-sex ask.                            */
/*                                                                            */
/*  A plain .ts on purpose. vitest here runs with a minimal config and no JSX  */
/*  transform, so a test that imports a .tsx cannot even parse — which is why  */
/*  this repo has no component tests. Keeping the rule out of the component    */
/*  keeps it testable without dragging a JSX pipeline and jsdom into the       */
/*  toolchain for one predicate.                                              */
/* -------------------------------------------------------------------------- */

/**
 * May the ask be mounted in this flow state?
 *
 * `isLabOverlay` covers lab_recording AND lab_processing / readout / sendgate:
 * the whole span where the Lab owns the screen, not merely where it owns the
 * mic. A profile question surfacing mid-take, or over a readout someone is
 * reading, is the interruption this exists to avoid — and a card that can
 * appear over a running record→transcribe→coach loop is what the LIVE LOOP
 * fence forbids. `lab_project_pick` sits outside that set (it precedes the Lab)
 * but is still setup, so it is excluded here too.
 *
 * This answers "may we mount at all", never "should we ask this person". That
 * second question has exactly one owner, `shouldAskSex` — two places deciding
 * it is how the four states (never asked / declined / backend has no column /
 * locally snoozed) drift apart.
 */
export function canMountSpeakerSexAsk(
  state: WillabState,
  threadLoading: boolean
): boolean {
  if (threadLoading) return false;
  if (state === "lab_project_pick") return false;
  return !isLabOverlay(state);
}

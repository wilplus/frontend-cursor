"use client";

import SpeakerSexPrompt from "./SpeakerSexPrompt";
import { canMountSpeakerSexAsk } from "./speakerSexAskGate";
import { type WillabState } from "./useWillabFlow";

/* -------------------------------------------------------------------------- */
/*  Lounge mount for the one-time speaker-sex ask.                            */
/*                                                                            */
/*  WHY A SECOND MOUNT. The dashboard card could not reach the people who     */
/*  most need asking. Both signup routes land on /chat, not /dashboard:       */
/*  the email form redirects here, and Google/LinkedIn go through             */
/*  /auth/callback → /auth/oauth-complete, which `router.replace`s to /chat.  */
/*  OAuth users never even see the signup field, since that lives in          */
/*  SignupForm and OAuth never posts to /api/auth/signup. So for them there   */
/*  was no ask at all, and the backend fell back to guessing sex from their   */
/*  pitch baseline — which works, but is a guess, and for male speakers a     */
/*  wrong guess inverts their strongest cue. A production check found ZERO    */
/*  declared speakers and six of nine routed on that acoustic guess.          */
/*                                                                            */
/*  IN-THREAD, NOT LAYERED. This renders as the last item INSIDE the thread's */
/*  scroll container, so it is ordinary conversation content: it scrolls with */
/*  the thread and cannot cover anything. That is the whole reason it is safe */
/*  here. The Lounge already layers CoachReview / Insights /                  */
/*  BestPresentation / ideal-text, and adding another overlay to that stack   */
/*  — one that could appear over a running record→transcribe→coach loop —     */
/*  is exactly what the LIVE LOOP fence forbids.                              */
/*                                                                            */
/*  Like DashboardSpeakerSexPrompt, this holds ONLY the mount-shaped rule.    */
/*  Every decision about whether to ask at all (never asked vs. declined vs.  */
/*  backend-has-no-column vs. locally snoozed) stays in SpeakerSexPrompt and  */
/*  its single `shouldAskSex` guard — two places deciding that is how the     */
/*  four states drift apart.                                                  */
/* -------------------------------------------------------------------------- */

export interface LoungeSpeakerSexPromptProps {
  /** The flow state, so we can stay out of the Lab's way. */
  state: WillabState;
  /** True while the thread is still fetching — no card above a skeleton. */
  threadLoading?: boolean;
}

export default function LoungeSpeakerSexPrompt({
  state,
  threadLoading = false,
}: LoungeSpeakerSexPromptProps) {
  if (!canMountSpeakerSexAsk(state, threadLoading)) return null;
  return <SpeakerSexPrompt className="mt-1 w-full" />;
}

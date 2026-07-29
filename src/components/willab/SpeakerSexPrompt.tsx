"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SpeakerSexQuestion from "./SpeakerSexQuestion";
import {
  saveUserProfile,
  shouldAskSex,
  type ProfileSex,
} from "@/services/api/userProfile";
import { useUserProfile } from "./useUserProfile";

/* -------------------------------------------------------------------------- */
/*  SpeakerSexPrompt — the one-time ask for users who already have accounts    */
/*                                                                            */
/*  Every account that existed before BE PR #288 has `sex = NULL`, and their   */
/*  takes are being ranked with sex-blind cue weights right now. The signup    */
/*  field cannot reach them (and does not reach LinkedIn/Google signups at     */
/*  all, since those never hit POST /api/auth/signup), so this is the surface  */
/*  that actually does the work.                                              */
/*                                                                            */
/*  Deliberately an INLINE, NON-BLOCKING card rather than an overlay: the      */
/*  Lounge already layers CoachReview / Insights / BestPresentation / ideal-   */
/*  text, and a modal that can appear over a running record→transcribe→coach   */
/*  loop is exactly what the LIVE LOOP fence exists to stop. Nothing here      */
/*  steals focus, blocks input, or gates a surface.                            */
/*                                                                            */
/*  ── The distinction that matters ──                                         */
/*  "Prefer not to say" and "dismiss" are NOT the same event and must not      */
/*  collapse into one:                                                         */
/*                                                                            */
/*    Prefer not to say → POST "prefer_not_to_say". A deliberate decline. The  */
/*      BE treats it as a HARD OPT-OUT and additionally suppresses its own     */
/*      acoustic fallback, so it never guesses for this user. Never re-asked.  */
/*                                                                            */
/*    Dismiss (Not now)  → POST NOTHING. Local snooze only, so `sex` stays     */
/*      NULL and the BE's acoustic fallback stays available. Asked again on a  */
/*      later visit.                                                          */
/*                                                                            */
/*  Mapping a casual dismissal onto "prefer_not_to_say" would silently strip   */
/*  those users of the fallback on the strength of them closing a card. The    */
/*  reverse (posting a guess on the user's behalf) is worse still: a guess the */
/*  FE writes becomes a STORED claim about them and would overwrite a real     */
/*  answer, so this component only ever sends a value the user clicked.        */
/* -------------------------------------------------------------------------- */

/** Local-only. Suppresses re-asking after a dismissal without telling the BE
 *  anything. Not per-user: on a shared browser one user's snooze can suppress
 *  another's ask, whose only cost is that the BE keeps using the sex-blind
 *  fallback (un-improved, never wrong) until they answer from /profile. */
const SNOOZE_KEY = "willab.speakerSex.snoozed";

export interface SpeakerSexPromptProps {
  className?: string;
}

export default function SpeakerSexPrompt({ className }: SpeakerSexPromptProps) {
  const { profile } = useUserProfile();
  const [choice, setChoice] = useState<ProfileSex | null>(null);
  const [saving, setSaving] = useState(false);
  // `done` covers the window between a successful save and the next profile
  // refetch, when `profile.sex` is still the stale NULL that got us here.
  const [done, setDone] = useState(false);
  // Starts `true` so the card cannot flash before we have read localStorage.
  const [snoozed, setSnoozed] = useState(true);

  useEffect(() => {
    try {
      setSnoozed(window.localStorage.getItem(SNOOZE_KEY) === "1");
    } catch {
      // Private mode / storage disabled: fall through to asking. Being asked
      // again is a smaller cost than never being asked at all.
      setSnoozed(false);
    }
  }, []);

  if (done || snoozed || !shouldAskSex(profile)) return null;

  const submit = async (value: ProfileSex) => {
    setSaving(true);
    // Partial update — sending `sex` alone cannot clear the user's domain/goal.
    const ok = await saveUserProfile({ sex: value });
    setSaving(false);
    if (!ok) {
      // Leave the card up and the choice selected so the retry is one click.
      toast.error("Could not save that. Please try again.");
      return;
    }
    setDone(true);
  };

  const dismiss = () => {
    try {
      window.localStorage.setItem(SNOOZE_KEY, "1");
    } catch {
      /* non-fatal: worst case we ask again next visit */
    }
    setSnoozed(true);
  };

  return (
    <div
      className={[
        "rounded-xl border border-border bg-muted/30 p-4",
        className ?? "",
      ].join(" ")}
    >
      <SpeakerSexQuestion
        value={choice}
        onChange={(v) => {
          setChoice(v);
          void submit(v);
        }}
        disabled={saving}
      />

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={dismiss}
          disabled={saving}
          className="text-muted-foreground"
        >
          Not now
        </Button>
      </div>
    </div>
  );
}

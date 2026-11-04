/** The announcement sheet's own words (RingAnnouncementSheet). Each is a
 *  placeholder until the founder signs it; the sheet shows nothing while any
 *  word it would show still starts with UNSIGNED (Never 4). */
export const UNSIGNED = "[founder copy]";

export const ANNOUNCEMENT_COPY = {
  notNow: "[founder copy] Not now",
  yes: "[founder copy] Yes",
  yesToDataChoices: "[founder copy] Turn on in my data choices",
  policyMissing:
    "[founder copy] This choice will be available once the policy is in place.",
  dismiss: "[founder copy] Close",
} as const;

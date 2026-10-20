/* -------------------------------------------------------------------------- */
/*  Open speaker — the coach's goal card in the Lounge opens the coach panel  */
/*  on that speaker (WIL-74, founder 2026-10-19). The card and the panel do   */
/*  not share state: the card asks with a window event, the panel's door      */
/*  (CoachPanelDoor) listens and opens the speaker by their pseudonym.        */
/* -------------------------------------------------------------------------- */

export const OPEN_SPEAKER_EVENT = "willab:open-speaker";

export type OpenSpeakerDetail = { pseudonym: string };

export function requestOpenSpeaker(pseudonym: string): void {
  if (typeof window === "undefined" || !pseudonym) return;
  window.dispatchEvent(new CustomEvent<OpenSpeakerDetail>(OPEN_SPEAKER_EVENT, { detail: { pseudonym } }));
}

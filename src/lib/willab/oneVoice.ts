/* -------------------------------------------------------------------------- */
/*  oneVoice — one voice at a time (backend N372 item 3).                     */
/*                                                                            */
/*  Playing a voice message pauses the one already playing, and opening the  */
/*  mic pauses any that plays, so a recording never picks up the app's own    */
/*  playback.                                                                 */
/* -------------------------------------------------------------------------- */

let playing: HTMLMediaElement | null = null;

/** Play this one, pausing whichever played before it. */
export function playOnly(el: HTMLMediaElement): Promise<void> {
  if (playing && playing !== el) playing.pause();
  playing = el;
  return el.play();
}

/** The mic is opening: pause whatever plays. */
export function hushVoices(): void {
  playing?.pause();
  playing = null;
}

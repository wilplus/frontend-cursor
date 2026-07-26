/* -------------------------------------------------------------------------- */
/*  waitingTips — what to read while the app is working                        */
/*                                                                            */
/*  ONE tip per waiting session, not a carousel: a line that swaps under you   */
/*  while you are reading it is worse than no line at all, and the wait is     */
/*  usually short enough that a single thought lands better than three.        */
/*                                                                            */
/*  Deliberately no "did you know" statistics. Almost every famous public-     */
/*  speaking number is a misquote (the "93% of communication is nonverbal"     */
/*  line misreads a study about something much narrower), and a loading screen */
/*  that contradicts the coaching is worse than a loading screen with nothing  */
/*  on it. Everything here is mechanical and checkable.                        */
/* -------------------------------------------------------------------------- */

export const WAITING_TIPS: readonly string[] = [
  // Environment
  "A small room with soft furniture beats a big empty one. Curtains, a sofa and a rug soak up the echo that makes a recording sound thin.",
  "Point your phone away from a bare wall. Sound bounces straight back off it and lands in your mic twice.",
  // Practising with people
  "One listener is enough. Almost everything you would fix in front of fifty people shows up in front of one.",
  "Ask your listener what they remember an hour later, not whether it was good. What survives the hour is what the room actually keeps.",
  // Posture and breath
  "Standing changes the sound before it changes the nerves. An open ribcage gives you longer breaths, and longer breaths give you longer sentences.",
  "If your voice thins out near the end of a line, you ran out of air, not confidence. Take the breath one clause earlier.",
  "Unlock your knees and let your jaw hang for a second before you start. Both are places tension parks itself without asking.",
  // Craft
  "The pause you are afraid of is shorter than it feels. On a recording it is usually about a second.",
  "Say the claim first, then the evidence. An audience follows a point they already know the shape of.",
  "Rehearsing the interruption is worth more than rehearsing the talk. The talk rarely goes as planned; the interruption always comes.",
];

/** One tip at random. Call this ONCE per waiting session (after mount, so the
 *  server and the client never disagree about which one was picked). */
export function pickWaitingTip(): string {
  return WAITING_TIPS[Math.floor(Math.random() * WAITING_TIPS.length)];
}

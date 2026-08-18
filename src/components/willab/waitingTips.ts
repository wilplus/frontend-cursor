/* -------------------------------------------------------------------------- */
/*  waitingTips — what to read while the app is working                        */
/*                                                                            */
/*  A stable, scrollable collection: nothing moves while the person is reading */
/*  and the exact scroll position survives every processing screen.            */
/*                                                                            */
/*  Deliberately no "did you know" statistics. Almost every famous public-     */
/*  speaking number is a misquote (the "93% of communication is nonverbal"     */
/*  line misreads a study about something much narrower), and a loading screen */
/*  that contradicts the coaching is worse than a loading screen with nothing  */
/*  on it. Everything here is mechanical and checkable.                        */
/* -------------------------------------------------------------------------- */

export const WAITING_TIPS: readonly string[] = [
  "Try naming the feeling as excitement. The physical energy can stay while your interpretation of it becomes more useful.",
  "Move before you rehearse. A short walk or a few loose shoulder rolls can help interrupt the loop of overthinking.",
  "Shrink the room into one conversation. Picture one real person who needs the idea, and speak to them.",
  "Step into the presenter role: your job is to guide the audience through one useful idea, not to perform a perfect version of yourself.",
  "Notice the internal critic, then give it a smaller job: checking one fact or one transition, not judging the whole performance.",
  "Choose a ritual that matches what you need. Use movement or music for energy; use slower breathing and quiet for steadiness.",
  "Lead with the part you genuinely care about. Real enthusiasm gives your voice a reason to move.",
  "Treat stress as information. Ask what feels underprepared, then rehearse that exact opening, transition, or conclusion.",
  "Practise somewhere you feel physically at ease. Familiar surroundings can leave more attention for the message.",
  "Put the audience's value ahead of flawless delivery. A useful idea can land even when a sentence is not perfect.",
  "Make rehearsal slightly demanding and the real delivery slightly simpler: practise standing, with a timer, then remove the timer pressure when you present.",
  "A light industry observation can make an opening warmer when it is true, relevant, and natural in your voice.",
];

/** One tip at random. Call this ONCE per waiting session (after mount, so the
 *  server and the client never disagree about which one was picked). */
export function pickWaitingTip(): string {
  return WAITING_TIPS[Math.floor(Math.random() * WAITING_TIPS.length)];
}

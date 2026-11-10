/* -------------------------------------------------------------------------- */
/*  The words of a host's own chat on screen that the frontend writes         */
/*  (backend N578, N579, N584, N587). Will's own lines, a host's own words    */
/*  and the backend's drafted lines ("{n} people asked: {question}", "Record */
/*  one answer", the setup's questions) come from the backend and are not     */
/*  here.                                                                     */
/*                                                                            */
/*  DRAFTED, waiting for the founder's OK (Never 4; backend N593's last       */
/*  line): every line below but the two headings. They are drawn only behind */
/*  the ring row `chat_builder` (N579 item 2), which has no row yet, so       */
/*  nobody sees them until the founder adds people to it. Sign them first.   */
/* -------------------------------------------------------------------------- */

/** The builder (N579 item 1): its way in, under "Your assistant is live."
 *  in Will's chat, uses the backend's own "Set up my chat". */
export const BUILDER_COPY = {
  welcome: "Welcome",
  welcomeHint: "What people read first when they open your chat.",
  addLine: "Add a line",
  questions: "Questions in the first Take",
  questionsHint: "Start from Artur's five: keep, change, add or remove.",
  answersHint: "Answers to tap, one per line",
  addQuestion: "Add a question",
  remove: "Remove",
  answerWith: "How people answer",
  tap: "Tap answers",
  type: "Type",
  record: "Record",
  save: "Save",
  saved: "Saved",
  notSaved: "Not saved. Try again.",
} as const;

/** Under a Take, its answers gathered, for the sender only (N587 item 3).
 *  The two headings are the founder's words in N587 (signed); the rest is
 *  drafted. */
export const GATHER_COPY = {
  onSpeaking: "On your speaking",
  onMatter: "On the matter",
  answered: (names: string[]) => `${names.join(", ")} answered`,
  openChat: (name: string) => `Open your chat with ${name}`,
  close: "Close",
} as const;

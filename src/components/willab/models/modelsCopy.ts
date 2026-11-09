/* -------------------------------------------------------------------------- */
/*  The AI models' words (backend services/model_launchpad.py, WORDS; N566    */
/*  item 1: the locked prototype's words are signed).                         */
/*                                                                            */
/*  Almost every word on these screens arrives in the backend's answers. The  */
/*  few here are the ones a screen draws itself: copied from WORDS exactly,   */
/*  never reworded (Never 4). TO_SIGN holds the words the locked prototype    */
/*  shows that WORDS does not carry yet; they are listed under "Words to      */
/*  sign" in the pull request until the founder signs them or WORDS takes     */
/*  them.                                                                     */
/* -------------------------------------------------------------------------- */

/** Copied from backend WORDS, key for key. */
export const MODELS_WORDS = {
  row_models: "AI models",
  filter_ready: "Ready to use",
  public: "Public",
  private: "Private",
  your_draft: "Your draft",
  teach_it: "Teach it",
  use_it: "Use it",
  open: "Open",
  try_it: "Try it",
  continue: "Continue",
  start_your_own: "Start your own",
  search_empty_start: "Start the first one",
  search_empty_clear: "Clear the search",
  door_yes: "This is my field",
  door_no: "Not now",
  judge_title: "Judge this moment",
  audio_unclear: "Audio unclear",
  skip: "Skip",
  words_step: "Now say how you would answer them, in your own words.",
  record_answer: "Record your answer",
  keep_teaching: "Keep teaching",
  back_to_list: "Back to the list",
  queue_start: "Start",
  queue_add: "Add an example you know well",
  pause: "Pause",
  queue_empty_back: "Back to your chats",
  add_title: "Add an example",
  add_intro: "Do you know a case this model should learn from? Add it, then answer it yourself.",
  add_record: "Record one",
  add_record_line: "Say the case in your own voice",
  add_upload: "Upload a file",
  add_upload_line: "A recording, a photo or a written case",
  add_counts_once: "It counts once another teacher agrees with your answer.",
  release_not_yet: "Not yet",
  profile_section: "AI models",
} as const;

/** Copied from backend services/model_api.py WORDS, key for key: the few a
 *  screen draws itself, as the label of its way in. Everything else on the
 *  API and money screens arrives in the backend's answers. */
export const MODEL_API_WORDS = {
  use_it: "Use it in your business",
  try_it: "Try it",
  price_title: "Set your price",
  usage_title: "Your usage",
  earn_title: "Your earnings",
  download_title: "Download its data",
} as const;

/** The backend's JUDGE_ANSWERS: a voice model asking these is drawn as the
 *  coach panel's Judge, with its faces (N563 item 2). */
export const JUDGE_ANSWERS = ["Yes", "In-between", "No"] as const;
export const JUDGE_FACES: Record<string, string> = { Yes: "👍", "In-between": "😐", No: "👎" };

/** The backend's private_example_note (MOD-18), with its curly apostrophe. */
export function privateExampleNote(modelName: string): string {
  return `Your company’s own example: it teaches only ${modelName}.`;
}

/** Words the locked prototype shows that backend WORDS does not carry yet:
 *  "Words to sign" (Never 4). */
export const TO_SIGN = {
  searchPlaceholder: "Search models: pitching, interviews, hair care",
  whatDoIGetLine: "For teachers, for founders of a model, and for businesses",
  pageTryNow: "You can try it now. Businesses can pay to use it once it passes its final exam.",
  waiting: "waiting",
  of: "of",
} as const;

/** "Speaking confidence · 1 of 12", the teaching screen's bar. */
export function teachCaption(model: string, index: number, total: number): string {
  return `${model} · ${index + 1} ${TO_SIGN.of} ${total}`;
}

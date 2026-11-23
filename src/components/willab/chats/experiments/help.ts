type Guide = { about: string; next: string; more?: string };

const steps = {
  ai: {
    about: "Training helps your chat learn from replies you keep. Experiments let you try out speaking feedback.",
    more: "Choose Training to teach your chat how you’d answer. Choose Experiments to see what the app hears in a speaking clip and which practice it suggests.",
    next: "Tap Training or Experiments so I know which one to open.",
  },
  training: {
    about: "Keep replies you would give yourself. They can help your chat learn how you like to answer.",
    next: "Tap a model option to choose what powers your chat.",
  },
  menu: {
    about: "Here you can try a speaking session or see an example of how the app suggests practice.",
    more: "Start a session to go through the questions in order. Open a sample reading to see what the experiment measures, or Practice rules to see how those measurements turn into a suggestion.",
    next: "Tap what you want to open. Use Next page to see more choices.",
  },
  consent: {
    about: "This step asks permission to use your answer in the experiment.",
    next: "Tap I agree to start, or Not now to leave. That choice tells me what you allow.",
  },
  upload: {
    about: "You can add a page for your speaking answer, like a slide you want to talk about.",
    next: "Tap Add a page to include one, or Skip to go straight to the questions.",
  },
  baseline: {
    about: "The first questions give the experiment an example of how you usually speak.",
    next: "Tap I said it when you finish speaking, or Skip this one to move to the next question.",
  },
  take: {
    about: "This question gives you something different to talk about so you can compare how you speak.",
    next: "Tap I said it when you finish speaking, or Skip this one to move to the next question.",
  },
  rating: {
    about: "How you felt is something only you can tell us. Your answers give context to the recording.",
    next: "Tap one option for energy and one for feeling, then Save this take. Tap Say it again if you want another try.",
  },
  reading: {
    about: "The experiment is preparing the speaking example. The reading shows things you can hear, like speed and loudness.",
    next: "The reading will open when it’s ready.",
  },
  analysis: {
    about: "Each row shows something about this part of the recording, like how fast or loud you spoke.",
    next: "Tap What to try to see which exercise the rules would suggest for this moment.",
  },
  "no-reading": {
    about: "The reading needs a saved take to show you a moment.",
    next: "Go back and save a take, or open a sample reading from the menu.",
  },
  pick: {
    about: "The pick shows which practice exercises match this speaking moment.",
    next: "Tap a practice option to try it, or The rules to see why it was picked.",
  },
  "pick-empty": {
    about: "This moment hasn’t matched any exercise closely enough.",
    next: "Tap The rules to see what would need to match, or Not this time to leave.",
  },
  rules: {
    about: "A rule says what the experiment listens for and how close a match it needs to suggest the exercise.",
    more: "The minimum match controls how close the clip must be. A cue is something you can hear, like loudness. Try changing one setting and open The pick to see what it does.",
    next: "Tap a bubble to change the rule, or The pick to see what it suggests.",
  },
  library: {
    about: "The prompt library is the list of questions you can speak about in an experiment.",
    next: "Tap Earlier or Later to look through the questions, or Change this to edit the one you see.",
  },
  "library-edit": {
    about: "This is where you write a question for someone to answer out loud.",
    next: "Use the question box to edit the words. Tap Save when they’re ready.",
  },
  export: {
    about: "CSV is useful for a spreadsheet. JSON is a copy that another app can read.",
    next: "Tap who the copy is for, then pick CSV or JSON to get the file.",
  },
  delete: {
    about: "Deleting removes your sessions, recordings, and readings from the experiment.",
    next: "Tap Keep it to leave, or Delete my data to review your choice.",
  },
  "delete-confirm": {
    about: "This is the last check before your experiment data is removed.",
    next: "Tap Yes, delete it to confirm, or No, keep it to cancel.",
  },
  deleted: {
    about: "Your experiment sessions and readings have been removed.",
    next: "Tap Done to go back to Experiments.",
  },
} satisfies Record<string, Guide>;

export type HelpStep = keyof typeof steps;

const topics = [
  {
    terms: /\b(trim\w*|cut off|live app|production|feedback walk|speaking coach)\b/i,
    short: "Use a normal Speaking Coach project Take to check the live Feedback Walk.",
    more: "Record a fresh Take and play the first feedback clip. Check that the app kept the whole thought before judging its pace.",
  },
  {
    terms: /\b(private|privacy|consent|permission|who (can|sees|gets)|data|sharing)\b/i,
    short: "You choose whether to join the experiment and whether to allow a researcher copy.",
    more: "Read the permission step before starting. In Your data, choose who the copy is for. Use Delete my data to remove your experiment sessions.",
  },
  {
    terms: /\b(threshold|minimum|stricter|looser|how close|match(ing)? score)\b/i,
    short: "The minimum match is how close a clip must be to the rule before the exercise is suggested.",
    more: "A looser rule accepts weaker matches, so it may show the exercise more often. A stricter rule asks for a closer match.",
  },
  {
    terms: /\b(loudness|pitch|cue|cell|volume|higher|lower|filler|pause|pace)\b/i,
    short: "A cue is one thing you can hear, like speed or loudness. Its value is what the rule looks for.",
    more: "Lower and Higher change the sound the rule looks for. The experiment compares that setting with what it heard in the clip.",
  },
  {
    terms: /\b(rule|rules|picker|the pick|suggest\w*|intervention\w*)\b/i,
    short: "The pick shows the suggested exercise. The rules say when to suggest it.",
    more: "Each exercise has a pattern of cues it looks for. The experiment checks the clip against those cues and shows up to two exercises that match well enough.",
  },
  {
    terms: /\b(worth it|improv\w*|did .* help|know .* (help|work)\w*)\b/i,
    short: "To check if an exercise helps, compare your first retry with a plain retry of a similar passage.",
    more: "Listen for the one thing you practised, like a clearer ending. Then try a new passage to see whether it sticks without a reminder.",
  },
  {
    terms: /\b(training.*experiment\w*|experiment\w*.*training)\b/i,
    short: steps.ai.about,
    more: steps.ai.more,
  },
  {
    terms: /\b(energy|feeling|calm|positive|challenging|baseline|rating\w*)\b/i,
    short: "The calm answers show how you usually speak. The other questions let you see what changes.",
    more: "Your energy and feeling choices describe your own experience. They give context to what the experiment hears in your voice.",
  },
  {
    terms: /\b(training|kept|teach|learns?|your own|standard)\b/i,
    short: "Training is where you keep replies you want your chat to learn from.",
    more: "Each kept reply is an example of how you’d answer. As you collect examples, the chat has more to learn from.",
  },
  {
    terms: /\b(experiment\w*|sample|example|test)\b/i,
    short: "Experiments let you compare speaking clips and try rules that suggest a practice exercise.",
    more: "Try a sample reading, open The rules, and change how close a match the exercise needs. Then go back to The pick to see what changed.",
  },
] as const;

const wantsMore = /\b(more|broader|further|deeper|detail\w*|example\w*|explain|what does (that|it) mean)\b/i;

export function stepHelp(step: HelpStep) {
  return steps[step];
}

/** A question can explain a choice. Only tapping the actual choice takes it. */
export function answerHelp(question: string, step: HelpStep, previousTopic: number) {
  const more = wantsMore.test(question);
  const match = topics.findIndex(({ terms }) => terms.test(question));
  const topic = match >= 0 ? match : more ? previousTopic : -1;
  const subject = topics[topic];
  const guide: Guide = steps[step];
  const explanation = more ? (subject?.more ?? guide.more ?? guide.about) : (subject?.short ?? guide.about);
  return { topic, answer: `${explanation} ${guide.next}` };
}

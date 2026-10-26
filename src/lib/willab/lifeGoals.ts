import type { ClashOption, HorizonKey, LifeGoal, SpaceKey, StepKey } from "@/services/api/lifeGoals";

/* -------------------------------------------------------------------------- */
/*  Life goals — the lens's rules that are not drawing (backend N172; rules:   */
/*  docs/flows/principles.md §1 M; prototype                       */
/*  https://claude.ai/artifact/HaWehtwfg1jzJvGeGM1c24, version 7).              */
/*                                                                            */
/*  Every line here is signed (N172). No new words without the founder's OK.  */
/* -------------------------------------------------------------------------- */

export const SPACES: Record<SpaceKey, { emoji: string; name: string; in: string }> = {
  personal: { emoji: "🏡", name: "Personal life", in: "in your personal life" },
  career: { emoji: "💼", name: "Career", in: "in your career" },
  good: { emoji: "🌍", name: "The greater good", in: "for the greater good" },
};
export const SPACE_ORDER: readonly SpaceKey[] = ["personal", "career", "good"];

export const LIFE_GOALS_COPY = {
  bar: "Life goals",
  whichSpace: "Which matters most right now?",
  hasGoal: "has a goal",
  soundsLike: (space: SpaceKey) => `That sounds like ${SPACES[space].emoji} ${SPACES[space].name}.`,
  yesSpace: (space: SpaceKey) => `Yes, ${SPACES[space].name.toLowerCase()}`,
  anotherSpace: "Another space",
  alreadyHas: (space: SpaceKey) => `${SPACES[space].emoji} ${SPACES[space].name} already has a goal:`,
  keepOrReplace: "Keep both, or let the new one replace it?",
  keepBoth: "Keep both",
  replace: "Replace it",
  wantMost: (space: SpaceKey) => `What do you truly want most ${SPACES[space].in}?`,
  youSaid: (said: string) => `You said: “${said}”`,
  fulfil: "What will actually fulfil you?",
  nature: "What fits your nature and strengths?",
  nothing: "I have nothing of yours to draft from yet. Let's do this another time.",
  draftLead: "Will's draft, from your words:",
  from: "From:",
  longRun: "Is this what you want in the long run, or something you want now?",
  theLongRun: "The long run",
  wantNow: "Something I want now",
  under: "What would having it give you?",
  underLead: "Then the goal may be under it:",
  heldWant: (want: string) => `“${want}” stays beside it, as a want you hold knowingly.`,
  ambitious: "Is it ambitious enough?",
  yes: "Yes",
  notYet: "Not yet",
  bigger: "Make it bigger:",
  giveUp: "What will you give up for it?",
  byWhen: "By when?",
  nearlyOver: "This quarter is nearly over, so let's aim at the next one.",
  setGoal: (space: SpaceKey) => `Noted. Your ${SPACES[space].name.toLowerCase()} goal is set.`,
  // N180, N183: the app is the base; the details go on paper, and the
  // speaker goes and lives it.
  notebookHead: "📓 Use your notebook!",
  notebook: "Keep the details in your own notebook, the paper one. Here we keep only the base.",
  goLive: "That's the base. Now go and live it. Come back for a short recap.",
  pickStep: "Tap the step that is wrong.",
  allRight: "All still right",
  now: "Now:",
  shouldSay: "What should it say?",
  keepChange: "Keep the change",
  talkToo: "This is your setup answer too. Changing it here changes it there.",
  stillGets: (text: string) => `Does “${text}” still get you there?`,
  stillFits: "Yes, it still fits",
  changeToo: "Change it too",
  changedOn: (date: string) => `Noted. Changed on ${date}.`,
  // N185: the clash between two goals (M12).
  whichWins: "When they clash, which wins?",
  eachTime: "I decide each time",
  clashNoted: "Noted. On both ladders:",
  whenClash: (who: string) => `when they clash, ${who}.`,
  wins: (label: string) => `${label.charAt(0).toLowerCase()}${label.slice(1)} wins`,
  youDecide: "you decide each time",
  // N172 M13, N186: the quarter comes back.
  didItMove: "Did it move?",
  outcomes: [
    { key: "got_there", emoji: "🎯", label: "It got there" },
    { key: "moved", emoji: "↗️", label: "It moved" },
    { key: "stalled", emoji: "⏸️", label: "It stalled" },
  ],
  inTheWay: "What got in the way?",
  notesToo: "Your notes said it too:",
  moveForward: (by: string) => `What would move it forward by ${by}?`,
  // N197: the ladders on the Life Panel's Goals screen (M15).
  history: "History",
  hideHistory: "Hide history",
  setOn: (date: string) => `Set on ${date}`,
  addGoal: "＋ Add a goal",
  noted: "Noted.",
  accept: "Accept",
  edit: "Edit",
  keepGoal: "Keep this goal",
  next: "Next",
  skip: "Skip",
  back: "Back",
  done: "Done",
  close: "Close",
  field: "Say it or type it",
  typeInstead: "Type instead",
  labels: {
    goal: "LIFE GOAL",
    want: "A WANT, HELD KNOWINGLY",
    give: "GIVING UP",
    y10: "IN TEN YEARS",
    y3: "IN THREE YEARS",
    y1: "IN A YEAR",
    quarter: "THIS QUARTER",
    nextQuarter: "NEXT QUARTER",
    talk: "TALK GOAL",
    clash: "WHEN THEY CLASH",
  },
  by: (when: string) => `by ${when}`,
  changed: (date: string) => `changed ${date}`,
  earlier: "Earlier:",
} as const;

export const HORIZONS: readonly { key: HorizonKey; emoji: string; label: string }[] = [
  { key: "1y", emoji: "🌱", label: "1 year" },
  { key: "3y", emoji: "🌿", label: "3 years" },
  { key: "10y", emoji: "🌳", label: "10 years" },
  { key: "life", emoji: "♾️", label: "A lifetime" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "October 2029" n years from today; ten years and more, the year alone. */
export function yearsAhead(today: Date, years: number): string {
  const year = today.getFullYear() + years;
  return years >= 10 ? String(year) : `${MONTHS[today.getMonth()]} ${year}`;
}

const STEP_YEARS: Record<StepKey, number> = { y10: 10, y3: 3, y1: 1 };

export function stepDate(today: Date, step: StepKey): string {
  return yearsAhead(today, STEP_YEARS[step]);
}

/** The horizon's date on the ladder; a lifetime has none. */
export function horizonDate(today: Date, horizon: HorizonKey): string | null {
  if (horizon === "life") return null;
  return yearsAhead(today, { "1y": 1, "3y": 3, "10y": 10 }[horizon]);
}

/** The steps worked back from a horizon, far to near (M9). */
export const STEPS_BACK: Record<HorizonKey, readonly StepKey[]> = {
  "1y": [],
  "3y": ["y1"],
  "10y": ["y3", "y1"],
  life: ["y10", "y1"],
};

/** The question that asks for a step, aimed at the step above it. */
export function stepQuestion(aboveDate: string | null, date: string): string {
  return aboveDate
    ? `For it to be true by ${aboveDate}, where must it be by ${date}?`
    : `It's a lifetime goal. Where must it be by ${date}?`;
}

const WEEKS = [
  "no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
];

const DAY_MS = 86_400_000;

/** The quarter's last day, with the four-week rule (M9): with less than four
 *  weeks left, the next quarter's. */
export function quarterEnd(today: Date): { by: string; weeks: string; next: boolean } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const ends: Date[] = [];
  for (const year of [start.getFullYear(), start.getFullYear() + 1]) {
    for (const [month, day] of [[2, 31], [5, 30], [8, 30], [11, 31]] as const) ends.push(new Date(year, month, day));
  }
  const index = ends.findIndex((end) => end >= start);
  const next = (ends[index].getTime() - start.getTime()) / DAY_MS < 28;
  const end = ends[next ? index + 1 : index];
  const weeks = Math.round((end.getTime() - start.getTime()) / (7 * DAY_MS));
  return { by: `${end.getDate()} ${MONTHS[end.getMonth()]}`, weeks: `${WEEKS[weeks] ?? weeks} weeks from now`, next };
}

export function quarterQuestion(by: string, weeks: string, target: string | null): string {
  const when = `by ${by}, ${weeks}`;
  return target
    ? `Then what must be true ${when}, to be on track for “${target.replace(/\.$/, "")}”?`
    : `What must be true ${when}?`;
}

/** The last day of the quarter after the one ending on ``iso`` (M13):
 *  "31 March" after "2026-12-31". */
export function nextQuarterBy(iso: string): string {
  const [year, month] = iso.slice(0, 10).split("-").map(Number);
  const end = new Date(year, Math.floor((month - 1) / 3) * 3 + 6, 0);
  return `${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

/** "3 November" for a change's ISO date. */
export function dayLabel(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return year && month && day ? `${day} ${MONTHS[month - 1]}` : iso;
}

export type Rung = {
  step: "goal" | "want" | "give" | StepKey | "quarter" | "talk" | "clash";
  /** On a clash: the other goal's id. */
  with?: string;
  label: string;
  /** The small grey words after the label: when, and when it changed. */
  note: string | null;
  text: string;
  earlier: string | null;
};

/** The ladder's rows, top to bottom (M10); a skipped step is left out. */
export function ladderRungs(goal: Pick<LifeGoal, "ladder" | "changes" | "talk">): Rung[] {
  const { ladder } = goal;
  const changes = goal.changes ?? {};
  const rungs: Rung[] = [];
  const push = (step: Rung["step"], label: string, text: string | undefined, when?: string | null) => {
    if (!text) return;
    const change = changes[step];
    const note = [when ? LIFE_GOALS_COPY.by(when) : null, change ? LIFE_GOALS_COPY.changed(dayLabel(change.on)) : null]
      .filter(Boolean)
      .join(" · ");
    rungs.push({ step, label, note: note || null, text, earlier: change?.earlier ?? null });
  };
  const L = LIFE_GOALS_COPY.labels;
  push("goal", L.goal, ladder.goal, ladder.horizon_by ?? null);
  push("want", L.want, ladder.want);
  push("give", L.give, ladder.give);
  for (const step of ["y10", "y3", "y1"] as const) push(step, L[step], ladder.steps?.[step]?.text, ladder.steps?.[step]?.by);
  push("quarter", ladder.quarter?.next ? L.nextQuarter : L.quarter, ladder.quarter?.text, ladder.quarter?.by);
  push("talk", L.talk, goal.talk);
  for (const clash of ladder.clashes ?? []) {
    push("clash", L.clash, clash.text);
    rungs[rungs.length - 1].with = clash.with;
  }
  return rungs;
}

/** The answers to "When they clash, which wins?" for two goals, as the
 *  backend names them: the space, or the first words when both share one. */
export function clashOptions(goal: Pick<LifeGoal, "id" | "space" | "ladder">, other: Pick<LifeGoal, "id" | "space" | "ladder">): ClashOption[] {
  const twin = goal.space === other.space;
  const label = (g: typeof goal) => {
    if (!twin) return SPACES[g.space].name;
    const words = (g.ladder.goal ?? SPACES[g.space].name).split(/\s+/);
    return words.slice(0, 4).join(" ") + (words.length > 4 ? "…" : "");
  };
  return [
    ...[goal, other].map((g) => ({ wins: g.id, emoji: SPACES[g.space].emoji, label: label(g) })),
    { wins: "each_time", emoji: "⚖️", label: LIFE_GOALS_COPY.eachTime },
  ];
}

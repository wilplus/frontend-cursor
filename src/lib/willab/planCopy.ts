/* The plan's words on screen, as signed (docs/flows/the-plan.md §1 K; backend
   N137 to N176). Will's bubbles are written by the backend
   (services/plan.py COPY); these are the words the app draws itself: the
   card, the footer and the sheets. No new words without the founder's OK
   (Never 4). */

export const PLAN_COPY = {
  pickDate: "Pick a date",
  noDate: "No date yet",
  recordAnswer: "Record your answer",
  yourAnswer: "Your answer",
  stop: "Stop",
  yourNextLevel: "Your next level",
  thisWeeksLevel: "This week's level",
  howYouSaidIt: "How you said it",
  whyThisLine: "Why this line?",
  planHeading: "Plan",
  everyDay: "15 minutes every day",
  threeTimes: (days: string) => `15 minutes, 3 times a week: ${days}`,
  paceGame: "This week your walk has a pace game",
  kickoffCall: "Kickoff call with your coach",
  summaryCall: "Summary call with your coach",
  kickoffShort: "Kickoff call",
  yourDeadline: "Your deadline",
  book: "Book",
  bookNow: "Book now",
  skip: "Skip",
  edit: "Edit",
  back: "Back",
  save: "Save",
  booked: (n: number) => `${n} of 2 booked`,
  /** Will's line once a call is booked, as the backend writes it (signed,
   *  N173), shown at once while it is saved (N281). */
  bookedAt: (when: string) => `Booked: ${when}.`,
  changeYourPlan: "Change your plan",
  seeYourPlan: "See your plan",
  yourPlan: "Your plan",
  deadline: "Deadline",
  practiceDays: "Practice days",
  yourLevel: "Your level",
  pickThree: "Pick 3 days.",
  closeEveryDay: "Your deadline is close, so you practise every day.",
  everyDayShort: "Every day",
  levelIsCoachs: "Your level comes from what I heard in your voice. Your coach can change it.",
  askCoach: "Ask your coach",
  newEvent: "I have a new event",
  keepPractising: "Keep practising",
  startFirst: "Start your first recording",
  recordTake: (n: number) => `Record Take ${n}`,
  doneNext: (n: number, total: number, day: string) => `${n} of ${total} practices done. Next: ${day}.`,
  yourSummaryCall: "Your summary call",
  summaryCallWhat: "15 minutes with your coach, to look back and plan what's next.",
  chooseDate: "Choose a date",
  stressLo: "Calm",
  stressHi: "Very stressed",
  readyLo: "Not ready",
  readyHi: "Fully ready",
  yes: "Yes",
  no: "No",
  /** Will's ask for the plan's own yes: the two buttons and Read more
   *  (founder 2026-10-27, "approved as drawn", backend N211). */
  consentYes: "Yes, ask me",
  consentNo: "Not now",
  readMore: "Read more",
  privacyPolicy: "Privacy Policy",
  /** The Read more window's title: Privacy section 4e of the version in force. */
  consentWindow: (version: string) => `Privacy Policy ${version}, section 4e`,
  /** On the walk's moment where this week's level shows most (G7; signed,
   *  N140; backend N209). */
  levelHere: (level: string) => `This week's level: ${level}. Here's where it shows:`,
} as const;

/** The five levels by their key, as the walk's moment names them (backend
 *  services/plan.py LEVELS; signed, N132, N134). */
export const LEVEL_NAMES: Readonly<Record<string, string>> = {
  say_once: "Say it once, and it lands",
  key_line: "Let your key line land",
  pauses: "Pauses that hold the room",
  voice_moves: "A voice that moves",
  make_it_yours: "Make it yours",
};

/** A served level key's name, or null for none or one the app doesn't know. */
export const levelNameOf = (key: string | null | undefined): string | null =>
  key && Object.prototype.hasOwnProperty.call(LEVEL_NAMES, key) ? LEVEL_NAMES[key] : null;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday first, as the plan lists the days. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "14 November". */
export function fmtDay(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sat 14 Nov". */
export function fmtShort(d: Date): string {
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function monthTitle(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Tuesday 27 October, 10:00", in local time (Booked: …). */
export function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${WEEKDAYS[d.getDay()]} ${fmtDay(d)}, ${hm}`;
}

export function weekdayName(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

/** A calendar day as "YYYY-MM-DD", in local time. */
export function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "YYYY-MM-DD" as a local date at midnight. */
export function fromIsoDay(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

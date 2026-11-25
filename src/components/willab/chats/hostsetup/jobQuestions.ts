import { suggestJob } from "@/services/api/hostSetup";

/* Which questions a job is asked. A speaking job that takes a recording
   gets the walk. Every other job gets what people ask, what they get
   back, and who answers. A known job uses this table. An unknown job
   asks the server for suggestions, and uses the generic set when it is down. */

export type JobAsk = { question: string; taps: string[] };

const GIVE: JobAsk = {
  question: "What do they get back?",
  taps: ["An answer", "Next steps", "A mark on what they sent"],
};

const TABLE: Record<string, JobAsk> = {
  Neurobiologist: {
    question: "What do people ask you?",
    taps: ["How the brain works", "A study", "Something else"],
  },
  "ML specialist": {
    question: "What do people ask you?",
    taps: ["How a model works", "Help with a model", "Something else"],
  },
};

const GENERIC: JobAsk = {
  question: "What do people ask you?",
  taps: ["A question", "Help with a task", "Something else"],
};

/** A job about speaking or voice. Speaking coach is one. A typed job
 *  matches when the words say so. */
export function voiceJob(spec: string): boolean {
  const said = spec.trim().toLowerCase();
  if (said === "speaking coach") return true;
  return /\b(speak|speaking|voice|orator|presentation)\b/.test(said);
}

export function giveAsk(): JobAsk {
  return GIVE;
}

const COACH_STARTS = ["Practise a talk", "Get ready for a pitch", "Answer a hard question"];
const GENERIC_STARTS = ["Ask a question", "Tell me more", "Something else"];
const STARTS: Record<string, string[]> = {
  Neurobiologist: ["How does memory work?", "Explain a study", "Ask something else"],
  "ML specialist": ["How does this model work?", "Explain a result", "Ask something else"],
};

/** The three first taps. A speaking job keeps the coach set. A known job
 *  uses the table. Anything else is what Will suggested for it, else generic. */
export function startersFor(spec: string): string[] {
  if (voiceJob(spec)) return COACH_STARTS;
  return STARTS[spec.trim()] ?? learned.get(keyOf(spec))?.taps ?? GENERIC_STARTS;
}

/** The table for a known job, otherwise the generic set. */
export function jobAsk(spec: string): JobAsk {
  const got = learned.get(keyOf(spec));
  const asked = got ? { question: GENERIC.question, taps: [...got.taps.slice(0, 2), "Something else"] } : null;
  return TABLE[spec.trim()] ?? asked ?? GENERIC;
}

/** What Will suggested for a job typed in the talk, kept for this page. */
const learned = new Map<string, { taps: string[]; hello: string }>();
const keyOf = (spec: string) => spec.trim().toLowerCase();

/** Asks the server once for a job the table does not know. A known job, or
 *  no answer, keeps the table and the generic set. */
export async function questionFor(spec: string): Promise<JobAsk> {
  const known = TABLE[spec.trim()];
  if (known || voiceJob(spec)) return known ?? GENERIC;
  if (!learned.has(keyOf(spec))) {
    const got = await suggestJob(spec.trim());
    if (got) learned.set(keyOf(spec), got);
  }
  return jobAsk(spec);
}

/** The first line for a job Will has suggested for, else the plain one. */
export function helloFor(spec: string): string {
  return learned.get(keyOf(spec))?.hello || "Your chat is ready.";
}

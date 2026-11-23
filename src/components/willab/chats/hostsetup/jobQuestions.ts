import { askReply } from "@/services/api/hostSetup";

/* Which questions a job is asked. A speaking job that takes a recording
   gets the walk. Every other job gets what people ask, what they get
   back, and who answers. A known job uses this table. An unknown job
   asks the reply route, and uses the generic set when that route is down. */

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
 *  uses the table. Anything else is generic until the reply route answers. */
export function startersFor(spec: string): string[] {
  if (voiceJob(spec)) return COACH_STARTS;
  return STARTS[spec.trim()] ?? GENERIC_STARTS;
}

export async function startersFromRoute(spec: string): Promise<string[]> {
  const known = startersFor(spec);
  if (voiceJob(spec) || STARTS[spec.trim()]) return known;
  const remote = await askReply("job", {
    text: `Three short first questions a ${spec.trim()} chat should offer. Separate them with |.`,
    kind: "text",
  });
  const parts = (remote?.reply ?? "").split("|").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 3 ? parts.slice(0, 3) : known;
}

/** The table for a known job, otherwise the generic set. */
export function jobAsk(spec: string): JobAsk {
  return TABLE[spec.trim()] ?? GENERIC;
}

/** The reply route may phrase the question for an unknown job. A missing
 *  route, or a known job, keeps the table. */
export async function questionFor(spec: string): Promise<JobAsk> {
  const known = TABLE[spec.trim()];
  if (known || voiceJob(spec)) return known ?? GENERIC;
  const remote = await askReply("job", {
    text: `One short question: what do people ask a ${spec.trim()} for? Then three short answers, separated by |.`,
    kind: "text",
  });
  const text = remote?.reply?.trim() ?? "";
  const parts = text.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3 && parts[0].includes("?")) return { question: parts[0], taps: parts.slice(1, 4) };
  return GENERIC;
}

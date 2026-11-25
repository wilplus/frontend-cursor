import { bffFetch } from "@/lib/api/bffFetch";

export const speakingPatternPath = "/api/v2/user/speaking-patterns";
export const patternInput = "min-w-0 rounded-lg border border-border bg-background px-3 py-2";

export type PatternSource = "take" | "corpus";
export type PatternKind = "error" | "praise" | "control" | "unsure";
export type CaseLink = { source: PatternSource; session_id: string; snippet_id: string };
export const deliveryTargets = {
  pitch: { name: "Pitch change in semitones", min: -6, max: 6, step: 0.1 },
  pause_ms: { name: "Pause in milliseconds", min: 0, max: 2500, step: 1 },
  wpm: { name: "Words per minute", min: 60, max: 300, step: 1 },
};
export type DeliveryValues = Partial<Record<keyof typeof deliveryTargets, number>>;
export type Match = {
  tool: string; name: string; delivery: string; status: "draft" | "approved"; values?: DeliveryValues;
};
export type Observation = { kind: PatternKind; pattern: string; start_ms: number; end_ms: number; note: string };
export type PatternExample = CaseLink & Observation & { id: string; intervention: Match | null };
export type PatternResponse = { examples: PatternExample[]; cues: Record<string, number> };
export type LibraryPage = { examples: PatternExample[]; next_offset: number | null };

export const sourceNames = { take: "Your Takes", corpus: "Training Corpus" };
export const kindNames = { error: "Error", praise: "Praise", control: "Control", unsure: "Unsure" };

export const errorTools = {
  sniper: "Sniper", ai_audio: "AI Audio", rewrite: "Rephrase", coach_video: "Coach video", other: "Other exercise",
};
export const praiseTools = {
  name_strength: "Name what worked", play_strength: "Play the clip and name what worked", other: "Other praise",
};
export function toolName(kind: PatternKind, tool: string) {
  const tools: Record<string, string> = kind === "praise" ? praiseTools : errorTools;
  return tools[tool] ?? "Intervention";
}

export const starterPatterns: Record<PatternKind, string[]> = {
  error: [
    "Too fast throughout", "Too slow throughout", "Rushed ending", "Uneven tempo",
    "Long pauses inside a thought", "Missing pause between ideas", "Fillers, repeats, or abandoned starts",
    "Tired-sounding opening", "Flat emphasis", "Misplaced emphasis or fading ending", "Audible strain",
    "Vague meaning", "Jargon the listener may miss", "Context drift or missing link",
    "High arousal with negative wording (research)",
  ],
  praise: [
    "Clear, concise point", "Confident, natural delivery", "Well-timed pace and pauses",
    "Expressive voice or firm finish", "Wording serves the audience", "Useful positive energy",
  ],
  control: ["Pace OK", "No issue"],
  unsure: ["Unsure"],
};

// The working table supplies starting ideas. The reviewer still chooses and
// approves the match for each clip, and can name a different intervention.
const suggestions: Record<string, [tool: string, name: string]> = {
  "Too fast throughout": ["sniper", "Practise the thought at a steadier pace"],
  "Too slow throughout": ["sniper", "Practise the thought a little faster"],
  "Rushed ending": ["sniper", "Keep the final phrase at a comfortable pace"],
  "Uneven tempo": ["sniper", "Keep the full thought at a comfortable pace"],
  "Long pauses inside a thought": ["ai_audio", "Shorten the gap inside the thought"],
  "Missing pause between ideas": ["ai_audio", "Model a pause between the ideas"],
  "Fillers, repeats, or abandoned starts": ["rewrite", "Say the thought in one clean pass"],
  "Tired-sounding opening": ["ai_audio", "Give the opening more lift"],
  "Flat emphasis": ["ai_audio", "Show a small lift on the key words"],
  "Misplaced emphasis or fading ending": ["ai_audio", "Let the last important words land firmly"],
  "Audible strain": ["coach_video", "Demonstrate easier delivery"],
  "Vague meaning": ["rewrite", "Add one concrete example"],
  "Jargon the listener may miss": ["rewrite", "Explain the term in everyday words"],
  "Context drift or missing link": ["rewrite", "Add a bridge back to the point"],
  "Clear, concise point": ["name_strength", "Name what made the point clear"],
  "Confident, natural delivery": ["play_strength", "Show where the delivery sounded assured"],
  "Well-timed pace and pauses": ["name_strength", "Name the pause or timing that helped"],
  "Expressive voice or firm finish": ["play_strength", "Point out the word or ending that landed"],
  "Wording serves the audience": ["name_strength", "Explain how the wording helped the audience"],
  "Useful positive energy": ["name_strength", "Name the delivery the speaker can repeat"],
};

export function startingMatch(example: PatternExample): Match {
  const [tool, name] = suggestions[example.pattern] ?? ["", ""];
  return example.intervention ?? { tool, name, delivery: "", status: "draft" };
}

export function casePath({ source, session_id, snippet_id }: CaseLink) {
  return [speakingPatternPath, source, encodeURIComponent(session_id), encodeURIComponent(snippet_id)].join("/");
}

export async function patternRequest<T>(url: string, method: "GET" | "POST" | "PUT" | "DELETE" = "GET", body?: object): Promise<T> {
  const result = await bffFetch(url, { cache: "no-store", method, json: body });
  if (result.kind !== "response" || !result.ok) {
    const body = result.kind === "response" ? result.body as { error?: string } | null : null;
    throw new Error(body?.error || "Couldn’t open or save the pattern library. Try again.");
  }
  return result.body as T;
}

export function clipTime(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const seconds = (ms % 60_000 / 1000).toFixed(3).padStart(6, "0");
  return `${minutes}:${seconds}`;
}

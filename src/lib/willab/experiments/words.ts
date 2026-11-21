import type { CellVs, Prompt, PromptFile } from "./types";

/* Plain words for the screen. The step order, the cell tags and the
   self-rating choices come from the prompt file. These phrases only
   translate a known internal name into something a person can read.
   arousal and valence are never shown. */

const AXIS_WORDS: Record<string, string> = {
  engagement: "how much you join in",
  arousal: "how your voice moves",
  valence: "how it lands",
  clarity: "how clear it was",
};

const TAG_WORDS: Record<string, string> = {
  baseline_calm: "Your usual way",
  positive: "A good moment",
  challenging: "A hard moment",
  clarity: "Make it clear",
};

const HIDDEN = /\b(arousal|valence|dominance|sentiment|wavlm|angry|anger|happy|happiness|sad|sadness|stressed|anxious|anxiety|emotion)\b/i;

const CUE_WORDS: Record<string, string> = {
  voiced_ratio: "Share of voice",
  loudness: "Loudness",
  speech_activity_rate: "Time speaking",
  pitch_level: "Voice height",
  pitch_range: "Voice width",
  voice_brightness: "Voice brightness",
  wavlm_arousal: "Voice lift",
  wavlm_valence: "How the voice sits",
  wavlm_dominance: "Voice firmness",
  pitch_variability: "Pitch changes",
  word_sentiment: "How the words read",
  business_case_coverage: "Page covered",
  semantic_similarity: "Close to the page",
  filler_word_rate: "Filler words",
};

export function axisWords(axis: string): string {
  return AXIS_WORDS[axis] ?? "this step";
}

export function axisTitle(axis: string): string {
  const words = axisWords(axis);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function comparisonWords(reference: CellVs | "baseline+reference"): string {
  if (reference === "baseline+reference") return "vs your baseline and the page";
  return reference === "baseline" ? "vs your baseline" : "vs the reference";
}

export function cueWords(cue: string): string {
  return CUE_WORDS[cue] ?? "This measure";
}

/** Plain gate line. The model's reason chooses the second sentence.
    Field names in that reason are not shown. */
export function gateSentence(gate: { step: string; reason: string } | null): string {
  if (!gate) return "Every step is clear enough.";
  const name = axisWords(gate.step);
  const reason = gate.reason.toLowerCase();
  if (reason.includes("business case") || reason.includes("no page") || reason.includes("reference")) {
    return `The first step that is not clear enough is ${name}. There is no page to read it against.`;
  }
  if (reason.includes("too low")) {
    return `The first step that is not clear enough is ${name}. It sits below your usual voice.`;
  }
  if (reason.includes("confidence") || reason.includes("not sure")) {
    return `The first step that is not clear enough is ${name}. The reading is not sure yet.`;
  }
  return `The first step that is not clear enough is ${name}.`;
}

export function tagWords(tag: string): string {
  return TAG_WORDS[tag] ?? "A take";
}

export function optionLabel(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function reportLabel(key: "energy" | "feeling"): string {
  return key === "energy" ? "Your energy" : "How it felt";
}

/** The opening block is whatever tag the file starts with. Later tags,
    including a counting task, are ordinary takes. */
export function isOpeningPrompt(prompt: Prompt, file: PromptFile): boolean {
  return file.prompts[0] !== undefined && prompt.tag === file.prompts[0].tag;
}

export function referenceLine(reference: string | undefined): string | null {
  if (!reference) return null;
  if (reference === "business_case") return "This one is read against your page.";
  return "This one is read against a page you added.";
}

export function formatCue(value: number): string {
  const n = Math.round(value * 10) / 10;
  const text = Math.abs(n).toFixed(1);
  if (n > 0) return `+${text}`;
  if (n < 0) return `−${text}`;
  return "0.0";
}

/** A guard for tests and reviews: the AI reading must not name a feeling. */
export function leaksHiddenWord(text: string): string | null {
  return HIDDEN.exec(text)?.[0] ?? null;
}

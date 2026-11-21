import type { CellReference, Prompt, PromptFile } from "./types";

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

const HIDDEN = /\b(arousal|valence|angry|happy|sad|stressed|anxious|anxiety)\b/i;

export function axisWords(axis: string): string {
  return AXIS_WORDS[axis] ?? "this step";
}

export function axisTitle(axis: string): string {
  const words = axisWords(axis);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function comparisonWords(reference: CellReference): string {
  return reference === "baseline" ? "vs your baseline" : "vs the reference";
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

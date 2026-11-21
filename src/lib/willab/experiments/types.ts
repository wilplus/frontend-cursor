/* The data-scientist area's types, in one place. Screen copy never shows
   the field names arousal or valence. The prompt file decides the step
   order, which cells are read against the baseline, and the self-rating
   words. */

export type Prompt = {
  id: string;
  tag: string;
  text: string;
  reference?: string;
};

/** prompts_v1.yaml, after it has passed the loader. */
export type PromptFile = {
  version: number;
  language: string;
  order: string[];
  baseline_scored: string[];
  reference_scored: string[];
  prompts: Prompt[];
  self_report: {
    energy: [string, string];
    feeling: [string, string];
  };
};

export type SelfRating = {
  energy: string;
  feeling: string;
};

/** `baseline` or `reference`, as POST /v2/experiments/analyze-take names it. */
export type CellReference = "baseline" | "reference";

export type Channel = "verbal" | "vocal";

export type GridCell = {
  value: number;
  reference: CellReference;
};

export type MomentAnalysis = {
  start: number;
  end: number;
  grid: Record<string, { verbal: GridCell; vocal: GridCell }>;
};

export type StepSummary = {
  score: number;
  confidence: number;
};

/** Wire shape: summary.<step>.{score,confidence} and summary.gate. */
export type AnalyzeSummary = {
  gate: string | null;
} & Record<string, StepSummary | string | null>;

export type AnalyzeTakeResponse = {
  take_id: string;
  model: string;
  moments: MomentAnalysis[];
  summary: AnalyzeSummary;
};

/** An intervention pattern: grid.<step>.verbal / vocal is a number in [-1, 1]. */
export type PatternGrid = Record<string, Partial<Record<Channel, number>>>;

export type Intervention = {
  id: string;
  name: string;
  grid: PatternGrid;
  threshold: number;
  rule: { step?: string };
};

export type InterventionHit = {
  id: string;
  name: string;
  step: string;
  overlap: number;
  threshold: number;
  rule: { step?: string };
  grid: PatternGrid;
};

export type InterventionPick = {
  take_id: string;
  order: string[];
  moment: MomentAnalysis;
  hits: InterventionHit[];
  shown: InterventionHit[];
  chosen_id: string | null;
};

/** The object the coaching chat can take. This area only fills it. */
export type ExperimentCoachingContext = {
  source: "experiments";
  order: string[];
  moment: MomentAnalysis;
  fired: InterventionHit[];
};

export type ExperimentConsent = {
  participant: boolean;
  researcher: boolean;
  version: string;
};

export const CONSENT_VERSION = "experiments-v1";

export type ExperimentSession = {
  id: string;
  volunteer_id: string;
  consent: ExperimentConsent;
  business_case: { name: string; content_type: string } | null;
  created_at: string;
};

export type ExperimentTake = {
  id: string;
  session_id: string;
  volunteer_id: string;
  prompt_id: string;
  tag: string;
  reference: string | null;
  self_rating: SelfRating;
  audio_name: string | null;
  transcript: string;
  analysis: AnalyzeTakeResponse;
};

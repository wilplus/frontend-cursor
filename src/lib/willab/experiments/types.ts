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

/** analyze-take/v0.1. Field names such as arousal stay inside this type.
    Screens use words.ts and never read score_if_unlocked. */

export type AnalyzeStep = "engagement" | "arousal" | "valence" | "clarity";

export type CellVs = "baseline" | "reference";

/** Prompt-file helpers still name a cell this way. The analyze-take wire
    uses CueCell instead. */
export type CellReference = CellVs;
export type Channel = "verbal" | "vocal";
export type GridCell = { value: number; reference: CellReference };

export type CueCell = {
  step: AnalyzeStep;
  cue: string;
  value: number | null;
  vs: CellVs;
  note?: string;
};

export type AnalyzeMoment = {
  t_start: number;
  t_end: number;
  grid: CueCell[];
};

export type StepSummary = {
  score: number | null;
  confidence: number;
  vs: "baseline" | "reference" | "baseline+reference";
  unlocked: boolean;
  provisional?: boolean;
  note?: string;
  judges?: Record<string, number>;
  cues?: Record<string, number>;
  /** Present on locked steps in the wire file. UI code must not read it. */
  score_if_unlocked?: number | null;
};

export type AnalyzeGate = { step: AnalyzeStep; reason: string } | null;

export type AnalyzeTake = {
  take_id: string;
  prompt_tag: string | null;
  duration_s?: number;
  transcript?: string | null;
  order: AnalyzeStep[];
  moments: AnalyzeMoment[];
  summary: Record<AnalyzeStep, StepSummary>;
  gate: AnalyzeGate;
  processing_s?: number;
};

export type AnalyzeDocument = {
  schema: string;
  package_version?: string;
  value_range: [number, number];
  value_scaling?: string;
  thresholds: Record<string, number>;
  provisional?: Record<string, string>;
  takes: AnalyzeTake[];
};

export type PatternCell = { step: AnalyzeStep; cue: string; value: number };

export type Intervention = {
  id: string;
  name: string;
  grid: PatternCell[];
  threshold: number;
  rule: { step?: AnalyzeStep };
};

export type InterventionHit = {
  id: string;
  name: string;
  step: AnalyzeStep;
  overlap: number;
  threshold: number;
  rule: { step?: AnalyzeStep };
  grid: PatternCell[];
};

export type InterventionPick = {
  take_id: string;
  order: AnalyzeStep[];
  moment: AnalyzeMoment;
  gate: AnalyzeGate;
  hits: InterventionHit[];
  shown: InterventionHit[];
  chosen_id: string | null;
};

/** The object the coaching chat can take. This area only fills it. */
export type ExperimentCoachingContext = {
  source: "experiments";
  order: AnalyzeStep[];
  moment: AnalyzeMoment;
  gate: AnalyzeGate;
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
  analysis: AnalyzeTake | null;
};

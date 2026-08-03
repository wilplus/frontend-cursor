/**
 * Types + tiny helpers for the developer learning-trace page
 * (/admin/learning ← GET /api/v2/admin/learning/trace).
 *
 * Shapes mirror backend services/learning_trace.py. Every section is
 * nullable — the backend degrades per-section into errors[] rather than
 * failing the whole payload, and the view renders whatever arrived.
 */

export type TraceError = { section: string; error: string };

export type ModelVersionRow = {
  version?: string;
  created_at?: string;
  status?: string;
  schema_version?: string | null;
  corpus_size?: number | null;
  metrics?: Record<string, unknown> | null;
};

export type CoefficientRow = {
  feature: string;
  weights: Record<string, number>;
  weight_abs_max: number;
};

export type Coefficients = {
  model_version?: string | null;
  classes?: string[];
  per_feature?: CoefficientRow[];
  intercept?: number[];
  note?: string;
} | null;

export type ShadowAgreement = {
  agreement_overall?: number;
  by_class?: Record<string, number>;
  sample_n?: number;
  note?: string;
} | null;

export type AgreementWeek = { week: string; agreement: number; n: number };

export type LaneShadow = {
  model_versions?: ModelVersionRow[] | null;
  coefficients?: Coefficients;
  shadow_agreement?: ShadowAgreement;
  agreement_over_time?: AgreementWeek[] | null;
  training_labels?: {
    total?: number;
    by_class?: Record<string, number>;
    by_selection_source?: Record<string, number>;
  } | null;
  auto_retrain?: { min_total?: number; new_delta?: number; note?: string };
} | null;

export type ExportRun = {
  id?: string;
  started_at?: string;
  ended_at?: string | null;
  status?: string;
  processed_count?: number;
  exported_count?: number;
  failed_count?: number;
  export_uri?: string | null;
  created_by?: string | null;
  error_text?: string | null;
};

export type RuntimeConfigRow = {
  key?: string;
  value?: string;
  updated_at?: string;
  updated_by?: string | null;
  metadata?: Record<string, unknown> | null;
} | null;

export type LaneAnnotations = {
  annotation_events?: {
    total?: number;
    by_section_type?: Record<string, number>;
    by_field_name?: Record<string, number>;
    by_reason_chip?: Record<string, number>;
    approve_vs_override?: {
      approved_verbatim?: number;
      overridden?: number;
      undetermined_no_hashes?: number;
      note?: string;
    };
  } | null;
  export_runs?: ExportRun[] | null;
  copilot_model?: RuntimeConfigRow;
} | null;

export type PipelineStage = {
  stage: string;
  file?: string;
  decision_point?: boolean;
};

export type PipelineLane = {
  id: string;
  title: string;
  corpus?: string;
  stages: PipelineStage[];
  fence?: string;
};

export type KnownGap = {
  id: string;
  summary: string;
  file?: string;
  status?: string;
};

export type LearningTrace = {
  generated_at?: string;
  audience?: string;
  lane_shadow?: LaneShadow;
  lane_annotations?: LaneAnnotations;
  /* lane_acoustic (the stress baseline) was deleted 2026-08-03 — stress
   * recognition pivoted into the peer-review validation loop. A trace that
   * still serves the section is tolerated (extra keys are simply unread). */
  pipeline_docs?: { source?: string; lanes?: PipelineLane[] } | null;
  known_gaps?: KnownGap[] | null;
  errors?: TraceError[];
};

export function fmtPct(v: number | undefined | null): string {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().slice(0, 16).replace("T", " ") + "Z";
}

export function fmtNum(v: number | undefined | null): string {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US");
}

/** override rate = overridden / (approved + overridden); null when unknown. */
export function overrideRate(
  a?: LaneAnnotations
): number | null {
  const avo = a?.annotation_events?.approve_vs_override;
  if (!avo) return null;
  const approved = avo.approved_verbatim ?? 0;
  const overridden = avo.overridden ?? 0;
  const denom = approved + overridden;
  return denom > 0 ? overridden / denom : null;
}

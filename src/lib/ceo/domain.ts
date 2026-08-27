export const CEO_PROJECT_KEYS = ["product", "research"] as const;
export const CEO_SURFACES = ["overview", "bugs", "tasks", "settings"] as const;
export const CEO_LENSES = ["architecture", "ml", "vision"] as const;
export const CEO_SCOPE_KINDS = ["project", "feature"] as const;

export type CeoProjectKey = (typeof CEO_PROJECT_KEYS)[number];
export type CeoSurface = (typeof CEO_SURFACES)[number];
export type CeoLens = (typeof CEO_LENSES)[number];
export type CeoScopeKind = (typeof CEO_SCOPE_KINDS)[number];
export type CeoOwnership = "manual" | "generated";

export interface CeoProject {
  project_key: CeoProjectKey;
  name: string;
  position: number;
}

export interface CeoFeature {
  id: string;
  project_key: CeoProjectKey;
  slug: string;
  name: string;
  description: string;
  position: number;
  status: "active" | "archived";
}

export interface CeoArtifactRevision {
  id: string;
  artifact_id: string;
  version: number;
  content: Record<string, unknown>;
  ownership: CeoOwnership;
  status: "official" | "preview";
  created_by: string;
  created_at: string;
}

export interface CeoArtifact {
  id: string;
  project_key: CeoProjectKey;
  scope_kind: CeoScopeKind;
  feature_id: string | null;
  lens: CeoLens;
  artifact_kind:
    | "architecture_spec"
    | "ml_system_map"
    | "vision_document";
  default_ownership: CeoOwnership;
  revision: CeoArtifactRevision | null;
}

export interface CeoViewState {
  project_key: CeoProjectKey;
  surface: CeoSurface;
  active_feature_id: string | null;
  active_lens: CeoLens;
}

export interface CeoTimelineEvent {
  id: string;
  project_key: CeoProjectKey;
  feature_id: string | null;
  event_type: string;
  entity_type: "bug" | "task" | "artifact";
  entity_id: string;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CeoArtifactComment {
  id: string;
  artifact_id: string;
  text: string;
  status: "open" | "resolved";
  reevaluation_status: "pending" | "processing" | "completed" | "failed";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CeoAnalysisStatus =
  | "queued"
  | "running"
  | "preview_ready"
  | "approved"
  | "rejected"
  | "failed";

export interface CeoAnalysisRun {
  id: string;
  project_key: CeoProjectKey;
  feature_id: string;
  artifact_id: string;
  lens: "architecture" | "ml";
  trigger_type: "manual" | "comment" | "task_completed" | "source_change";
  reason: string;
  status: CeoAnalysisStatus;
  base_revision_id: string;
  proposal_revision_id: string | null;
  source_snapshot_ids: string[];
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  reviewed_at: string | null;
  proposal_revision: CeoArtifactRevision | null;
}

export interface CeoSourceSnapshot {
  id: string;
  project_key: CeoProjectKey;
  feature_id: string | null;
  source_type:
    | "backend_code"
    | "frontend_code"
    | "migration"
    | "documentation"
    | "research_paper"
    | "manual_note"
    | "vision"
    | "ceo_history";
  source_ref: string;
  title: string;
  content_hash: string;
  metadata: Record<string, unknown>;
  captured_at: string;
}

export interface CeoIntelligenceUsage {
  runs: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface LearningReadinessRow {
  learning_surface: string;
  status:
    | "not_collecting_correctly"
    | "collecting"
    | "release_candidate_ready"
    | "blocked";
  canonical_take_count: number;
  covered_take_count: number;
  covered_owner_count: number;
  covered_speaker_count: number;
  covered_project_count: number;
  covered_coach_count: number;
  prepared_presentation_count: number;
  visible_exposure_count: number;
  shown_presentation_count: number;
  answer_instrument_defined: boolean;
  answered_exposure_count: number | null;
  unanswered_exposure_count: number | null;
  shadow_evaluation_count: number;
  unacknowledged_presentation_count: number;
  visible_coverage_ratio: number;
  versioned_presentation_count: number;
  version_coverage_ratio: number;
  versions: Record<string, unknown>[];
  coverage_dimensions: Record<
    "language" | "device" | "recording_condition",
    { status: string }
  >;
  missing_metadata: Record<string, number | null>;
  contradictions_supported: boolean;
  contradiction_count: number | null;
  potential_duplicate_count: number | null;
  duplicate_check_status: string;
  dataset_release_count: number;
  authorized_dataset_release_count: number;
  eligible_item_count: number;
  research_only_item_count: number;
  exclusion_count: number;
  exclusions_by_reason: Record<string, number>;
  speaker_disjoint_split: {
    strategy_version: string;
    covered_owner_count: number;
    assigned_owner_count: number;
    ready: boolean;
  };
  blockers: string[];
}

export interface LearningReadinessReport {
  contract_version: "readiness-v1";
  generated_at?: string;
  read_only: true;
  surfaces: LearningReadinessRow[];
  unavailable?: boolean;
  blockers?: string[];
}

export interface CeoBootstrap {
  projects: CeoProject[];
  features: CeoFeature[];
  artifacts: CeoArtifact[];
  view_state: CeoViewState[];
  timeline: CeoTimelineEvent[];
  comments: CeoArtifactComment[];
  analysis_runs: CeoAnalysisRun[];
  source_snapshots: CeoSourceSnapshot[];
  intelligence_usage: CeoIntelligenceUsage;
  learning_readiness: LearningReadinessReport;
  vocabulary: {
    projects: CeoProjectKey[];
    surfaces: CeoSurface[];
    lenses: CeoLens[];
    scope_kinds: CeoScopeKind[];
  };
}

export interface CeoAddress {
  project: CeoProjectKey;
  scope: CeoScopeKind;
  featureId: string | null;
  lens: CeoLens;
}

export function defaultCeoViewState(project: CeoProjectKey): CeoViewState {
  return {
    project_key: project,
    surface: "bugs",
    active_feature_id: null,
    active_lens: "architecture",
  };
}

export function activeCeoFeatures(
  features: CeoFeature[],
  project: CeoProjectKey
): CeoFeature[] {
  return features
    .filter(
      (feature) =>
        feature.project_key === project && feature.status === "active"
    )
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export function artifactAtAddress(
  artifacts: CeoArtifact[],
  address: CeoAddress
): CeoArtifact | null {
  if (address.scope === "project" && address.featureId !== null) return null;
  if (address.scope === "feature" && address.featureId === null) return null;
  return (
    artifacts.find(
      (artifact) =>
        artifact.project_key === address.project &&
        artifact.scope_kind === address.scope &&
        artifact.feature_id === address.featureId &&
        artifact.lens === address.lens
    ) ?? null
  );
}

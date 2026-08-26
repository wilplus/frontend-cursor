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

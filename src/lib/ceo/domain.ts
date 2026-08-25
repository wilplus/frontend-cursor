export const CEO_PROJECT_KEYS = ["product", "research"] as const;
export const CEO_SURFACES = ["overview", "bugs", "tasks", "settings"] as const;
export const CEO_GESTURE_SURFACES = ["overview", "bugs", "tasks"] as const;
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

export interface CeoBootstrap {
  projects: CeoProject[];
  features: CeoFeature[];
  artifacts: CeoArtifact[];
  view_state: CeoViewState[];
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

/** Bugs is the centre of the gesture: swipe right to Overview, left to Tasks. */
export function ceoSurfaceAfterSwipe(
  surface: CeoSurface,
  deltaX: number,
  minimumDistance = 48
): CeoSurface {
  if (Math.abs(deltaX) < minimumDistance || surface === "settings") {
    return surface;
  }
  const index = CEO_GESTURE_SURFACES.indexOf(
    surface as (typeof CEO_GESTURE_SURFACES)[number]
  );
  if (index < 0) return surface;
  const direction = deltaX > 0 ? -1 : 1;
  const next = Math.max(
    0,
    Math.min(CEO_GESTURE_SURFACES.length - 1, index + direction)
  );
  return CEO_GESTURE_SURFACES[next];
}

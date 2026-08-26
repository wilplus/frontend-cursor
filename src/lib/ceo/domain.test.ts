import { describe, expect, it } from "vitest";
import {
  activeCeoFeatures,
  artifactAtAddress,
  defaultCeoViewState,
  type CeoArtifact,
  type CeoFeature,
} from "./domain";

const features: CeoFeature[] = [
  {
    id: "research-1",
    project_key: "research",
    slug: "research-1",
    name: "Research feature",
    description: "",
    position: 0,
    status: "active",
  },
  {
    id: "product-2",
    project_key: "product",
    slug: "product-2",
    name: "Second",
    description: "",
    position: 2,
    status: "active",
  },
  {
    id: "product-1",
    project_key: "product",
    slug: "product-1",
    name: "First",
    description: "",
    position: 1,
    status: "active",
  },
  {
    id: "product-old",
    project_key: "product",
    slug: "product-old",
    name: "Old",
    description: "",
    position: 0,
    status: "archived",
  },
];

const artifacts: CeoArtifact[] = [
  {
    id: "project-architecture",
    project_key: "product",
    scope_kind: "project",
    feature_id: null,
    lens: "architecture",
    artifact_kind: "architecture_spec",
    default_ownership: "generated",
    revision: null,
  },
  {
    id: "feature-vision",
    project_key: "product",
    scope_kind: "feature",
    feature_id: "product-1",
    lens: "vision",
    artifact_kind: "vision_document",
    default_ownership: "manual",
    revision: null,
  },
];

describe("CEO domain", () => {
  it("starts each project on the project-only Bugs surface", () => {
    expect(defaultCeoViewState("research")).toEqual({
      project_key: "research",
      surface: "bugs",
      active_feature_id: null,
      active_lens: "architecture",
    });
  });

  it("keeps Product and Research feature trees separate", () => {
    expect(activeCeoFeatures(features, "product").map((row) => row.id)).toEqual(
      ["product-1", "product-2"]
    );
    expect(activeCeoFeatures(features, "research").map((row) => row.id)).toEqual(
      ["research-1"]
    );
  });

  it("resolves artifacts only at an exact project, scope, feature and lens", () => {
    expect(
      artifactAtAddress(artifacts, {
        project: "product",
        scope: "feature",
        featureId: "product-1",
        lens: "vision",
      })?.id
    ).toBe("feature-vision");
    expect(
      artifactAtAddress(artifacts, {
        project: "research",
        scope: "feature",
        featureId: "product-1",
        lens: "vision",
      })
    ).toBeNull();
    expect(
      artifactAtAddress(artifacts, {
        project: "product",
        scope: "project",
        featureId: "product-1",
        lens: "architecture",
      })
    ).toBeNull();
  });
});

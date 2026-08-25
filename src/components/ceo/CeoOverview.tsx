"use client";

import { ChevronRight, LoaderCircle, Plus, X } from "lucide-react";
import { useState } from "react";
import CeoArtifactEditor from "@/components/ceo/CeoArtifactEditor";
import CeoSegmentedControl from "@/components/ceo/CeoSegmentedControl";
import { cn } from "@/lib/utils";
import {
  CEO_LENSES,
  artifactAtAddress,
  type CeoBootstrap,
  type CeoFeature,
  type CeoLens,
  type CeoProjectKey,
  type CeoViewState,
} from "@/lib/ceo/domain";

const LENS_LABELS: Record<CeoLens, string> = {
  architecture: "Architecture",
  ml: "ML",
  vision: "Vision",
};

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function CeoOverview({
  data,
  project,
  state,
  features,
  updateState,
  onBootstrap,
}: {
  data: CeoBootstrap;
  project: CeoProjectKey;
  state: CeoViewState;
  features: CeoFeature[];
  updateState: (patch: Partial<Omit<CeoViewState, "project_key">>) => void;
  onBootstrap: (bootstrap: CeoBootstrap) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const activeFeature =
    features.find((feature) => feature.id === state.active_feature_id) ?? null;
  const artifact = artifactAtAddress(data.artifacts, {
    project,
    scope: activeFeature ? "feature" : "project",
    featureId: activeFeature?.id ?? null,
    lens: state.active_lens,
  });
  const featureId = activeFeature?.id ?? null;
  const timeline = (data.timeline ?? []).filter(
    (event) => event.project_key === project && event.feature_id === featureId
  );
  const comments = (data.comments ?? []).filter(
    (comment) => comment.artifact_id === artifact?.id
  );

  async function createFeature() {
    const cleanName = name.trim();
    if (!cleanName || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch(
        `/api/v2/admin/ceo/projects/${project}/features`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cleanName, description: description.trim() }),
        }
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : "The feature could not be created."
        );
      }
      const bootstrap = body.bootstrap as CeoBootstrap | undefined;
      const newFeatureId = typeof body.feature_id === "string" ? body.feature_id : null;
      if (!bootstrap || !newFeatureId) {
        throw new Error("The created CEO feature was not returned.");
      }
      onBootstrap(bootstrap);
      updateState({ active_feature_id: newFeatureId });
      setName("");
      setDescription("");
      setAdding(false);
    } catch (caught) {
      setCreateError(
        caught instanceof Error ? caught.message : "The feature could not be created."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-border p-3 lg:sticky lg:top-5 lg:h-fit">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Scope
        </p>
        <ScopeButton
          label={`${project === "product" ? "Product" : "Research"} overview`}
          active={!activeFeature}
          onClick={() => updateState({ active_feature_id: null })}
        />
        <div className="my-2 ml-4 h-3 w-px bg-border" aria-hidden />
        <div className="space-y-1">
          {features.map((feature) => (
            <ScopeButton
              key={feature.id}
              label={feature.name}
              active={activeFeature?.id === feature.id}
              branch
              onClick={() => updateState({ active_feature_id: feature.id })}
            />
          ))}
          {adding ? (
            <div className="mt-2 rounded-xl border border-border p-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void createFeature();
                  if (event.key === "Escape") setAdding(false);
                }}
                maxLength={120}
                autoFocus
                placeholder="Feature name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Optional description"
                className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-foreground"
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  aria-label="Cancel feature"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void createFeature()}
                  disabled={!name.trim() || creating}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-40"
                >
                  {creating ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                  Create
                </button>
              </div>
              {createError ? (
                <p role="alert" className="mt-2 text-xs text-red-600">{createError}</p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Add feature"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add feature
            </button>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {project === "product" ? "Product" : "Research"}
              <ChevronRight className="mx-1 inline h-3 w-3" aria-hidden />
              {activeFeature?.name ?? "Overview"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {activeFeature?.name ??
                `${project === "product" ? "Product" : "Research"} overview`}
            </h2>
            {activeFeature?.description ? (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {activeFeature.description}
              </p>
            ) : null}
          </div>
          <CeoSegmentedControl
            label="Lens"
            items={CEO_LENSES.map((lens) => ({
              key: lens,
              label: LENS_LABELS[lens],
            }))}
            value={state.active_lens}
            onChange={(value) => updateState({ active_lens: value as CeoLens })}
          />
        </div>
        <CeoArtifactEditor
          key={`${artifact?.id ?? "missing"}:${artifact?.revision?.id ?? "none"}`}
          artifact={artifact}
          lens={state.active_lens}
          timeline={timeline}
          comments={comments}
          onBootstrap={onBootstrap}
        />
      </div>
    </div>
  );
}

function ScopeButton({
  label,
  active,
  branch = false,
  onClick,
}: {
  label: string;
  active: boolean;
  branch?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted font-medium text-foreground",
        branch && "pl-6"
      )}
    >
      {branch ? (
        <span
          className="absolute left-3 top-0 h-1/2 w-2 border-b border-l border-border"
          aria-hidden
        />
      ) : null}
      <span>{label}</span>
    </button>
  );
}

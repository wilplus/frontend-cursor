"use client";

import Link from "next/link";
import {
  ChevronRight,
  Plus,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import CeoBugCapture from "@/components/ceo/CeoBugCapture";
import CeoTasks from "@/components/ceo/CeoTasks";
import { cn } from "@/lib/utils";
import {
  CEO_LENSES,
  CEO_PROJECT_KEYS,
  CEO_SURFACES,
  activeCeoFeatures,
  artifactAtAddress,
  ceoSurfaceAfterSwipe,
  defaultCeoViewState,
  type CeoArtifact,
  type CeoBootstrap,
  type CeoFeature,
  type CeoLens,
  type CeoProjectKey,
  type CeoSurface,
  type CeoViewState,
} from "@/lib/ceo/domain";

const SURFACE_LABELS: Record<CeoSurface, string> = {
  overview: "Overview",
  bugs: "Bugs",
  tasks: "Tasks",
  settings: "Settings",
};

const LENS_LABELS: Record<CeoLens, string> = {
  architecture: "Architecture",
  ml: "ML",
  vision: "Vision",
};

type StateByProject = Record<CeoProjectKey, CeoViewState>;
type DraftByProject = Record<CeoProjectKey, string>;

function initialStates(rows: CeoViewState[]): StateByProject {
  return {
    product:
      rows.find((row) => row.project_key === "product") ??
      defaultCeoViewState("product"),
    research:
      rows.find((row) => row.project_key === "research") ??
      defaultCeoViewState("research"),
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function CeoWorkspace() {
  const [data, setData] = useState<CeoBootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [project, setProject] = useState<CeoProjectKey>("product");
  const [states, setStates] = useState<StateByProject>(() =>
    initialStates([])
  );
  const [bugDrafts, setBugDrafts] = useState<DraftByProject>({
    product: "",
    research: "",
  });
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const remembered = window.localStorage.getItem("ceo-active-project");
    if (remembered === "product" || remembered === "research") {
      setProject(remembered);
    }
    setBugDrafts({
      product: window.localStorage.getItem("ceo-bug-draft-product") ?? "",
      research: window.localStorage.getItem("ceo-bug-draft-research") ?? "",
    });
    const controller = new AbortController();
    void fetch("/api/v2/admin/ceo/bootstrap", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await readJson(response);
        if (!response.ok) {
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : "CEO could not be loaded."
          );
        }
        const bootstrap = body as unknown as CeoBootstrap;
        setData(bootstrap);
        setStates(initialStates(bootstrap.view_state ?? []));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof Error ? error.message : "CEO could not be loaded."
        );
      });
    return () => controller.abort();
  }, []);

  const rememberProject = useCallback((next: CeoProjectKey) => {
    setProject(next);
    window.localStorage.setItem("ceo-active-project", next);
  }, []);

  const updateBugDraft = useCallback(
    (value: string) => {
      setBugDrafts((current) => ({ ...current, [project]: value }));
      window.localStorage.setItem(`ceo-bug-draft-${project}`, value);
    },
    [project]
  );

  const persistState = useCallback((next: CeoViewState) => {
    void fetch(
      `/api/v2/admin/ceo/projects/${next.project_key}/view-state`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface: next.surface,
          active_feature_id: next.active_feature_id,
          active_lens: next.active_lens,
        }),
      }
    ).catch(() => {
      // Navigation remains usable when saving the remembered position fails.
      // The next bootstrap simply returns the previous server value.
    });
  }, []);

  const updateState = useCallback(
    (patch: Partial<Omit<CeoViewState, "project_key">>) => {
      setStates((current) => {
        const next = { ...current[project], ...patch };
        persistState(next);
        return { ...current, [project]: next };
      });
    },
    [persistState, project]
  );

  const state = states[project];
  const features = useMemo(
    () => activeCeoFeatures(data?.features ?? [], project),
    [data?.features, project]
  );

  function beginSwipe(event: React.TouchEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, button, a")) return;
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function endSwipe(event: React.TouchEvent<HTMLElement>) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const end = event.changedTouches[0]?.clientX;
    if (end === undefined) return;
    const surface = ceoSurfaceAfterSwipe(state.surface, end - start);
    if (surface !== state.surface) updateState({ surface });
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20">
        <h1 className="text-2xl font-semibold tracking-tight">CEO</h1>
        <p className="mt-3 text-sm text-muted-foreground">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="h-4 w-px bg-border" aria-hidden />
            <h1 className="text-sm font-semibold tracking-tight">CEO</h1>
          </div>
          <button
            type="button"
            onClick={() => updateState({ surface: "settings" })}
            aria-label="Open Settings"
            aria-pressed={state.surface === "settings"}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              state.surface === "settings" && "bg-foreground text-background"
            )}
          >
            <Settings className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            label="Project"
            items={CEO_PROJECT_KEYS.map((key) => ({
              key,
              label: key === "product" ? "Product" : "Research",
            }))}
            value={project}
            onChange={(value) => rememberProject(value as CeoProjectKey)}
          />
          <nav
            className="flex items-center rounded-xl bg-muted p-1"
            aria-label="CEO surfaces"
          >
            {CEO_SURFACES.filter((surface) => surface !== "settings").map(
              (surface) => (
                <button
                  key={surface}
                  type="button"
                  onClick={() => updateState({ surface })}
                  aria-current={state.surface === surface ? "page" : undefined}
                  className={cn(
                    "min-w-20 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
                    state.surface === surface &&
                      "bg-background text-foreground shadow-sm"
                  )}
                >
                  {SURFACE_LABELS[surface]}
                </button>
              )
            )}
          </nav>
        </div>

        <section
          className="mt-6 min-h-[65vh]"
          onTouchStart={beginSwipe}
          onTouchEnd={endSwipe}
        >
          {state.surface === "bugs" ? (
            <CeoBugCapture
              project={project}
              value={bugDrafts[project]}
              onChange={updateBugDraft}
            />
          ) : null}
          {state.surface === "overview" ? (
            <CeoOverview
              data={data}
              project={project}
              state={state}
              features={features}
              updateState={updateState}
            />
          ) : null}
          {state.surface === "tasks" ? (
            <CeoTasks project={project} features={features} />
          ) : null}
          {state.surface === "settings" ? <CeoSettings /> : null}
        </section>
      </div>
    </div>
  );
}

function SegmentedControl({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { key: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="inline-flex w-fit rounded-xl border border-border bg-background p-1"
      role="group"
      aria-label={label}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          aria-pressed={value === item.key}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors",
            value === item.key && "bg-foreground text-background"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function CeoOverview({
  data,
  project,
  state,
  features,
  updateState,
}: {
  data: CeoBootstrap;
  project: CeoProjectKey;
  state: CeoViewState;
  features: CeoFeature[];
  updateState: (patch: Partial<Omit<CeoViewState, "project_key">>) => void;
}) {
  const activeFeature =
    features.find((feature) => feature.id === state.active_feature_id) ?? null;
  const artifact = artifactAtAddress(data.artifacts, {
    project,
    scope: activeFeature ? "feature" : "project",
    featureId: activeFeature?.id ?? null,
    lens: state.active_lens,
  });

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
          <button
            type="button"
            disabled
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground/45"
            aria-label="Add feature"
            title="Feature editing follows the foundation"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add feature
          </button>
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
          </div>
          <SegmentedControl
            label="Lens"
            items={CEO_LENSES.map((lens) => ({
              key: lens,
              label: LENS_LABELS[lens],
            }))}
            value={state.active_lens}
            onChange={(value) =>
              updateState({ active_lens: value as CeoLens })
            }
          />
        </div>
        <ArtifactView artifact={artifact} lens={state.active_lens} />
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

function ArtifactView({
  artifact,
  lens,
}: {
  artifact: CeoArtifact | null;
  lens: CeoLens;
}) {
  const revision = artifact?.revision;
  return (
    <div className="pt-5">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border px-2 py-1">
          {artifact?.default_ownership === "manual" ? "Manual" : "Generated"}
        </span>
        <span>{revision ? `Version ${revision.version}` : "No revision"}</span>
        <span>Official</span>
      </div>
      {lens === "architecture" ? <ArchitectureEmpty /> : null}
      {lens === "ml" ? <MlEmpty /> : null}
      {lens === "vision" ? <VisionEmpty /> : null}
    </div>
  );
}

function ArchitectureEmpty() {
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-3 bg-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>Input</span>
          <span>Measurement</span>
          <span>Output</span>
        </div>
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          No approved architecture yet.
        </div>
      </div>
      <EmptySection title="Blind spots, tech debt & risks" />
      <EmptySection title="History" />
      <EmptySection title="Next steps" />
    </div>
  );
}

function MlEmpty() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-dashed border-border px-5 py-12">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 text-xs text-muted-foreground">
          {['Data', 'Training', 'Application'].map((label, index) => (
            <div key={label} className="contents">
              <div className="flex h-20 flex-1 items-center justify-center rounded-xl border border-border bg-muted/40">
                {label}
              </div>
              {index < 2 ? <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> : null}
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          No approved ML system map yet.
        </p>
      </div>
      <EmptySection title="Blind spots, tech debt & risks" />
      <EmptySection title="Next steps towards autonomy" />
    </div>
  );
}

function VisionEmpty() {
  return (
    <div className="min-h-[28rem] rounded-2xl border border-border px-6 py-7 sm:px-8">
      <p className="text-sm text-muted-foreground">
        Vision is empty. A manual vision document will become the guardrail for
        Architecture and ML.
      </p>
    </div>
  );
}

function EmptySection({ title }: { title: string }) {
  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          type="button"
          disabled
          aria-label={`Add to ${title}`}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/40"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">Nothing recorded yet.</p>
    </section>
  );
}

function CeoSettings() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-5">
          <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h3 className="mt-5 font-semibold">Users</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin access and user details will live here.
          </p>
        </div>
        <Link
          href="/admin/tokens"
          className="rounded-2xl border border-border p-5 transition-colors hover:bg-muted/50"
        >
          <WalletCards className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h3 className="mt-5 font-semibold">Tokens</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Look up balances and grant non-expiring tokens.
          </p>
        </Link>
      </div>
    </div>
  );
}

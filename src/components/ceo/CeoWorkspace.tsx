"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import CeoOverview from "@/components/ceo/CeoOverview";
import CeoSegmentedControl from "@/components/ceo/CeoSegmentedControl";
import CeoBugCapture from "@/components/ceo/CeoBugCapture";
import CeoTasks from "@/components/ceo/CeoTasks";
import { cn } from "@/lib/utils";
import {
  CEO_PROJECT_KEYS,
  CEO_SURFACES,
  activeCeoFeatures,
  defaultCeoViewState,
  type CeoBootstrap,
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
          <CeoSegmentedControl
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

        <section className="mt-6 min-h-[65vh]">
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
              onBootstrap={setData}
            />
          ) : null}
          {state.surface === "tasks" ? (
            <CeoTasks project={project} features={features} />
          ) : null}
          {state.surface === "settings" ? <CeoSettings data={data} /> : null}
        </section>
      </div>
    </div>
  );
}

function CeoSettings({ data }: { data: CeoBootstrap }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/users"
          className="group rounded-2xl border border-border p-5 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between">
            <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
            <ArrowUpRight
              className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          </div>
          <h3 className="mt-5 font-semibold">Users</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Review registered accounts and open a top-up by email.
          </p>
        </Link>
        <Link
          href="/admin/tokens"
          className="group rounded-2xl border border-border p-5 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between">
            <WalletCards
              className="h-5 w-5 text-muted-foreground"
              aria-hidden
            />
            <ArrowUpRight
              className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          </div>
          <h3 className="mt-5 font-semibold">Tokens</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Look up balances and grant non-expiring tokens.
          </p>
        </Link>
        <div className="rounded-2xl border border-border p-5 sm:col-span-2">
          <h3 className="font-semibold">CEO Intelligence usage</h3>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <UsageMetric label="Runs" value={data.intelligence_usage?.runs ?? 0} />
            <UsageMetric
              label="Input tokens"
              value={data.intelligence_usage?.prompt_tokens ?? 0}
            />
            <UsageMetric
              label="Output tokens"
              value={data.intelligence_usage?.completion_tokens ?? 0}
            />
            <UsageMetric
              label="Total tokens"
              value={data.intelligence_usage?.total_tokens ?? 0}
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Counts include completed CEO Architecture and ML proposal runs only.
          </p>
        </div>
      </div>
    </div>
  );
}

function UsageMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        {new Intl.NumberFormat().format(value)}
      </p>
    </div>
  );
}

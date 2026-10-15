"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CeoBugCapture from "@/components/ceo/CeoBugCapture";
import CeoTasks from "@/components/ceo/CeoTasks";
import { cn } from "@/lib/utils";
import { withSessionBearer } from "@/lib/api/sessionBearer";
import {
  CEO_SURFACES,
  activeCeoFeatures,
  defaultCeoViewState,
  type CeoBootstrap,
  type CeoSurface,
  type CeoViewState,
} from "@/lib/ceo/domain";

const SURFACE_LABELS: Record<CeoSurface, string> = {
  overview: "Overview",
  bugs: "Bugs",
  tasks: "Tasks",
  settings: "Settings",
};

/* One project: Product. Research left the CEO panel (founder 2026-10-14). */
const project = "product";

function initialState(rows: CeoViewState[]): CeoViewState {
  const saved = rows.find((row) => row.project_key === project) ?? defaultCeoViewState(project);
  // The panel always opens on Bugs (founder 2026-10-14); the rest of the
  // remembered view (filters, sort) stays.
  return { ...saved, surface: "bugs" };
}

const BOOTSTRAP_KEY = "ceo-bootstrap:v1";

function readCachedBootstrap(): CeoBootstrap | null {
  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_KEY);
    return raw ? (JSON.parse(raw) as CeoBootstrap) : null;
  } catch {
    return null;
  }
}

function cacheBootstrap(data: CeoBootstrap) {
  try {
    window.localStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(data));
  } catch {
    /* too big or blocked: the next open waits for the backend, as before */
  }
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
  const [state, setState] = useState<CeoViewState>(() => initialState([]));
  const [bugDraft, setBugDraft] = useState("");
  useEffect(() => {
    setBugDraft(window.localStorage.getItem(`ceo-bug-draft-${project}`) ?? "");
    // SPEED (founder 2026-10-14): open on the last copy at once and refresh
    // it in the background, so the home-screen app is not blank while the
    // backend answers.
    const cached = readCachedBootstrap();
    if (cached) {
      setData(cached);
      setState(initialState(cached.view_state ?? []));
    }
    const controller = new AbortController();
    void withSessionBearer({ cache: "no-store", signal: controller.signal })
      .then((init) => fetch("/api/v2/admin/ceo/bootstrap", init))
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
        cacheBootstrap(bootstrap);
        setData(bootstrap);
        // The fresh copy never moves someone off the tab they already tapped.
        setState((prev) => ({ ...initialState(bootstrap.view_state ?? []), surface: prev.surface }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || cached) return;
        setLoadError(
          error instanceof Error ? error.message : "CEO could not be loaded."
        );
      });
    return () => controller.abort();
  }, []);

  const updateBugDraft = useCallback((value: string) => {
    setBugDraft(value);
    window.localStorage.setItem(`ceo-bug-draft-${project}`, value);
  }, []);

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
      setState((current) => {
        const next = { ...current, ...patch };
        persistState(next);
        return next;
      });
    },
    [persistState]
  );

  const features = useMemo(
    () => activeCeoFeatures(data?.features ?? [], project),
    [data?.features]
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
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-6">
        {/* Centred and small (founder 2026-10-14). */}
        <div className="flex justify-center">
          <nav
            className="flex items-center rounded-lg bg-muted p-0.5"
            aria-label="CEO surfaces"
          >
            {CEO_SURFACES.filter((surface) => surface === "bugs" || surface === "tasks").map(
              (surface) => (
                <button
                  key={surface}
                  type="button"
                  onClick={() => updateState({ surface })}
                  aria-current={state.surface === surface ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1 text-[13px] font-medium text-muted-foreground transition-colors",
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
              value={bugDraft}
              onChange={updateBugDraft}
            />
          ) : null}
          {state.surface === "tasks" ? (
            <CeoTasks project={project} features={features} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

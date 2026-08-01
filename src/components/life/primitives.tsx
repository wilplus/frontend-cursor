"use client";

import { useCallback, useEffect, useState } from "react";
import { STATUS } from "@/lib/life/copy";
import { fetchView, readView } from "@/lib/life/viewCache";
import { VoiceMark } from "@/components/willab/LoadingState";

/* -------------------------------------------------------------------------- */
/*  Shared panel primitives — heading, empty state, load state, one fetch hook */
/*                                                                            */
/*  Deliberately plain. The panel is neutral black/white/grey: `primary`       */
/*  (orange) is reserved for live-action signals, and none of this is one.     */
/*                                                                            */
/*  Nothing here renders a count-of-things-missing, a progress ring or a       */
/*  percentage. An empty view says the view is empty and how something gets    */
/*  into it, and stops (N3 / N4).                                              */
/* -------------------------------------------------------------------------- */

/** The line above a view's content, and nothing above that.
 *
 *  THE PAGE TITLE IS GONE (founder 2026-07-31). Every panel view used to open
 *  with its own name as an `h1` — "Today" over the Today pill, "Phrases" over
 *  the Phrases pill — which is the same word twice, 40px apart, and it cost
 *  the whole first screenful on a phone. The pill row names the view now, and
 *  it is the only thing that does.
 *
 *  The LEDE stays where a view has one: it says something the pill does not.
 *  A view whose lede is empty renders nothing at all here, which is why four
 *  of them no longer mount this component. */
export function PanelLede({
  lede,
  action,
}: {
  lede?: string;
  action?: React.ReactNode;
}) {
  if (!lede && !action) return null;
  return (
    <header className="mb-5 flex items-start justify-between gap-4">
      {lede ? (
        <p className="text-sm text-muted-foreground">{lede}</p>
      ) : (
        <span />
      )}
      {action}
    </header>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function LoadingLine() {
  // The one circular logo loader (VoiceMark), small, beside the same status
  // text as before — same component API, so every /panel view picks it up.
  return (
    <div className="flex items-center gap-2.5 py-8 text-sm text-muted-foreground">
      <VoiceMark size={24} />
      <span>{STATUS.loading}</span>
    </div>
  );
}

export function ErrorLine({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="py-8">
      <p className="text-sm text-muted-foreground">{STATUS.error}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full border border-border px-3.5 py-1.5 text-xs text-foreground hover:bg-muted"
        >
          {STATUS.retry}
        </button>
      ) : null}
    </div>
  );
}

/** Eyebrow used across the views. Same treatment as the Journal's. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

export function PanelCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-background p-4 ${className}`}
    >
      {children}
    </div>
  );
}

/* --------------------------------- fetching -------------------------------- */

export interface PanelResource<T> {
  data: T | null;
  /** True once a read has RESOLVED, whatever it resolved to. Kept separate from
   *  `data != null` on purpose: several reads legitimately resolve to null
   *  (no card written today, no strategy document yet), and collapsing the two
   *  would show "that did not load" where the honest answer is an empty state. */
  loaded: boolean;
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

/**
 * One read, with the three states every view needs and nothing more.
 *
 * `load` must be stable (wrap it in useCallback at the call site) or this
 * refetches on every render.
 */
export function usePanelResource<T>(
  load: () => Promise<T>,
  cacheKey?: string
): PanelResource<T> {
  /* `cacheKey` opts a view into the shell's stale-while-revalidate cache
   * (lib/life/viewCache): a cached answer renders on the FIRST frame and a
   * silent refresh swaps fresh data in when it lands. `undefined` means
   * absent — `null` is a real cached answer (fetchDay resolves to null), so
   * every test here is `!== undefined`, never truthiness. Keyless callers
   * (the principle detail, proposal cards) behave exactly as before. */
  const cached = cacheKey ? readView<T>(cacheKey) : undefined;
  const [data, setData] = useState<T | null>(
    cached !== undefined ? cached : null
  );
  const [loaded, setLoaded] = useState(cached !== undefined);
  const [loading, setLoading] = useState(cached === undefined);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const had = cacheKey ? readView<T>(cacheKey) : undefined;
    if (had !== undefined) {
      // Serve the cache now; the fetch below is a revalidation, not a load,
      // so the view must not flicker back into its loading state.
      setData(had);
      setLoaded(true);
      setLoading(false);
      setFailed(false);
    } else {
      setLoading(true);
      setFailed(false);
    }
    // fetchView JOINS a request the shell's warm-up already has in flight,
    // so opening a view mid-warm-up costs one request, not two.
    void (cacheKey ? fetchView(cacheKey, load) : load())
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setLoaded(true);
        setLoading(false);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        // STALE BEATS ERROR: a failed refresh keeps the data on screen. A
        // failed FIRST load is still the honest error state — there is
        // nothing truthful to show instead.
        if (had === undefined) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [load, nonce, cacheKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loaded, loading, failed, reload };
}

/** Wraps the three states so views do not each re-implement the branch. A read
 *  that resolved to null reaches `children` as null, so the view can tell an
 *  empty surface from a broken one. */
export function Resource<T>({
  resource,
  children,
}: {
  resource: PanelResource<T>;
  children: (data: T) => React.ReactNode;
}) {
  if (resource.loading) return <LoadingLine />;
  if (resource.failed || !resource.loaded) {
    return <ErrorLine onRetry={resource.reload} />;
  }
  return <>{children(resource.data as T)}</>;
}

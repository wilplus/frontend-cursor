"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchPanelResource,
  readPanelCache,
} from "@/lib/life/panelCache";
import { STATUS } from "@/lib/life/copy";
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
 * `key` names the read so it can be cached and prefetched (see
 * `lib/life/panelCache`). It must identify the DATA, not the component: two
 * mounts of the same list share a key, and `/panel/principles/:id` carries the
 * id or two principles would show each other's detail.
 *
 * `load` must be stable (wrap it in useCallback at the call site) or this
 * refetches on every render.
 *
 * A CACHED READ RENDERS WITHOUT A SPINNER and refreshes behind the screen.
 * `loading` therefore means "we have nothing to show yet", not "a request is
 * in flight" — the two used to be the same thing and are not any more. Every
 * view keys its spinner off `loading`, so a revisit paints instantly and a
 * first visit is unchanged.
 */
export function usePanelResource<T>(
  key: string,
  load: () => Promise<T>
): PanelResource<T> {
  const cached = readPanelCache<T>(key);
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loaded, setLoaded] = useState(cached !== undefined);
  const [loading, setLoading] = useState(cached === undefined);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Re-read the cache HERE as well as at first render: the key can change
    // under a mounted component (principle A → principle B), and a prefetch
    // may have landed between render and effect.
    const warm = readPanelCache<T>(key);
    if (warm !== undefined) {
      setData(warm);
      setLoaded(true);
      setLoading(false);
    } else {
      setData(null);
      setLoaded(false);
      setLoading(true);
    }
    setFailed(false);

    void fetchPanelResource(key, load)
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setLoaded(true);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // A failed REVALIDATION keeps what is on screen: the rows are still
        // the last thing the server told us, and blanking them because a
        // background refresh timed out is a worse answer than showing them.
        // Only a read with nothing behind it becomes the error state.
        if (readPanelCache<T>(key) === undefined && warm === undefined) {
          setFailed(true);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, load, nonce]);

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

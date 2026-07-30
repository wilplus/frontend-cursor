"use client";

import { useCallback, useEffect, useState } from "react";
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

export function PanelHeading({
  title,
  lede,
  action,
}: {
  title: string;
  lede?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {lede ? (
          <p className="mt-1 text-sm text-muted-foreground">{lede}</p>
        ) : null}
      </div>
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
export function usePanelResource<T>(load: () => Promise<T>): PanelResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void load()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setLoaded(true);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, nonce]);

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

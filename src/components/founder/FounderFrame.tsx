/* The shared frame of the founder's operator pages (rings, pace, research):
 * a title, one line under it, and the page. Operator copy on founder-only
 * pages; nothing here reaches a speaker. */
import type { ReactNode } from "react";

export function FounderFrame({ title, line, children }: { title: string; line: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-foreground/60">{line}</p>
      </header>
      {children}
    </main>
  );
}

export function Panel({ title, note, children }: { title: string; note?: string | null; children?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

export function Refusal({ code }: { code: string }) {
  const line = code === "FORBIDDEN" || code === "UNAUTHENTICATED" ? "Not available for this account." : `Could not read (${code}).`;
  return <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{line}</p>;
}

export function Meter({ value, of, label }: { value: number; of: number; label: string }) {
  const pct = of > 0 ? Math.min(100, Math.round((value / of) * 100)) : 0;
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={of}
      aria-valuenow={Math.min(value, of)}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
    </div>
  );
}

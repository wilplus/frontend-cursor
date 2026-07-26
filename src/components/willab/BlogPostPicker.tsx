"use client";

import { useEffect, useMemo, useState } from "react";
import {
  JOURNAL_CATEGORIES,
  categoryLabel,
  fetchPublishedPosts,
  filterJournalPosts,
  sortJournalPosts,
  type JournalCategory,
  type JournalPostSummary,
} from "@/services/api/journal";

/* -------------------------------------------------------------------------- */
/*  BlogPostPicker — choose a published post to attach as a reference          */
/*                                                                            */
/*  Only PUBLISHED posts are listed, because the list comes from the public    */
/*  endpoint: a draft cannot be attached, which is the same rule that makes    */
/*  the student-side link impossible to break. Search and category filter      */
/*  reuse the index's own helpers, so "Voice" means the same thing here as it  */
/*  does on /blog.                                                            */
/* -------------------------------------------------------------------------- */

export default function BlogPostPicker({
  value,
  onChange,
  disabled = false,
}: {
  /** Currently attached post slug, or null. */
  value: string | null;
  /** null clears the attachment. */
  onChange: (post: JournalPostSummary | null) => void;
  disabled?: boolean;
}) {
  const [posts, setPosts] = useState<JournalPostSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<JournalCategory | "all">("all");

  useEffect(() => {
    let active = true;
    void fetchPublishedPosts().then((r) => {
      if (active) setPosts(r);
    });
    return () => {
      active = false;
    };
  }, []);

  const shown = useMemo(
    () =>
      sortJournalPosts(
        filterJournalPosts(posts ?? [], { query, category }),
        "newest"
      ),
    [posts, query, category]
  );

  const selected = (posts ?? []).find((p) => p.slug === value) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {selected ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {categoryLabel(selected.category)}
            </p>
            <p className="truncate text-[14px] font-medium text-foreground">
              {selected.title}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="shrink-0 text-[12px] text-muted-foreground underline underline-offset-2 transition hover:text-foreground disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      ) : null}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search posts…"
        aria-label="Search posts"
        disabled={disabled}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition focus:border-foreground/30 focus:outline-none disabled:opacity-40"
      />

      <div className="flex flex-wrap gap-1.5">
        {(
          [{ key: "all" as const, label: "All" }, ...JOURNAL_CATEGORIES] as const
        ).map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key as JournalCategory | "all")}
              disabled={disabled}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition disabled:opacity-40 ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
        {posts === null ? (
          <p className="px-3 py-4 text-[12px] text-muted-foreground">
            Loading posts…
          </p>
        ) : shown.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-muted-foreground">
            {posts.length === 0
              ? "No published posts to attach yet."
              : "Nothing matches that."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => onChange(p)}
                  disabled={disabled}
                  className={`block w-full px-3 py-2 text-left transition hover:bg-muted/50 disabled:opacity-40 ${
                    p.slug === value ? "bg-muted/60" : ""
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {categoryLabel(p.category)}
                  </span>
                  <span className="block truncate text-[13px] text-foreground">
                    {p.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import JournalCard from "@/components/journal/JournalCard";
import {
  JOURNAL_CATEGORIES,
  filterJournalPosts,
  sortJournalPosts,
  type JournalCategory,
  type JournalPostSummary,
  type JournalSort,
} from "@/services/api/journal";

/* -------------------------------------------------------------------------- */
/*  JournalIndex — search / category / sort over the server-fetched list       */
/*                                                                            */
/*  Filtering is in memory (instant, no refetch): the server already handed us  */
/*  every published post. No hero — the page opens search-first.               */
/* -------------------------------------------------------------------------- */

const SORTS: ReadonlyArray<{ key: JournalSort; label: string }> = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "curated", label: "Curated" },
];

export default function JournalIndex({
  posts,
}: {
  posts: JournalPostSummary[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<JournalCategory | "all">("all");
  const [sort, setSort] = useState<JournalSort>("newest");

  const visible = useMemo(
    () => sortJournalPosts(filterJournalPosts(posts, { query, category }), sort),
    [posts, query, category, sort]
  );

  return (
    <main>
      {/* The design opens search-first with no hero, but the page still needs a
          real heading: it names the page for screen readers and is the h1 a
          blog index is ranked on. Visually hidden, structurally present. */}
      <h1 className="sr-only">Journal</h1>

      {/* Sticky under the h-14 SiteHeader — but only from sm up: on a small
          phone the chips wrap to three rows, and a sticky bar that tall plus
          the header and the pinned footer would leave almost no room to read. */}
      <div className="border-y border-border/70 bg-background/85 backdrop-blur sm:sticky sm:top-14 sm:z-20">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title..."
                aria-label="Search the Journal"
                className="w-full rounded-full border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground transition placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as JournalSort)}
                aria-label="Sort posts"
                className="rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground transition focus:border-foreground/30 focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[{ key: "all" as const, label: "All" }, ...JOURNAL_CATEGORIES].map(
              (c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    aria-pressed={active}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      active
                        ? "border border-foreground bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              }
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-12">
        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {posts.length === 0
              ? "No posts yet. Check back soon."
              : "Nothing matches that search."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <JournalCard key={p.slug} post={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

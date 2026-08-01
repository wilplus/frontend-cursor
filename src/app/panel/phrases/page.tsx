"use client";

import { useCallback } from "react";
import { EMPTY, VIEWS } from "@/lib/life/copy";
import { fetchItems } from "@/services/api/life";
import type { LifeItem } from "@/lib/life/types";
import {
  EmptyState,
  Eyebrow,
  PanelLede,
  Resource,
  usePanelResource,
} from "@/components/life/primitives";

/* -------------------------------------------------------------------------- */
/*  FE-9 — Phrases. Grouped by collection ("2022-24", "2025", "2026", "wall"). */
/*                                                                            */
/*  The wall is a RETRIEVAL BASE, not a destination: every # note gets the     */
/*  single best-fitting phrase attached to its answer, which is what makes     */
/*  this list worth keeping. #add is the only way in, so there is no add form  */
/*  here on purpose (spec §5).                                                */
/* -------------------------------------------------------------------------- */

/** "wall" first, then collections newest-labelled first, then anything else. */
function groupPhrases(items: LifeItem[]): Array<[string, LifeItem[]]> {
  const groups = new Map<string, LifeItem[]>();
  for (const item of items) {
    const key = item.collection ?? "Uncollected";
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "wall") return -1;
    if (b === "wall") return 1;
    return b.localeCompare(a);
  });
}

function collectionLabel(key: string): string {
  return key === "wall" ? "The wall" : key;
}

export default function PhrasesPage() {
  const load = useCallback(() => fetchItems("phrase"), []);
  const resource = usePanelResource(load, "phrases");

  return (
    <>
      <PanelLede lede={VIEWS.phrases.lede} />
      <Resource resource={resource}>
        {(phrases) =>
          phrases.length === 0 ? (
            <EmptyState>{EMPTY.phrases}</EmptyState>
          ) : (
            <div className="space-y-8">
              {groupPhrases(phrases).map(([collection, list]) => (
                <section key={collection}>
                  <Eyebrow>{collectionLabel(collection)}</Eyebrow>
                  <ul className="mt-3 space-y-3">
                    {list.map((phrase) => (
                      <li
                        key={phrase.id}
                        className="rounded-2xl border border-border bg-background px-4 py-3 text-[15px] leading-[1.7] text-foreground/90"
                      >
                        {phrase.title || phrase.body}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )
        }
      </Resource>
    </>
  );
}

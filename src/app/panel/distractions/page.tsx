"use client";

import { useCallback, useState } from "react";
import { EMPTY, VIEWS } from "@/lib/life/copy";
import { fetchItems, updateItem } from "@/services/api/life";
import type { LifeItem } from "@/lib/life/types";
import {
  EmptyState,
  Eyebrow,
  PanelHeading,
  Resource,
  usePanelResource,
} from "@/components/life/primitives";

/* -------------------------------------------------------------------------- */
/*  FE-9 — Distractions, each paired with its environmental response.          */
/*                                                                            */
/*  THE PAIRING IS THE POINT, so a distraction is NEVER shown alone. The       */
/*  founder's Section IV answers every distraction with a design change, not   */
/*  with willpower, and a list of distractions on their own is just a list of  */
/*  failures. A row with no response yet renders the empty response field      */
/*  instead of hiding it, because the missing half is the actionable part.     */
/* -------------------------------------------------------------------------- */

export default function DistractionsPage() {
  const load = useCallback(() => fetchItems("distraction"), []);
  const resource = usePanelResource(load);

  return (
    <>
      <PanelHeading
        title={VIEWS.distractions.title}
        lede={VIEWS.distractions.lede}
      />
      <Resource resource={resource}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState>{EMPTY.distractions}</EmptyState>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id}>
                  <DistractionRow item={item} />
                </li>
              ))}
            </ul>
          )
        }
      </Resource>
    </>
  );
}

function DistractionRow({ item }: { item: LifeItem }) {
  const [response, setResponse] = useState(item.body);
  const [saved, setSaved] = useState(item.body);

  async function commit() {
    const next = response.trim();
    if (next === saved) return;
    setSaved(next);
    try {
      await updateItem(item.id, { body: next });
    } catch {
      setResponse(saved);
      setSaved(saved);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <Eyebrow>The distraction</Eyebrow>
      <p className="mt-1 text-[15px] text-foreground">{item.title}</p>

      <div className="mt-4">
        <Eyebrow>What you changed so it stops working</Eyebrow>
        <textarea
          value={response}
          rows={2}
          onChange={(e) => setResponse(e.target.value)}
          onBlur={() => void commit()}
          placeholder="The change to the room, the phone, the calendar. Not the resolve."
          className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-foreground/30"
        />
      </div>
    </div>
  );
}

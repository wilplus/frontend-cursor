"use client";

import { useCallback, useState } from "react";
import { EMPTY, VIEWS } from "@/lib/life/copy";
import { fetchItems, updateItem } from "@/services/api/life";
import type { LifeItem } from "@/lib/life/types";
import {
  EmptyState,
  PanelLede,
  Resource,
  usePanelResource,
} from "@/components/life/primitives";

/** FE-9 — Wins. Trophy rows with inline edit. The UI is a port of the
 *  principles-app list; only the data source changed. */
export default function WinsPage() {
  const load = useCallback(() => fetchItems("win"), []);
  const resource = usePanelResource(load, "wins");

  return (
    <>
      <PanelLede lede={VIEWS.wins.lede} />
      <Resource resource={resource}>
        {(wins) =>
          wins.length === 0 ? (
            <EmptyState>{EMPTY.wins}</EmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {wins.map((win) => (
                <li key={win.id} className="px-4 py-3.5">
                  <WinRow win={win} />
                </li>
              ))}
            </ul>
          )
        }
      </Resource>
    </>
  );
}

function WinRow({ win }: { win: LifeItem }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(win.title || win.body);
  const [saved, setSaved] = useState(win.title || win.body);

  async function commit() {
    setEditing(false);
    const next = text.trim();
    if (!next || next === saved) {
      setText(saved);
      return;
    }
    setSaved(next);
    try {
      await updateItem(win.id, { title: next });
    } catch {
      // Put the user's own text back rather than pretending the save landed.
      setSaved(saved);
      setText(saved);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <span className="text-lg leading-none" aria-hidden>
        🏆
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            autoFocus
            value={text}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => void commit()}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-foreground/30"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="block w-full text-left text-[15px] leading-relaxed text-foreground"
          >
            {saved}
          </button>
        )}
        {win.createdAt ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDay(win.createdAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

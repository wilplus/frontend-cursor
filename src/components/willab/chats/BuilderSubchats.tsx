"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import type { ChangeStructure, Subchat } from "@/services/api/chatStructure";
import ProjectRowMenu, { type RowMenuAction } from "../ProjectRowMenu";
import { useChatStructure } from "./useChatStructure";

export function subchatActions(child: Subchat, change: (action: ChangeStructure) => Promise<boolean>): RowMenuAction[] {
  return [
    {
      label: child.archived ? "Restore" : "Archive",
      icon: child.archived ? ArchiveRestore : Archive,
      onRun: () => change({ action: child.archived ? "restore" : "archive", section: child.id }),
    },
    {
      label: "Delete", icon: Trash2, destructive: true,
      confirm: { title: `Delete ${child.title}?`, body: "This deletes the subchat and its saved conversation.", confirmLabel: "Delete" },
      onRun: () => change({ action: "delete", section: child.id }),
    },
  ];
}

export default function BuilderSubchats() {
  const { layout, change } = useChatStructure();
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!layout || layout.builder !== "active") return null;
  return (
    <section className="space-y-2 border-t border-border px-4 py-4">
      <h3 className="text-sm font-semibold">Subchats</h3>
      {layout.subchats.map((child) => (
        <div key={child.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0 break-words">{child.title}{child.archived ? " · Archived" : ""}</span>
          <ProjectRowMenu label={child.title} actions={subchatActions(child, change)} />
        </div>
      ))}
      <form className="flex flex-wrap items-end gap-2" onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim() || !question.trim() || busy) return;
        setBusy(true);
        const ok = await change({ action: "add", title, question });
        setBusy(false);
        setFailed(!ok);
        if (ok) { setTitle(""); setQuestion(""); }
      }}>
        <input aria-label="Subchat name" placeholder="Subchat name" className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3" maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} />
        <input aria-label="Opening question" placeholder="Opening question" className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3" maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} />
        <button className="min-h-11 rounded-lg border border-border px-3 text-sm" type="submit" disabled={busy || !title.trim() || !question.trim()}>Add</button>
      </form>
      {failed ? <p role="alert" className="text-sm text-muted-foreground">Couldn’t save. Try again.</p> : null}
    </section>
  );
}

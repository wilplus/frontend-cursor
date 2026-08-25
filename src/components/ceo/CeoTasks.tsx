"use client";

import {
  Archive,
  Check,
  ClipboardCopy,
  Download,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CeoFeature, CeoProjectKey } from "@/lib/ceo/domain";
import {
  actOnCeoTask,
  ceoTaskAgentText,
  createCeoTask,
  deleteCeoTask,
  listCeoTasks,
  moveCeoTask,
  reorderCeoTask,
  retryCeoBug,
  updateCeoTask,
  type CeoTask,
  type CeoTaskStatus,
} from "@/lib/ceo/workItems";
import { useCeoTaskReorder } from "./useCeoTaskReorder";

const VIEW_LABELS: Record<CeoTaskStatus, string> = {
  active: "Active",
  done: "Done",
  archived: "Archive",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function taskHtml(task: CeoTask): string {
  const images = task.attachments
    .filter((attachment) => attachment.kind === "image")
    .map(
      (attachment) =>
        `<p><img src="${escapeHtml(attachment.data_url)}" alt="Task attachment" /></p>`
    )
    .join("");
  return `<section><h2>[P${task.priority}] ${escapeHtml(task.title)}</h2>${
    task.user_story ? `<p><em>${escapeHtml(task.user_story)}</em></p>` : ""
  }<p>${escapeHtml(task.body).replaceAll("\n", "<br />")}</p>${images}</section>`;
}

async function copyTasks(tasks: CeoTask[]): Promise<void> {
  const plain = tasks.map(ceoTaskAgentText).join("\n\n---\n\n");
  const html = tasks.map(taskHtml).join("<hr />");
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return;
    } catch {
      // Plain text remains usable in browsers that reject rich clipboard data.
    }
  }
  await navigator.clipboard.writeText(plain);
}

export default function CeoTasks({
  project,
  features,
}: {
  project: CeoProjectKey;
  features: CeoFeature[];
}) {
  const [tasks, setTasks] = useState<CeoTask[]>([]);
  const [view, setView] = useState<CeoTaskStatus>("active");
  const [featureId, setFeatureId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTasks(await listCeoTasks(project, view, featureId || null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, [featureId, project, view]);

  useEffect(() => {
    setFeatureId("");
    setView("active");
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!tasks.some((task) => task.generation_status === "pending")) return;
    const timer = window.setTimeout(() => void load(), 3000);
    return () => window.clearTimeout(timer);
  }, [load, tasks]);

  const commitMove = useCallback(
    (from: number, to: number) => {
      setTasks((current) => {
        const next = moveCeoTask(current, from, to);
        const moved = next[to];
        const afterId = to === 0 ? null : next[to - 1]?.id ?? null;
        if (moved) {
          void reorderCeoTask(project, moved.id, afterId).catch(() => void load());
        }
        return next;
      });
    },
    [load, project]
  );
  const reorder = useCeoTaskReorder(
    view === "active" ? tasks.length : 0,
    commitMove
  );

  async function run(action: () => Promise<void>, success?: string) {
    setError(null);
    setNote(null);
    try {
      await action();
      if (success) setNote(success);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That action failed.");
    }
  }

  async function copyAll() {
    if (!tasks.length) return;
    try {
      await copyTasks(tasks);
      setNote(`Copied ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}.`);
    } catch {
      setError("Clipboard access was refused.");
    }
  }

  async function downloadExport() {
    setError(null);
    try {
      const query = new URLSearchParams({ project });
      if (featureId) query.set("feature_id", featureId);
      const response = await fetch(
        `/api/v2/admin/ceo/work-items/tasks/export?${query}`
      );
      if (!response.ok) throw new Error("Could not export tasks.");
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `ceo-${project}-tasks.md`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export tasks.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-4 border-b border-border pb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {project === "product" ? "Product" : "Research"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Tasks</h2>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Task
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-muted p-1">
            {(["active", "done", "archived"] as CeoTaskStatus[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground",
                  view === item && "bg-background text-foreground shadow-sm"
                )}
              >
                {VIEW_LABELS[item]}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter tasks by feature"
            value={featureId}
            onChange={(event) => setFeatureId(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          >
            <option value="">All features</option>
            {features.map((feature) => (
              <option key={feature.id} value={feature.id}>
                {feature.name}
              </option>
            ))}
          </select>
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => void copyAll()}
              disabled={!tasks.length}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-35"
            >
              <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
              Copy all
            </button>
            <button
              type="button"
              onClick={() => void downloadExport()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Export
            </button>
          </div>
        </div>
      </div>

      {creating ? (
        <TaskEditor
          features={features}
          submitLabel="Create task"
          onCancel={() => setCreating(false)}
          onSave={async (draft) => {
            await createCeoTask(project, draft);
            setCreating(false);
            await load();
          }}
        />
      ) : null}

      {note ? <p className="mt-4 text-sm text-muted-foreground">{note}</p> : null}
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <p className="py-14 text-center text-sm text-muted-foreground">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="py-14 text-center text-sm text-muted-foreground">
          No {VIEW_LABELS[view].toLowerCase()} tasks.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {tasks.map((task, index) => {
            const row = reorder.rowProps(index);
            return (
              <article
                key={task.id}
                ref={row.ref}
                className={cn(
                  "rounded-2xl border border-border bg-background p-4 transition-colors",
                  row.className,
                  reorder.draggingIndex === index && "opacity-60"
                )}
              >
                {editingId === task.id ? (
                  <TaskEditor
                    task={task}
                    features={features}
                    submitLabel="Save"
                    onCancel={() => setEditingId(null)}
                    onSave={async (draft) => {
                      await updateCeoTask(project, task.id, draft);
                      setEditingId(null);
                      await load();
                    }}
                  />
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      {view === "active" ? (
                        <button
                          type="button"
                          {...reorder.handleProps(index)}
                          aria-label="Drag to reorder task"
                          className="mt-0.5 grid h-8 w-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                        >
                          <GripVertical className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label={`Priority for ${task.title}`}
                            value={task.priority}
                            onChange={(event) =>
                              void run(
                                () =>
                                  updateCeoTask(project, task.id, {
                                    priority: Number(event.target.value) as 1 | 2 | 3,
                                  }).then(() => undefined),
                                "Priority updated."
                              )
                            }
                            className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold"
                          >
                            <option value={1}>P1</option>
                            <option value={2}>P2</option>
                            <option value={3}>P3</option>
                          </select>
                          <select
                            aria-label={`Feature for ${task.title}`}
                            value={task.feature_id ?? ""}
                            onChange={(event) =>
                              void run(
                                () =>
                                  updateCeoTask(project, task.id, {
                                    feature_id: event.target.value || null,
                                  }).then(() => undefined),
                                "Feature updated."
                              )
                            }
                            className="max-w-52 rounded-full border border-border bg-background px-2 py-1 text-[11px]"
                          >
                            <option value="">Unassigned</option>
                            {features.map((feature) => (
                              <option key={feature.id} value={feature.id}>
                                {feature.name}
                              </option>
                            ))}
                          </select>
                          {task.generation_status !== "ready" &&
                          task.generation_status !== "manual" ? (
                            <span className="text-[11px] text-muted-foreground">
                              {task.generation_status === "pending"
                                ? "Preparing…"
                                : "Preparation failed"}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-3 font-semibold leading-snug">{task.title}</h3>
                        {task.user_story ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {task.user_story}
                          </p>
                        ) : null}
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                          {task.body}
                        </p>
                        {task.attachments.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {task.attachments
                              .filter((attachment) => attachment.kind === "image")
                              .map((attachment, attachmentIndex) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={`${attachment.name}-${attachmentIndex}`}
                                  src={attachment.data_url}
                                  alt="Task attachment"
                                  className="h-24 w-24 rounded-lg border border-border object-cover"
                                />
                              ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-1 border-t border-border pt-3">
                      {task.generation_status === "failed" && task.bug_id ? (
                        <TaskButton
                          label="Retry"
                          icon={RotateCcw}
                          onClick={() =>
                            void run(
                              () => retryCeoBug(project, task.bug_id as string),
                              "Task preparation restarted."
                            )
                          }
                        />
                      ) : null}
                      <TaskButton
                        label="Copy"
                        icon={ClipboardCopy}
                        onClick={() =>
                          void copyTasks([task])
                            .then(() => setNote("Task copied."))
                            .catch(() => setError("Clipboard access was refused."))
                        }
                      />
                      <TaskButton
                        label="Edit"
                        icon={Pencil}
                        onClick={() => setEditingId(task.id)}
                      />
                      {view === "active" ? (
                        <TaskButton
                          label="Done"
                          icon={Check}
                          onClick={() =>
                            void run(
                              () => actOnCeoTask(project, task.id, "done"),
                              "Marked done. Overview reevaluation requested."
                            )
                          }
                        />
                      ) : (
                        <TaskButton
                          label="Restore"
                          icon={RotateCcw}
                          onClick={() =>
                            void run(() => actOnCeoTask(project, task.id, "restore"))
                          }
                        />
                      )}
                      {view !== "archived" ? (
                        <TaskButton
                          label="Archive"
                          icon={Archive}
                          onClick={() =>
                            void run(() => actOnCeoTask(project, task.id, "archive"))
                          }
                        />
                      ) : null}
                      <TaskButton
                        label="Delete"
                        icon={Trash2}
                        danger
                        onClick={() => {
                          const linked = task.bug_id
                            ? " This also deletes its source bug."
                            : "";
                          if (
                            window.confirm(
                              `Permanently delete this task?${linked} This cannot be undone.`
                            )
                          ) {
                            void run(() => deleteCeoTask(project, task.id));
                          }
                        }}
                      />
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskButton({
  label,
  icon: Icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
        danger && "hover:bg-destructive/10 hover:text-destructive"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function TaskEditor({
  task,
  features,
  submitLabel,
  onCancel,
  onSave,
}: {
  task?: CeoTask;
  features: CeoFeature[];
  submitLabel: string;
  onCancel: () => void;
  onSave: (draft: {
    title: string;
    user_story: string | null;
    body: string;
    priority: 1 | 2 | 3;
    feature_id: string | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [story, setStory] = useState(task?.user_story ?? "");
  const [body, setBody] = useState(task?.body ?? "");
  const [priority, setPriority] = useState<1 | 2 | 3>(task?.priority ?? 2);
  const [featureId, setFeatureId] = useState(task?.feature_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!body.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title:
          title.trim() || body.trim().split("\n")[0]?.slice(0, 100) || "Task",
        user_story: story.trim() || null,
        body: body.trim(),
        priority,
        feature_id: featureId || null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the task.");
      setSaving(false);
    }
  }

  return (
    <div className={cn("space-y-3", !task && "mt-5 rounded-2xl border border-border p-4")}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{task ? "Edit task" : "New task"}</h3>
        <button type="button" onClick={onCancel} aria-label="Cancel">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Task title"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
      />
      <input
        value={story}
        onChange={(event) => setStory(event.target.value)}
        placeholder="User story (optional)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Agent-ready task"
        rows={7}
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
      />
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Priority"
          value={priority}
          onChange={(event) => setPriority(Number(event.target.value) as 1 | 2 | 3)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value={1}>P1</option>
          <option value={2}>P2</option>
          <option value={3}>P3</option>
        </select>
        <select
          aria-label="Feature"
          value={featureId}
          onChange={(event) => setFeatureId(event.target.value)}
          className="min-w-48 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Unassigned</option>
          {features.map((feature) => (
            <option key={feature.id} value={feature.id}>
              {feature.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !body.trim()}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-35"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

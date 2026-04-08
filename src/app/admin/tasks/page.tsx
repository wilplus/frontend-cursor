"use client";

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { adminApi, type Task } from "@/lib/api/admin-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Pencil, Trash2, Plus } from "lucide-react";

function stripHtmlToText(input: string | null | undefined): string {
  if (!input) return "";
  if (typeof window === "undefined") return input;
  const div = document.createElement("div");
  div.innerHTML = input;
  return (div.textContent || div.innerText || "").trim();
}

function isRichTextEmpty(input: string | null | undefined): boolean {
  return stripHtmlToText(input).length === 0;
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    title: "",
    prompt_text: "",
    min_task_score: 0,
    max_task_score: 0.3,
  });
  const promptEditorRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getTasks()
      .then(setTasks)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (t.title ?? "").toLowerCase().includes(q) ||
        stripHtmlToText(t.prompt_text ?? "").toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  useEffect(() => {
    if (!dialogOpen || !promptEditorRef.current) return;
    promptEditorRef.current.innerHTML = form.prompt_text;
  }, [dialogOpen, form.prompt_text]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      prompt_text: "",
      min_task_score: 0,
      max_task_score: 0.3,
    });
    setDialogOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      title: t.title ?? "",
      prompt_text: t.prompt_text ?? "",
      min_task_score: t.min_task_score ?? 0,
      max_task_score: t.max_task_score ?? 0.3,
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (isRichTextEmpty(form.prompt_text)) {
      toast.error("Prompt text is required");
      return;
    }
    if (editing) {
      adminApi
        .updateTask(editing.id, { ...form, is_active: true })
        .then(() => {
          toast.success("Task updated");
          setDialogOpen(false);
          load();
        })
        .catch((e) => toast.error(e.message));
    } else {
      adminApi
        .createTask({ ...form, is_active: true })
        .then(() => {
          toast.success("Task created");
          setDialogOpen(false);
          load();
        })
        .catch((e) => toast.error(e.message));
    }
  };

  const remove = (id: string) => {
    if (!confirm("Remove this task from the library? Assignment per student is set in each student's profile.")) return;
    adminApi
      .deleteTask(id)
      .then(() => {
        toast.success("Task removed from library");
        load();
      })
      .catch((e) => toast.error(e.message));
  };

  const applyEditorCommand = (command: string, value?: string) => {
    promptEditorRef.current?.focus();
    document.execCommand(command, false, value);
    setForm((p) => ({
      ...p,
      prompt_text: promptEditorRef.current?.innerHTML ?? p.prompt_text,
    }));
  };

  if (loading) return <p className="text-muted-foreground">Loading tasks…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="text-muted-foreground mt-1">Task library. Which tasks each student sees is set per student in their profile.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Add Task
        </Button>
      </div>

      <ul className="space-y-2">
        {filtered.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            {searchQuery.trim() ? "No tasks match your search." : "No tasks yet. Add one."}
          </li>
        ) : (
          filtered.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{t.title}</span>
                {t.prompt_text && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{stripHtmlToText(t.prompt_text)}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Task score range: {(t.min_task_score ?? 0)} – {(t.max_task_score ?? 1)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => remove(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex min-h-screen min-w-full items-center justify-center overflow-y-auto bg-black/50 py-12 px-4">
          <div className="my-auto w-full max-w-lg rounded-xl bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? "Edit Task" : "New Task"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setDialogOpen(false)}>
                ×
              </Button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Title *</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Prompt Text *</label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => applyEditorCommand("bold")}>
                      Bold
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => applyEditorCommand("italic")}>
                      Italic
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyEditorCommand("insertUnorderedList")}
                    >
                      Bullet list
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyEditorCommand("insertOrderedList")}
                    >
                      Numbered list
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = window.prompt("Enter link URL");
                        if (!url) return;
                        applyEditorCommand("createLink", url);
                      }}
                    >
                      Link
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyEditorCommand("removeFormat")}
                    >
                      Clear format
                    </Button>
                  </div>
                  <div
                    ref={promptEditorRef}
                    className="min-h-[120px] w-full rounded-md border border-input px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring"
                    role="textbox"
                    aria-label="Prompt text"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) =>
                      setForm((p) => ({
                        ...p,
                        prompt_text: (e.currentTarget as HTMLDivElement).innerHTML,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    You can use bold, italic, lists, and links.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Min Task Score</label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.min_task_score}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, min_task_score: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Max Task Score</label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.max_task_score}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, max_task_score: parseFloat(e.target.value) || 0.3 }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

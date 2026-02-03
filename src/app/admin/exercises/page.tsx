"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import SectionCard from "@/components/admin/SectionCard";
import { adminApi, type Exercise } from "@/lib/api/admin-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Pencil, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    title: "",
    video_url: "",
    description: "",
    min_task_score: 0,
    max_task_score: 1,
    is_active: true,
  });

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getExercises()
      .then(setExercises)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    const q = searchQuery.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (e.title ?? "").toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q)
    );
  }, [exercises, searchQuery]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      video_url: "",
      description: "",
      min_task_score: 0,
      max_task_score: 1,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (e: Exercise) => {
    setEditing(e);
    setForm({
      title: e.title ?? "",
      video_url: e.video_url ?? "",
      description: e.description ?? "",
      min_task_score: e.min_task_score ?? 0,
      max_task_score: e.max_task_score ?? 1,
      is_active: e.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (editing) {
      adminApi
        .updateExercise(editing.id, form)
        .then(() => {
          toast.success("Exercise updated");
          setDialogOpen(false);
          load();
        })
        .catch((e) => toast.error(e.message));
    } else {
      adminApi
        .createExercise(form)
        .then(() => {
          toast.success("Exercise created");
          setDialogOpen(false);
          load();
        })
        .catch((e) => toast.error(e.message));
    }
  };

  const remove = (id: string) => {
    if (!confirm("Deactivate this exercise? It will no longer appear in the student flow.")) return;
    adminApi
      .deleteExercise(id)
      .then(() => {
        toast.success("Exercise deactivated");
        load();
      })
      .catch((e) => toast.error(e.message));
  };

  if (loading) return <p className="text-muted-foreground">Loading exercises…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Exercises</h1>
        <p className="text-muted-foreground mt-1">Manage exercise library for student sessions</p>
      </div>

      <div className="rounded-lg border border-primary/30 bg-accent/30 px-4 py-3 text-sm text-foreground">
        Note: If no exercises are active, students will skip the exercise step in their session.
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Add Exercise
        </Button>
      </div>

      <ul className="space-y-2">
        {filtered.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            {searchQuery.trim() ? "No exercises match your search." : "No exercises. Add one to show the exercise step."}
          </li>
        ) : (
          filtered.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{e.title}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      e.is_active !== false
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {e.is_active !== false ? "Active" : "Inactive"}
                  </span>
                </div>
                {e.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{e.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Task score range: {(e.min_task_score ?? 0)} – {(e.max_task_score ?? 1)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Active</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={e.is_active !== false}
                  onClick={() =>
                    adminApi
                      .updateExercise(e.id, { ...e, is_active: e.is_active === false })
                      .then(() => load())
                      .catch((err) => toast.error(err.message))
                  }
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    e.is_active !== false ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform",
                      e.is_active !== false ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
                <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(e)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => remove(e.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">{editing ? "Edit Exercise" : "New Exercise"}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Title *</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Video URL *</label>
                <Input
                  value={form.video_url}
                  onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
                  placeholder="https://example.com/video1.mp4"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Description *</label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
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
                      setForm((p) => ({ ...p, max_task_score: parseFloat(e.target.value) || 1 }))
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                Active (show in student flow)
              </label>
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

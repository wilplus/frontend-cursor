"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import SectionCard from "@/components/admin/SectionCard";
import { adminApi, type Exercise } from "@/lib/api/admin-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Pencil, Trash2, Plus } from "lucide-react";

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
        .updateExercise(editing.id, { ...form, is_active: true })
        .then(() => {
          toast.success("Exercise updated");
          setDialogOpen(false);
          load();
        })
        .catch((e) => toast.error(e.message));
    } else {
      adminApi
        .createExercise({ ...form, is_active: true })
        .then(() => {
          toast.success("Exercise created");
          setDialogOpen(false);
          load();
        })
        .catch((e) => toast.error(e.message));
    }
  };

  const remove = (id: string) => {
    if (!confirm("Remove this exercise from the library? You can still assign it per student until removed.")) return;
    adminApi
      .deleteExercise(id)
      .then(() => {
        toast.success("Exercise removed from library");
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
        Exercise library. Which exercises each student sees is set per student in their profile.
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
                <span className="font-medium">{e.title}</span>
                {e.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{e.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Task score range: {(e.min_task_score ?? 0)} – {(e.max_task_score ?? 1)}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
        <div className="fixed inset-0 z-50 flex min-h-screen min-w-full items-center justify-center overflow-y-auto bg-black/50 py-12 px-4">
          <div className="my-auto w-full max-w-lg rounded-xl bg-card p-6 shadow-lg">
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

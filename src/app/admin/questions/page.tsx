"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { adminApi, type PostQuestion } from "@/lib/api/admin-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Pencil, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const ANSWER_TYPE_LABELS: Record<string, string> = {
  yes_no: "Yes / No",
  scale_1_5: "Scale (1-5)",
  scale_1_10: "Scale (1-10)",
  text: "Free Text",
};

function answerTypeLabel(type: string): string {
  return ANSWER_TYPE_LABELS[type] ?? type;
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<PostQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PostQuestion | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    text: "",
    answer_type: "yes_no",
    is_active: true,
  });

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getPostQuestions()
      .then(setQuestions)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return questions;
    const q = searchQuery.trim().toLowerCase();
    return questions.filter((item) => (item.text ?? "").toLowerCase().includes(q));
  }, [questions, searchQuery]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      text: "",
      answer_type: "yes_no",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (item: PostQuestion) => {
    setEditing(item);
    setForm({
      text: item.text ?? "",
      answer_type: item.answer_type ?? "yes_no",
      is_active: item.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.text.trim()) {
      toast.error("Question text is required");
      return;
    }
    if (editing) {
      adminApi
        .updatePostQuestion(editing.id, form)
        .then(() => {
          toast.success("Question updated");
          setDialogOpen(false);
          load();
        })
        .catch((e) => toast.error(e.message));
    } else {
      adminApi
        .createPostQuestion(form)
        .then(() => {
          toast.success("Question created");
          setDialogOpen(false);
          load();
        })
        .catch((e) => toast.error(e.message));
    }
  };

  const remove = (id: string) => {
    if (!confirm("Deactivate or remove this question?")) return;
    adminApi
      .deletePostQuestion(id)
      .then(() => {
        toast.success("Question removed");
        load();
      })
      .catch((e) => toast.error(e.message));
  };

  if (loading) return <p className="text-muted-foreground">Loading questions…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Questions</h1>
        <p className="text-muted-foreground mt-1">Manage post-recording questions for student feedback</p>
      </div>

      <div className="rounded-lg border border-primary/30 bg-accent/30 px-4 py-3 text-sm text-foreground">
        Each student session uses exactly 3 post-recording questions. You can assign specific questions per student in their profile.
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Add Question
        </Button>
      </div>

      <ul className="space-y-2">
        {filtered.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            {searchQuery.trim() ? "No questions match your search." : "No questions yet. Add one."}
          </li>
        ) : (
          filtered.map((q) => (
            <li
              key={q.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{q.text}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      q.is_active !== false ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {q.is_active !== false ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Answer type: {answerTypeLabel(q.answer_type)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(q)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => remove(q.id)}
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
            <h2 className="text-lg font-semibold">{editing ? "Edit Question" : "Add Question"}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Question text *</label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2}
                  value={form.text}
                  onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Answer type</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.answer_type}
                  onChange={(e) => setForm((p) => ({ ...p, answer_type: e.target.value }))}
                >
                  <option value="yes_no">Yes / No</option>
                  <option value="scale_1_5">Scale (1-5)</option>
                  <option value="scale_1_10">Scale (1-10)</option>
                  <option value="text">Free Text</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                Active (available for assignment)
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

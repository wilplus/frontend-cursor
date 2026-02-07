"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Send, Pencil, Trash2, Check, X } from "lucide-react";
import SectionCard from "@/components/admin/SectionCard";
import SelectFromPoolModal, { type PoolItem } from "@/components/admin/SelectFromPoolModal";
import { Button } from "@/components/ui/button";
import {
  adminApi,
  type StudentProfile,
  type PostQuestion,
  type WarmUpTask,
  type MetricLabel,
} from "@/lib/api/admin-client";
import { toast } from "sonner";

// —— Editable list row: text + hover Edit/Delete; edit = inline input + Check/X ——
function EditableListItem({
  text,
  onEdit,
  onDelete,
  saving,
}: {
  text: string;
  onEdit: (newText: string) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  useEffect(() => {
    setDraft(text);
  }, [text]);

  const handleSave = () => {
    const t = draft.trim();
    if (t) onEdit(t);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="group flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-7 flex-1 min-w-0 rounded border border-input bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
          autoFocus
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded p-1 text-primary hover:bg-primary/10"
          aria-label="Save"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
      <span className="min-w-0 flex-1 text-sm">{text}</span>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          className="rounded p-1 text-destructive hover:bg-destructive/10"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// —— Metrics row: label only (editable), no delete ——
function MetricRow({
  index,
  code,
  leftLabel,
  rightLabel,
  onSave,
  saving,
}: {
  index: number;
  code: string;
  leftLabel: string;
  rightLabel: string;
  onSave: (left: string, right: string) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [left, setLeft] = useState(leftLabel);
  const [right, setRight] = useState(rightLabel);

  useEffect(() => {
    setLeft(leftLabel);
    setRight(rightLabel);
  }, [leftLabel, rightLabel]);

  const handleSave = () => {
    onSave(left.trim(), right.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium text-muted-foreground">{index}. {code}:</span>
        <input
          type="text"
          value={left}
          onChange={(e) => setLeft(e.target.value)}
          placeholder="Left label"
          className="h-7 flex-1 min-w-[80px] rounded border border-input bg-background px-2 text-sm"
        />
        <span className="text-muted-foreground">…</span>
        <input
          type="text"
          value={right}
          onChange={(e) => setRight(e.target.value)}
          placeholder="Right label"
          className="h-7 flex-1 min-w-[80px] rounded border border-input bg-background px-2 text-sm"
        />
        <button type="button" onClick={handleSave} disabled={saving} className="rounded p-1 text-primary hover:bg-primary/10">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded p-1 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
      <span className="text-sm">
        {index}. {code}: {leftLabel} … {rightLabel}{" "}
        <span className="text-muted-foreground">(editable)</span>
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Edit"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function AdminStudentProfilePage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [postQuestions, setPostQuestions] = useState<PostQuestion[]>([]);
  const [warmUpTasks, setWarmUpTasks] = useState<WarmUpTask[]>([]);
  const [metricLabels, setMetricLabels] = useState<MetricLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalWarmUp, setModalWarmUp] = useState(false);
  const [modalQuestions, setModalQuestions] = useState(false);

  const [overridesDraft, setOverridesDraft] = useState({
    assigned_post_question_ids: [] as string[],
  });
  const [contextDraft, setContextDraft] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
        // Load profile first; then load pool data (questions, warm-up tasks, metrics)
    adminApi
      .getStudentProfile(id)
      .then((p) => {
        setProfile(p);
        setOverridesDraft({
          assigned_post_question_ids: p.overrides?.assigned_post_question_ids ?? [],
        });
        const sp = p.speaker_profile || {};
        const parts = [
          sp.main_goal,
          sp.motivation,
          sp.strong_points,
          sp.weak_points,
          sp.coach_notes,
        ].filter(Boolean);
        setContextDraft(parts.join("\n\n"));
        return Promise.allSettled([
          adminApi.getPostQuestions(),
          adminApi.getWarmUpTasks(id),
          adminApi.getMetricLabels(),
        ]);
      })
      .then((results) => {
        if (!results) return;
        const [questionsRes, warmUpRes, metricsRes] = results;
        if (questionsRes.status === "fulfilled") setPostQuestions(questionsRes.value);
        else toast.error(questionsRes.reason?.message ?? "Could not load questions");
        if (warmUpRes.status === "fulfilled") setWarmUpTasks(warmUpRes.value);
        else toast.error(warmUpRes.reason?.message ?? "Could not load warm-up tasks");
        if (metricsRes.status === "fulfilled") setMetricLabels(metricsRes.value);
        else toast.error(metricsRes.reason?.message ?? "Could not load metrics");
      })
      .catch((e) => {
        toast.error(e.message);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => load(), [load]);

  const saveOverrides = () => {
    setSaving(true);
    // Backend accepts assigned_post_question_ids only when there are exactly 3; otherwise returns 400.
    adminApi
      .putOverrides(id, {
        ...(overridesDraft.assigned_post_question_ids.length === 3 && {
          assigned_post_question_ids: overridesDraft.assigned_post_question_ids,
        }),
      })
      .then(() => {
        toast.success("Saved");
        load();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  const saveSpeakerProfile = () => {
    setSaving(true);
    adminApi
      .putSpeakerProfile(id, { coach_notes: contextDraft })
      .then(() => {
        toast.success("Profile saved");
        load();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  const sendAssignment = () => {
    adminApi.sendAssignment(id).then(() => toast.success("Homework sent")).catch((e) => toast.error(e.message));
  };

  // Warm-up: pool = student's list; confirm = keep selected, delete others; create = add to student
  const warmUpPool: PoolItem[] = warmUpTasks.map((t) => ({ id: t.id, label: t.text }));
  const handleWarmUpConfirm = (selectedIds: string[]) => {
    const toDelete = warmUpTasks.filter((t) => !selectedIds.includes(t.id));
    setModalWarmUp(false);
    if (toDelete.length === 0) {
      load(); // refetch so any newly created items from modal appear
      return;
    }
    setSaving(true);
    Promise.all(toDelete.map((t) => adminApi.deleteWarmUpTask(id, t.id)))
      .then(() => {
        load();
        toast.success("Selection updated");
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };
  const handleWarmUpCreate = async (text: string): Promise<PoolItem> => {
    const res = await adminApi.createWarmUpTask(id, {
      text,
      order_index: warmUpTasks.length,
      max_performance_score: 1,
    });
    return { id: res.warm_up_task.id, label: res.warm_up_task.text };
  };

  // Post-recording questions: pool = global; max 3; confirm = save assigned_post_question_ids
  const questionsPool: PoolItem[] = postQuestions.map((q) => ({ id: q.id, label: q.text }));
  const handleQuestionsConfirm = (selectedIds: string[]) => {
    if (selectedIds.length !== 3) {
      toast.error("Select exactly 3 questions.");
      return;
    }
    setOverridesDraft((prev) => ({ ...prev, assigned_post_question_ids: selectedIds }));
    setModalQuestions(false);
    toast.success("Selection updated. Click Save to persist.");
  };
  const handleQuestionsCreate = async (text: string): Promise<PoolItem> => {
    const res = await adminApi.createPostQuestion({ text, answer_type: "text" });
    setPostQuestions((prev) => [...prev, res.question]);
    return { id: res.question.id, label: res.question.text };
  };

  const updateWarmUpTask = (taskId: string, updates: { text?: string; max_performance_score?: number }) => {
    setSaving(true);
    adminApi
      .updateWarmUpTask(id, taskId, updates)
      .then(() => { load(); toast.success("Updated"); })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };
  const deleteWarmUpTask = (taskId: string) => {
    setSaving(true);
    adminApi
      .deleteWarmUpTask(id, taskId)
      .then(() => { load(); toast.success("Deleted"); })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  const assignedQuestions = postQuestions.filter((q) => overridesDraft.assigned_post_question_ids.includes(q.id));

  const postError = overridesDraft.assigned_post_question_ids.length > 0 && overridesDraft.assigned_post_question_ids.length !== 3;

  const reports = (profile?.sessions ?? [])
    .filter((s) => s.report_preview?.report_text_preview)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 10);

  const saveMetricLabel = (code: string, left: string, right: string) => {
    setSaving(true);
    const updated = metricLabels.map((m) => (m.code === code ? { ...m, left_label: left, right_label: right } : m));
    adminApi
      .putMetricLabels(updated)
      .then(() => { setMetricLabels(updated); toast.success("Metric updated"); })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  if (loading || !profile) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Students
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{profile.email || profile.user_id}</h1>
      </div>

      {/* Homework Configuration */}
      <SectionCard
        title="Homework Configuration"
        description="Select items from the global pool or create new ones. New items are added to the pool for reuse."
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={sendAssignment} className="gap-2">
              <Send className="h-4 w-4" aria-hidden /> Send Homework
            </Button>
            <Button type="button" onClick={saveOverrides} disabled={saving || postError}>
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Warm-up Tasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Warm-up Tasks</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalWarmUp(true)}>
                + Add
              </Button>
            </div>
            <ul className="space-y-2">
              {warmUpTasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <EditableListItem
                      text={t.text}
                      onEdit={(newText) => updateWarmUpTask(t.id, { text: newText })}
                      onDelete={() => deleteWarmUpTask(t.id)}
                      saving={saving}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Max score</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={t.max_performance_score ?? 1}
                      onChange={(e) => {
                        const v = e.target.valueAsNumber;
                        if (!Number.isNaN(v) && v >= 0 && v <= 1) {
                          setWarmUpTasks((prev) =>
                            prev.map((w) => (w.id === t.id ? { ...w, max_performance_score: v } : w))
                          );
                        }
                      }}
                      onBlur={(e) => {
                        const v = e.target.valueAsNumber;
                        if (!Number.isNaN(v) && v >= 0 && v <= 1 && (t.max_performance_score ?? 1) !== v) {
                          updateWarmUpTask(t.id, { max_performance_score: v });
                        }
                      }}
                      className="h-7 w-16 rounded border border-input bg-background px-2 text-right text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-ring"
                      title="Max performance score (0–1). Shown to students with last score ≤ this."
                    />
                  </div>
                </li>
              ))}
            </ul>
            {warmUpTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No warm-up tasks. Click + Add to select or create.</p>
            )}
          </div>

          {/* Post-Recording Questions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Post-Recording Questions ({overridesDraft.assigned_post_question_ids.length}/3)</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalQuestions(true)}>
                + Add
              </Button>
            </div>
            {postError && <p className="text-sm text-destructive">Select exactly 3 questions.</p>}
            <ul className="space-y-2">
              {assignedQuestions.map((q) => (
                <li key={q.id}>
                  <EditableListItem
                    text={q.text}
                    onEdit={(newText) => {
                      setSaving(true);
                      adminApi.updatePostQuestion(q.id, { text: newText }).then(() => load()).catch((e) => toast.error(e.message)).finally(() => setSaving(false));
                    }}
                    onDelete={() =>
                      setOverridesDraft((prev) => ({
                        ...prev,
                        assigned_post_question_ids: prev.assigned_post_question_ids.filter((x) => x !== q.id),
                      }))
                    }
                    saving={saving}
                  />
                </li>
              ))}
            </ul>
            {assignedQuestions.length === 0 && (
              <p className="text-sm text-muted-foreground">No questions. Click + Add to select exactly 3.</p>
            )}
          </div>

          {/* Metrics (5 fixed) */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Metrics (5 fixed)</p>
            <div className="space-y-2">
              {metricLabels.slice(0, 5).map((m, i) => (
                <MetricRow
                  key={m.code}
                  index={i + 1}
                  code={m.code}
                  leftLabel={m.left_label}
                  rightLabel={m.right_label}
                  onSave={(left, right) => saveMetricLabel(m.code, left, right)}
                  saving={saving}
                />
              ))}
              {metricLabels.length === 0 && <p className="text-sm text-muted-foreground">No metrics loaded.</p>}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Speaker Profile */}
      <SectionCard
        title="Speaker Profile"
        description="Goals, motivation, and coach notes."
        action={
          <Button type="button" onClick={saveSpeakerProfile} disabled={saving}>
            Save
          </Button>
        }
      >
        <label className="block text-sm font-medium mb-2">Context</label>
        <textarea
          value={contextDraft}
          onChange={(e) => setContextDraft(e.target.value)}
          placeholder="Enter student context, goals, motivation, personality traits, and any notes for coaching..."
          rows={8}
          className="w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </SectionCard>

      {/* Reports History */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Reports History</h2>
        <div className="space-y-3">
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            reports.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-muted/30 p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Report — {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                </p>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {s.report_preview?.report_text_preview ?? ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <SelectFromPoolModal
        open={modalWarmUp}
        onOpenChange={setModalWarmUp}
        title="Select Warm-up Tasks"
        pool={warmUpPool}
        selectedIds={warmUpTasks.map((t) => t.id)}
        onConfirm={handleWarmUpConfirm}
        allowCreate
        onCreateNew={handleWarmUpCreate}
      />
      <SelectFromPoolModal
        open={modalQuestions}
        onOpenChange={setModalQuestions}
        title="Select Post-Recording Questions"
        pool={questionsPool}
        selectedIds={overridesDraft.assigned_post_question_ids}
        onConfirm={handleQuestionsConfirm}
        allowCreate
        onCreateNew={handleQuestionsCreate}
        maxSelection={3}
      />
    </div>
  );
}

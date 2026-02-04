"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, FileText, Send } from "lucide-react";
import SectionCard from "@/components/admin/SectionCard";
import { Button } from "@/components/ui/button";
import { adminApi, type StudentProfile, type Exercise, type PostQuestion, type Task, type WarmUpTask, type MetricQuestion, type MetricLabel } from "@/lib/api/admin-client";
import { toast } from "sonner";

function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all
        ${selected
          ? "border-primary bg-primary/10 text-primary shadow-md ring-2 ring-primary/30"
          : "border-border hover:border-primary/50"
        }
      `}
    >
      {label}
    </button>
  );
}

function WarmUpTasksBlock({
  userId,
  tasks,
  onUpdate,
  saving,
  setSaving,
}: {
  userId: string;
  tasks: WarmUpTask[];
  onUpdate: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const addTask = () => {
    if (!newText.trim()) return;
    setSaving(true);
    adminApi
      .createWarmUpTask(userId, { text: newText.trim(), order_index: tasks.length })
      .then(() => {
        toast.success("Warm-up task added");
        setNewText("");
        onUpdate();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  const startEdit = (task: WarmUpTask) => {
    setEditingId(task.id);
    setEditText(task.text);
  };

  const saveEdit = () => {
    if (editingId == null) return;
    setSaving(true);
    adminApi
      .updateWarmUpTask(userId, editingId, { text: editText.trim() })
      .then(() => {
        toast.success("Warm-up task updated");
        setEditingId(null);
        onUpdate();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  const deleteTask = (taskId: string) => {
    setSaving(true);
    adminApi
      .deleteWarmUpTask(userId, taskId)
      .then(() => {
        toast.success("Warm-up task deleted");
        onUpdate();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Warm-up tasks (add new, delete, edit)</p>
      <div className="flex flex-wrap gap-2">
        <textarea
          className="min-h-[60px] w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="New warm-up task text…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        <Button type="button" onClick={addTask} disabled={saving || !newText.trim()}>
          Add
        </Button>
      </div>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
            {editingId === task.id ? (
              <div className="space-y-2">
                <textarea
                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={saveEdit} disabled={saving}>
                    Save
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm flex-1">{task.text}</p>
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => startEdit(task)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-destructive/50 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => deleteTask(task.id)}
                    disabled={saving}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">No warm-up tasks. Add one above.</p>
      )}
    </div>
  );
}

export default function AdminStudentProfilePage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [postQuestions, setPostQuestions] = useState<PostQuestion[]>([]);
  const [warmUpTasks, setWarmUpTasks] = useState<WarmUpTask[]>([]);
  const [metricQuestions, setMetricQuestions] = useState<MetricQuestion[]>([]);
  const [metricLabels, setMetricLabels] = useState<MetricLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    const fetchProfile = adminApi.getStudentProfile(id);
    const fetchExercises = adminApi.getExercises().catch(() => [] as Exercise[]);
    const fetchTasks = adminApi.getTasks().catch(() => [] as Task[]);
    const fetchQuestions = adminApi.getPostQuestions().catch(() => [] as PostQuestion[]);
    const fetchWarmUp = adminApi.getWarmUpTasks(id).catch(() => [] as WarmUpTask[]);
    const fetchMetricQ = adminApi.getMetricQuestions().catch(() => [] as MetricQuestion[]);
    const fetchMetrics = adminApi.getMetricLabels().catch(() => [] as MetricLabel[]);
    Promise.all([fetchProfile, fetchExercises, fetchTasks, fetchQuestions, fetchWarmUp, fetchMetricQ, fetchMetrics])
      .then(([p, ex, t, q, w, mq, ml]) => {
        setProfile(p);
        setExercises(ex);
        setTasks(t);
        setPostQuestions(q);
        setWarmUpTasks(w);
        setMetricQuestions(mq);
        setMetricLabels(ml);
      })
      .catch((e) => {
        toast.error(e.message);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => load(), [load]);

  const [overridesDraft, setOverridesDraft] = useState({
    show_exercise_step: true,
    intended_emotion_prompt: "",
    keywords_prompt: "",
    emotion_check_question_text: "",
    assigned_post_question_ids: [] as string[],
    assigned_next_exercise_id: "",
    assigned_next_task_ids: [] as string[],
  });
  const [speakerDraft, setSpeakerDraft] = useState({
    main_goal: "",
    motivation: "",
    strong_points: "",
    weak_points: "",
    charismatic_traits: "",
    hobbies_interests: "",
    personality_type: "",
    coach_notes: "",
  });

  useEffect(() => {
    if (!profile) return;
    const o = profile.overrides || {};
    setOverridesDraft({
      show_exercise_step: o.show_exercise_step !== false,
      intended_emotion_prompt: o.intended_emotion_prompt ?? "",
      keywords_prompt: o.keywords_prompt ?? "",
      emotion_check_question_text: o.emotion_check_question_text ?? "",
      assigned_post_question_ids: o.assigned_post_question_ids ?? [],
      assigned_next_exercise_id: o.assigned_next_exercise_id ?? "",
      assigned_next_task_ids: o.assigned_next_task_ids ?? [],
    });
    const s = profile.speaker_profile || {};
    setSpeakerDraft({
      main_goal: s.main_goal ?? "",
      motivation: s.motivation ?? "",
      strong_points: s.strong_points ?? "",
      weak_points: s.weak_points ?? "",
      charismatic_traits: s.charismatic_traits ?? "",
      hobbies_interests: s.hobbies_interests ?? "",
      personality_type: s.personality_type ?? "",
      coach_notes: s.coach_notes ?? "",
    });
  }, [profile]);

  const saveOverrides = () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      show_exercise_step: overridesDraft.show_exercise_step,
      intended_emotion_prompt: overridesDraft.intended_emotion_prompt || undefined,
      keywords_prompt: overridesDraft.keywords_prompt || undefined,
      emotion_check_question_text: overridesDraft.emotion_check_question_text || undefined,
      assigned_next_exercise_id: overridesDraft.assigned_next_exercise_id || undefined,
      assigned_next_task_ids: overridesDraft.assigned_next_task_ids.length > 0 ? overridesDraft.assigned_next_task_ids : undefined,
    };
    if (overridesDraft.assigned_post_question_ids.length === 3) {
      payload.assigned_post_question_ids = overridesDraft.assigned_post_question_ids;
    }
    adminApi
      .putOverrides(id, payload)
      .then(() => toast.success("Overrides saved"))
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  const saveSpeakerProfile = () => {
    setSaving(true);
    adminApi
      .putSpeakerProfile(id, speakerDraft)
      .then(() => toast.success("Speaker profile saved"))
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  const sendAssignment = () => {
    adminApi
      .sendAssignment(id)
      .then(() => toast.success("Assignment sent"))
      .catch((e) => toast.error(e.message));
  };

  const togglePostQuestion = (qId: string) => {
    setOverridesDraft((prev) => {
      const ids = prev.assigned_post_question_ids.includes(qId)
        ? prev.assigned_post_question_ids.filter((x) => x !== qId)
        : [...prev.assigned_post_question_ids, qId].slice(0, 3);
      return { ...prev, assigned_post_question_ids: ids };
    });
  };

  const toggleExercise = (exId: string) => {
    setOverridesDraft((prev) => ({
      ...prev,
      assigned_next_exercise_id: prev.assigned_next_exercise_id === exId ? "" : exId,
    }));
  };

  const toggleTask = (taskId: string) => {
    setOverridesDraft((prev) => {
      const ids = prev.assigned_next_task_ids.includes(taskId)
        ? prev.assigned_next_task_ids.filter((x) => x !== taskId)
        : [...prev.assigned_next_task_ids, taskId];
      return { ...prev, assigned_next_task_ids: ids };
    });
  };

  if (loading || !profile) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  const postCount = overridesDraft.assigned_post_question_ids.length;
  const postError = postCount > 0 && postCount !== 3;

  const lastReportSession = profile.sessions
    .filter((s) => s.report_preview?.report_text_preview)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
  const lastReportText = lastReportSession?.report_preview?.report_text_preview ?? null;

  return (
    <div className="space-y-6">
      {/* Header: back link + student email only (mockup) */}
      <div>
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Students
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{profile.email || profile.user_id}</h1>
      </div>

      {/* Homework Configuration — Send Homework + Save in card action (mockup) */}
      <SectionCard
        title="Homework Configuration"
        description="Assign exercise and post-recording questions for this student."
        action={
          <div className="flex items-center gap-2">
            <Button type="button" onClick={sendAssignment} className="gap-2">
              <Send className="h-4 w-4" aria-hidden /> Send Homework
            </Button>
            <Button type="button" onClick={saveOverrides} disabled={saving || postError}>
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* 1. List of warm-up tasks (add new, delete, edit) */}
          <WarmUpTasksBlock userId={id} tasks={warmUpTasks} onUpdate={load} saving={saving} setSaving={setSaving} />

          {/* 2. List of focus tasks (assigned from pool; add/remove via chips) */}
          <div>
            <p className="mb-2 text-sm font-medium">Focus tasks</p>
            <p className="mb-2 text-xs text-muted-foreground">Choose which tasks are available for this student.</p>
            <div className="flex flex-wrap gap-2">
              {tasks.map((t) => (
                <Chip
                  key={t.id}
                  label={t.title}
                  selected={overridesDraft.assigned_next_task_ids.includes(t.id)}
                  onToggle={() => toggleTask(t.id)}
                />
              ))}
              {tasks.length === 0 && (
                <span className="text-sm text-muted-foreground">No tasks in pool. Add them on the Tasks tab.</span>
              )}
            </div>
          </div>

          {/* 3. List of questions (add new, delete, edit = select exactly 3 from pool) */}
          <div>
            <p className="mb-2 text-sm font-medium">Post-recording questions ({postCount}/3)</p>
            <p className="mb-2 text-xs text-muted-foreground">Select exactly 3 from the pool.</p>
            {postError && <p className="mb-2 text-sm text-destructive">Select exactly 3 questions.</p>}
            <div className="flex flex-wrap gap-2">
              {postQuestions.map((q) => (
                <Chip
                  key={q.id}
                  label={q.text.slice(0, 40) + (q.text.length > 40 ? "…" : "")}
                  selected={overridesDraft.assigned_post_question_ids.includes(q.id)}
                  onToggle={() => togglePostQuestion(q.id)}
                />
              ))}
              {postQuestions.length === 0 && (
                <span className="text-sm text-muted-foreground">No questions in pool. Add them on the Questions tab.</span>
              )}
            </div>
          </div>

          {/* 4. Metric question 1 & 2 (editable in Metrics) */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Metric question 1 & 2 (editable)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/30 p-3 shadow-sm">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Metric question 1</label>
                <p className="text-sm text-foreground">{metricQuestions.find((q) => q.position === 1)?.text || "—"}</p>
                <Link href="/admin/metrics" className="mt-1 text-xs text-primary hover:underline">Edit in Metrics</Link>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3 shadow-sm">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Metric question 2</label>
                <p className="text-sm text-foreground">{metricQuestions.find((q) => q.position === 2)?.text || "—"}</p>
                <Link href="/admin/metrics" className="mt-1 text-xs text-primary hover:underline">Edit in Metrics</Link>
              </div>
            </div>
          </div>

          {/* 5. Metric 3, 4, 5 (editable in Metrics) */}
          <div>
            <p className="mb-2 text-sm font-medium">Metric definitions (labels)</p>
            <div className="space-y-2">
              {metricLabels.length > 0 ? (
                metricLabels.map((m) => (
                  <div key={m.code} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-sm">
                    <span className="font-medium text-muted-foreground">{m.code}:</span>
                    <span>{m.left_label} … {m.right_label}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No metric labels loaded.</p>
              )}
              <Link href="/admin/metrics" className="text-xs text-primary hover:underline">Edit in Metrics</Link>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Speaker Profile (mockup) */}
      <SectionCard
        title="Speaker Profile"
        description="Goals, motivation, and coach notes."
        action={
          <Button type="button" onClick={saveSpeakerProfile} disabled={saving}>
            Save
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["main_goal", "Main Goal", 2],
              ["motivation", "Motivation", 2],
              ["strong_points", "Strong Points", 2],
              ["weak_points", "Weak Points", 2],
              ["charismatic_traits", "Charismatic Traits", 2],
              ["hobbies_interests", "Hobbies & Interests", 2],
              ["personality_type", "Personality Type", 1],
            ] as const
          ).map(([key, label, rows]) => (
            <div key={key} className={key === "personality_type" ? "" : "sm:col-span-1"}>
              <label className="mb-2 block text-sm font-medium">{label}</label>
              {rows === 1 ? (
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                  value={speakerDraft[key]}
                  onChange={(e) => setSpeakerDraft((p) => ({ ...p, [key]: e.target.value }))}
                />
              ) : (
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2}
                  value={speakerDraft[key]}
                  onChange={(e) => setSpeakerDraft((p) => ({ ...p, [key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">Coach Notes</label>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              rows={3}
              value={speakerDraft.coach_notes}
              onChange={(e) => setSpeakerDraft((p) => ({ ...p, coach_notes: e.target.value }))}
            />
          </div>
        </div>
      </SectionCard>

      {/* Last Report (mockup) */}
      <SectionCard title="Last Report" description="Most recent report for this student.">
        {lastReportText ? (
          <div className="rounded-xl border border-border bg-muted/30 p-4 shadow-sm">
            <p className="whitespace-pre-wrap text-sm text-foreground">{lastReportText}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No report yet.</p>
        )}
      </SectionCard>
    </div>
  );
}

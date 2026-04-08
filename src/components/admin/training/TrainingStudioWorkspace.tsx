"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, PencilLine, Send, Sparkles, Waves } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AcousticDojoWorkspace from "@/components/admin/dojo/AcousticDojoWorkspace";
import {
  adminApi,
  type CopilotCohortStack,
  type CopilotStudentDraft,
  type CopilotStudentQueueItem,
} from "@/lib/api/admin-client";

type QueueFilter = "all" | "pending" | "audit" | "done";

const LEARNING_ARCHETYPES = [
  {
    key: "Perfectionist-Avoider",
    subtitle: "Uses hedging language, WPM drops mid-sentence, avoids assertive statements",
  },
  {
    key: "Anxious-Rusher",
    subtitle: "High WPM under pressure, filler spikes, shortened pauses between ideas",
  },
  {
    key: "Monotone-Expert",
    subtitle: "Strong content but flat delivery, narrow pitch range, low emotion variance",
  },
  {
    key: "Confident-Unfocused",
    subtitle: "High energy but scattered structure, topic drift, weak transitions",
  },
] as const;

function formatName(student: CopilotStudentQueueItem): string {
  return (
    student.profile?.name?.trim() ||
    student.profile?.email?.trim() ||
    student.student_id.slice(0, 10)
  );
}

function formatSession(student: CopilotStudentQueueItem): string {
  const raw = student.session_id ?? "";
  if (!raw) return "Session #—";
  const compact = raw.split("-")[0];
  return `Session #${compact}`;
}

function queueStateDot(state: CopilotStudentQueueItem["state"]): string {
  if (state === "Sent") return "bg-emerald-500";
  if (state === "Ready") return "bg-amber-500";
  return "bg-rose-500";
}

function queueRecency(index: number): string {
  if (index === 0) return "about 2 hours ago";
  if (index === 1) return "about 5 hours ago";
  if (index === 2) return "1 day ago";
  return "3 days ago";
}

function queueStateBadge(state: CopilotStudentQueueItem["state"]): string {
  if (state === "Sent") return "bg-emerald-100 text-emerald-700";
  if (state === "Ready") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function toEvidence(insight: string, fallback: string): string[] {
  const text = insight.trim() || fallback.trim();
  if (!text) return [];
  return text
    .split(/[.\n]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function inferArchetype(value: string): string {
  const lower = value.toLowerCase();
  const found = LEARNING_ARCHETYPES.find((item) =>
    lower.includes(item.key.toLowerCase())
  );
  return found?.key ?? LEARNING_ARCHETYPES[0].key;
}

export default function TrainingStudioWorkspace() {
  const [pipelineView, setPipelineView] = useState<"agentic" | "voice">("agentic");
  const [cohorts, setCohorts] = useState<CopilotCohortStack[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [students, setStudents] = useState<CopilotStudentQueueItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<CopilotStudentQueueItem | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<CopilotStudentDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [selectedArchetype, setSelectedArchetype] = useState<string>(LEARNING_ARCHETYPES[0].key);

  const [editingInsight, setEditingInsight] = useState(false);
  const [editingTask, setEditingTask] = useState(false);
  const [editingMessage, setEditingMessage] = useState(false);
  const [insightValue, setInsightValue] = useState("");
  const [taskValue, setTaskValue] = useState("");
  const [messageValue, setMessageValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [sendingAssignment, setSendingAssignment] = useState(false);

  const loadCohorts = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const response = await adminApi.getCopilotCohorts({ limit: 50, offset: 0 });
      const list = response.cohorts ?? [];
      setCohorts(list);
      setSelectedCohortId((previous) => previous ?? list[0]?.id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load cohorts");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  const loadStudents = useCallback(async (cohortId: string) => {
    setLoadingQueue(true);
    try {
      const response = await adminApi.getCopilotCohortStudents(cohortId, {
        limit: 100,
        offset: 0,
      });
      const list = response.students ?? [];
      setStudents(list);
      setSelectedStudent((previous) => {
        if (!previous) return list[0] ?? null;
        return list.find((item) => item.student_id === previous.student_id) ?? list[0] ?? null;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load students");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  const loadDraft = useCallback(async (student: CopilotStudentQueueItem | null) => {
    if (!student) {
      setSelectedDraft(null);
      return;
    }
    setLoading(true);
    try {
      const response = await adminApi.getCopilotStudentDrafts(student.student_id, student.session_id ? { session_id: student.session_id } : undefined);
      const draft = response.drafts?.[0] ?? null;
      setSelectedDraft(draft);
      setInsightValue(draft?.corrected_insight ?? draft?.ai_insight ?? "");
      setTaskValue(draft?.task_draft ?? "");
      setMessageValue(draft?.email_draft ?? "");
      setSelectedArchetype(
        inferArchetype(
          `${draft?.ai_insight ?? ""} ${student.profile?.justification ?? ""}`
        )
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load student draft");
      setSelectedDraft(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCohorts();
  }, [loadCohorts]);

  useEffect(() => {
    if (!selectedCohortId) {
      setStudents([]);
      setSelectedStudent(null);
      return;
    }
    void loadStudents(selectedCohortId);
  }, [loadStudents, selectedCohortId]);

  useEffect(() => {
    void loadDraft(selectedStudent);
  }, [loadDraft, selectedStudent]);

  const queueCounts = useMemo(() => {
    const all = students.length;
    const pending = students.filter((item) => item.state === "Draft").length;
    const audit = students.filter((item) => item.state === "Ready").length;
    const done = students.filter((item) => item.state === "Sent").length;
    return { all, pending, audit, done };
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (queueFilter === "all") return students;
    if (queueFilter === "pending") return students.filter((item) => item.state === "Draft");
    if (queueFilter === "audit") return students.filter((item) => item.state === "Ready");
    return students.filter((item) => item.state === "Sent");
  }, [queueFilter, students]);

  const currentInsight = selectedDraft?.ai_insight ?? selectedStudent?.profile?.justification ?? "";
  const evidence = useMemo(
    () => toEvidence(currentInsight, selectedStudent?.profile?.justification ?? ""),
    [currentInsight, selectedStudent?.profile?.justification]
  );

  const saveDraftFields = useCallback(async (patch: Partial<CopilotStudentDraft>) => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await adminApi.updateCopilotStudentDrafts(selectedStudent.student_id, {
        grade_draft: patch.grade_draft ?? selectedDraft?.grade_draft ?? null,
        comment_draft: patch.comment_draft ?? selectedDraft?.comment_draft ?? null,
        task_draft: (patch.task_draft ?? taskValue) || null,
        email_draft: (patch.email_draft ?? messageValue) || null,
        script_draft: patch.script_draft ?? selectedDraft?.script_draft ?? null,
      });
      toast.success("Saved.");
      await loadDraft(selectedStudent);
      if (selectedCohortId) await loadStudents(selectedCohortId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [loadDraft, loadStudents, messageValue, selectedCohortId, selectedDraft?.comment_draft, selectedDraft?.grade_draft, selectedDraft?.script_draft, selectedStudent, taskValue]);

  const saveInsight = useCallback(async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await adminApi.updateCopilotStudentAudit(selectedStudent.student_id, {
        good_as_is: false,
        corrected_insight: insightValue.trim() || null,
      });
      toast.success("Insight updated.");
      await loadDraft(selectedStudent);
      setEditingInsight(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update insight");
    } finally {
      setSaving(false);
    }
  }, [insightValue, loadDraft, selectedStudent]);

  const approveAll = useCallback(async () => {
    const targets = filteredStudents.filter((item) => item.state !== "Sent");
    if (targets.length === 0) {
      toast.message("No pending students to approve.");
      return;
    }
    setApprovingAll(true);
    try {
      const results = await Promise.allSettled(
        targets.map((item) =>
          adminApi.approveCopilotStudent(item.student_id, {
            session_id: item.session_id ?? undefined,
            idempotency_key: crypto.randomUUID(),
          })
        )
      );
      const ok = results.filter((result) => result.status === "fulfilled").length;
      if (ok > 0) toast.success(`Approved ${ok} student${ok === 1 ? "" : "s"}.`);
      if (ok < targets.length) toast.error(`Failed to approve ${targets.length - ok} students.`);
      if (selectedCohortId) await loadStudents(selectedCohortId);
    } finally {
      setApprovingAll(false);
    }
  }, [filteredStudents, loadStudents, selectedCohortId]);

  const sendAssignment = useCallback(async () => {
    if (!selectedStudent) return;
    setSendingAssignment(true);
    try {
      await adminApi.sendAssignment(selectedStudent.student_id, {
        video_description: messageValue.trim() || undefined,
      });
      toast.success("Assignment sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send assignment");
    } finally {
      setSendingAssignment(false);
    }
  }, [messageValue, selectedStudent]);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-[42px] font-semibold tracking-[-0.01em]">Training Studio</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Review AI decisions, correct mistakes, and generate training data.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setPipelineView("agentic")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
            pipelineView === "agentic" ? "bg-background text-foreground" : "text-muted-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Agentic Pipeline
        </button>
        <button
          type="button"
          onClick={() => setPipelineView("voice")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
            pipelineView === "voice" ? "bg-background text-foreground" : "text-muted-foreground"
          }`}
        >
          <Waves className="h-4 w-4" />
          Voice Pipeline
        </button>
      </div>

      {pipelineView === "voice" ? (
        <AcousticDojoWorkspace showHeader={false} />
      ) : (
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-border/90 bg-card/95 p-0 shadow-sm">
          <div className="grid grid-cols-4 border-b bg-muted/35 text-center text-xs font-medium">
            <button className={`px-2 py-2 ${queueFilter === "all" ? "border-b-2 border-amber-500 text-foreground" : "text-muted-foreground"}`} onClick={() => setQueueFilter("all")} type="button">
              All ({queueCounts.all})
            </button>
            <button className={`px-2 py-2 ${queueFilter === "pending" ? "border-b-2 border-amber-500 text-foreground" : "text-muted-foreground"}`} onClick={() => setQueueFilter("pending")} type="button">
              Pending ({queueCounts.pending})
            </button>
            <button className={`px-2 py-2 ${queueFilter === "audit" ? "border-b-2 border-amber-500 text-foreground" : "text-muted-foreground"}`} onClick={() => setQueueFilter("audit")} type="button">
              Audit ({queueCounts.audit})
            </button>
            <button className={`px-2 py-2 ${queueFilter === "done" ? "border-b-2 border-amber-500 text-foreground" : "text-muted-foreground"}`} onClick={() => setQueueFilter("done")} type="button">
              Done ({queueCounts.done})
            </button>
          </div>
          <div className="max-h-[74vh] overflow-y-auto">
            {loadingQueue ? (
              <p className="p-3 text-base text-muted-foreground">Loading queue...</p>
            ) : filteredStudents.length === 0 ? (
              <p className="p-3 text-base text-muted-foreground">No students in this bucket.</p>
            ) : (
              filteredStudents.map((student, index) => {
                const active = selectedStudent?.student_id === student.student_id;
                return (
                  <button
                    key={`${student.student_id}-${student.session_id ?? "none"}`}
                    type="button"
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full border-b px-3 py-3 text-left transition-colors ${
                      active ? "bg-amber-50/70 dark:bg-amber-950/20" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold leading-none">{formatName(student)}</p>
                      {student.state === "Sent" ? (
                        <span className="inline-grid h-5 w-5 place-items-center rounded bg-emerald-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className={`h-3 w-3 rounded-full ${queueStateDot(student.state)}`} />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <p>{formatSession(student)}</p>
                      <p>{queueRecency(index)}</p>
                    </div>
                    <p className="text-xs text-destructive/90">
                      {(student.draft_count ?? 0) > 0 ? `${student.draft_count ?? 0} items pending` : "No pending items"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-4xl font-semibold leading-none">
                {selectedStudent?.profile?.email || selectedStudent?.profile?.name || "Select a student"}
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                {selectedStudent ? `${formatSession(selectedStudent)} · Score: ${selectedStudent.profile?.canonical_score_for_display ?? "-"}%` : "No student selected"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedStudent ? (
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${queueStateBadge(selectedStudent.state)}`}>
                  {selectedStudent.state === "Draft" ? "Pending Review" : selectedStudent.state}
                </span>
              ) : null}
              <Button className="h-11 px-4 text-sm" onClick={() => void approveAll()} disabled={approvingAll || filteredStudents.length === 0}>
                {approvingAll ? "Approving..." : "Approve All"}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Review — Session 12</p>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">Score & Grade</h3>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {selectedStudent?.state === "Draft" ? "Pending" : selectedStudent?.state ?? "—"}
              </span>
            </div>
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">AI Score</p>
                <p className="text-5xl font-semibold">{selectedStudent?.profile?.canonical_score_for_display ?? "--"}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Grade</p>
                <p className="text-5xl font-semibold">
                  {typeof selectedDraft?.grade_draft === "number" ? selectedDraft.grade_draft : "--"}
                </p>
              </div>
            </div>
            <div className="border-t px-5 py-4">
              <p className="text-sm text-muted-foreground">Comment</p>
              <p className="text-2xl">{selectedDraft?.comment_draft || "No comment yet."}</p>
            </div>
          </Card>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">AI Coach Insight</h3>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Needs Review
              </span>
            </div>
            <div className="space-y-3 px-5 py-4">
              {editingInsight ? (
                <textarea
                  rows={4}
                  value={insightValue}
                  onChange={(event) => setInsightValue(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              ) : (
                <p className="rounded-lg border bg-muted/20 px-3 py-2 text-base leading-7">
                  {selectedDraft?.ai_insight || "No AI insight yet."}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-11 px-4 text-sm"
                  onClick={() => {
                    if (editingInsight) {
                      void saveInsight();
                    } else {
                      setEditingInsight(true);
                    }
                  }}
                  disabled={saving || !selectedStudent}
                >
                  {editingInsight ? "Save correction" : "Write Correction"}
                </Button>
                <Button className="h-11 px-4 text-sm" variant="outline" onClick={() => setEditingInsight(false)} disabled={!editingInsight}>
                  <Check className="mr-2 h-4 w-4" /> Good as-is
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Plan — Session 13</p>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">Learning Profile</h3>
            </div>
            <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">AI Classified As</p>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                    {selectedArchetype}
                  </span>
                  <span className="text-sm text-muted-foreground">82% confidence</span>
                </div>
                <div className="space-y-2">
                  {evidence.map((line, index) => (
                    <p key={`${line}-${index}`} className="rounded-md border bg-muted/20 px-3 py-2 text-base leading-7">
                      {line}
                    </p>
                  ))}
                  {evidence.length === 0 ? (
                    <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                      No evidence captured yet.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Your Call</p>
                {LEARNING_ARCHETYPES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedArchetype(item.key)}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${
                      selectedArchetype === item.key ? "border-amber-200 bg-amber-50" : "hover:bg-muted/30"
                    }`}
                  >
                    <p className="text-xl font-semibold">{item.key}</p>
                    <p className="text-sm text-muted-foreground leading-snug">{item.subtitle}</p>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">Suggested Task</h3>
              <Button
                variant="outline"
                className="h-11 px-4 text-sm"
                onClick={() => {
                  if (editingTask) {
                    void saveDraftFields({ task_draft: taskValue.trim() || null });
                    setEditingTask(false);
                  } else {
                    setEditingTask(true);
                  }
                }}
                disabled={saving || !selectedStudent}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                {editingTask ? "Save" : "Swap"}
              </Button>
            </div>
            <div className="px-5 py-4">
              {editingTask ? (
                <textarea
                  rows={2}
                  value={taskValue}
                  onChange={(event) => setTaskValue(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base"
                />
              ) : (
                <>
                  <p className="text-xl font-semibold">{taskValue || selectedDraft?.task_draft || "No task selected"}</p>
                  <p className="text-sm text-muted-foreground">Task ID: {selectedStudent?.queue_position != null ? `t${selectedStudent.queue_position}` : "t2"}</p>
                </>
              )}
            </div>
          </Card>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">Message to Student</h3>
              <Button
                variant="outline"
                className="h-11 px-4 text-sm"
                onClick={() => {
                  if (editingMessage) {
                    void saveDraftFields({ email_draft: messageValue.trim() || null });
                    setEditingMessage(false);
                  } else {
                    setEditingMessage(true);
                  }
                }}
                disabled={saving || !selectedStudent}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                {editingMessage ? "Save" : "Edit"}
              </Button>
            </div>
            <div className="px-5 py-4">
              {editingMessage ? (
                <textarea
                  rows={5}
                  value={messageValue}
                  onChange={(event) => setMessageValue(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-snug"
                />
              ) : (
                <p className="text-base leading-7">{messageValue || selectedDraft?.email_draft || "No message drafted yet."}</p>
              )}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              className="h-11 px-5 text-sm"
              onClick={() => void sendAssignment()}
              disabled={sendingAssignment || !selectedStudent}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendingAssignment ? "Sending..." : "Send Assignment"}
            </Button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

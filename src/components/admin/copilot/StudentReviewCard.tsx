"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminApi, type CopilotAnnotationChip, type CopilotStudentDraft } from "@/lib/api/admin-client";
import ReasonChipSelector, { type SelectedReasonChip } from "./ReasonChipSelector";

/** persist = draft/audit save; workflow = approve/send (may change queue state). */
export type StudentReviewMutationReason = "persist" | "workflow";

interface StudentReviewCardProps {
  studentId: string;
  sessionId?: string | null;
  chips: CopilotAnnotationChip[];
  onStateMutated?: (reason: StudentReviewMutationReason) => Promise<void> | void;
}

interface DraftFormState {
  grade_draft: string;
  comment_draft: string;
  task_draft: string;
  email_draft: string;
  script_draft: string;
}

function toDraftForm(draft: CopilotStudentDraft | null): DraftFormState {
  return {
    grade_draft:
      typeof draft?.grade_draft === "number" && Number.isFinite(draft.grade_draft)
        ? String(draft.grade_draft)
        : "",
    comment_draft: draft?.comment_draft ?? "",
    task_draft: draft?.task_draft ?? "",
    email_draft: draft?.email_draft ?? "",
    script_draft: draft?.script_draft ?? "",
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

const fieldClassName =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition-all duration-200 ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export default function StudentReviewCard({
  studentId,
  sessionId,
  chips,
  onStateMutated,
}: StudentReviewCardProps) {
  const [loading, setLoading] = useState(false);
  const [savingAudit, setSavingAudit] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [approving, setApproving] = useState(false);
  const [sending, setSending] = useState(false);

  const [selectedDraft, setSelectedDraft] = useState<CopilotStudentDraft | null>(null);
  const [auditRecord, setAuditRecord] = useState<CopilotStudentDraft | null>(null);

  const [goodAsIs, setGoodAsIs] = useState<boolean>(true);
  const [correctedInsight, setCorrectedInsight] = useState("");
  const [auditReasons, setAuditReasons] = useState<SelectedReasonChip[]>([]);
  const [auditCustomReason, setAuditCustomReason] = useState("");

  const [draftForm, setDraftForm] = useState<DraftFormState>(toDraftForm(null));
  const [draftReasons, setDraftReasons] = useState<SelectedReasonChip[]>([]);
  const [draftCustomReason, setDraftCustomReason] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [draftRes, auditRes] = await Promise.all([
        adminApi.getCopilotStudentDrafts(studentId, sessionId ? { session_id: sessionId } : undefined),
        adminApi.getCopilotStudentAudit(studentId, sessionId ? { session_id: sessionId } : undefined),
      ]);
      const draft = draftRes.drafts[0] ?? null;
      setSelectedDraft(draft);
      setDraftForm(toDraftForm(draft));
      setDraftReasons([]);
      setDraftCustomReason("");

      const audit = auditRes.audit ?? draft;
      setAuditRecord(audit);
      setGoodAsIs(audit?.good_as_is ?? true);
      setCorrectedInsight(audit?.corrected_insight ?? "");
      setAuditReasons([]);
      setAuditCustomReason("");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load copilot student");
    } finally {
      setLoading(false);
    }
  }, [sessionId, studentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const aiInsight = selectedDraft?.ai_insight ?? auditRecord?.ai_insight ?? "";
  const requiresAuditReason = useMemo(() => {
    if (goodAsIs) return false;
    if (normalizeText(correctedInsight) && normalizeText(correctedInsight) !== normalizeText(aiInsight)) {
      return true;
    }
    return true;
  }, [aiInsight, correctedInsight, goodAsIs]);

  const hasDraftChanges = useMemo(() => {
    const base = toDraftForm(selectedDraft);
    return (
      base.grade_draft !== draftForm.grade_draft ||
      base.comment_draft !== draftForm.comment_draft ||
      base.task_draft !== draftForm.task_draft ||
      base.email_draft !== draftForm.email_draft ||
      base.script_draft !== draftForm.script_draft
    );
  }, [draftForm, selectedDraft]);

  const saveAudit = useCallback(async () => {
    if (requiresAuditReason && auditReasons.length === 0 && !normalizeText(auditCustomReason)) {
      toast.error("Select at least one reason chip or add custom reason for audit corrections.");
      return;
    }
    setSavingAudit(true);
    try {
      await adminApi.updateCopilotStudentAudit(studentId, {
        good_as_is: goodAsIs,
        corrected_insight: normalizeText(correctedInsight) || null,
        reason_chips: auditReasons.length > 0 ? auditReasons : undefined,
        reason_chip_custom: normalizeText(auditCustomReason) || null,
      });
      toast.success("Audit updated.");
      await refresh();
      await onStateMutated?.("persist");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to update audit");
    } finally {
      setSavingAudit(false);
    }
  }, [
    auditCustomReason,
    auditReasons,
    correctedInsight,
    goodAsIs,
    onStateMutated,
    refresh,
    requiresAuditReason,
    studentId,
  ]);

  const saveDraft = useCallback(async () => {
    if (hasDraftChanges && draftReasons.length === 0 && !normalizeText(draftCustomReason)) {
      toast.error("Select at least one reason chip or add custom reason before saving edits.");
      return;
    }
    const grade =
      normalizeText(draftForm.grade_draft) === ""
        ? null
        : Number.parseFloat(normalizeText(draftForm.grade_draft));
    if (grade != null && Number.isNaN(grade)) {
      toast.error("Grade must be numeric.");
      return;
    }
    setSavingDraft(true);
    try {
      await adminApi.updateCopilotStudentDrafts(studentId, {
        grade_draft: grade,
        comment_draft: normalizeText(draftForm.comment_draft) || null,
        task_draft: normalizeText(draftForm.task_draft) || null,
        email_draft: normalizeText(draftForm.email_draft) || null,
        script_draft: normalizeText(draftForm.script_draft) || null,
        reason_chips: hasDraftChanges && draftReasons.length > 0 ? draftReasons : undefined,
        reason_chip_custom: hasDraftChanges ? normalizeText(draftCustomReason) || null : undefined,
      });
      toast.success("Draft updated.");
      await refresh();
      await onStateMutated?.("persist");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to update draft");
    } finally {
      setSavingDraft(false);
    }
  }, [draftCustomReason, draftForm, draftReasons, hasDraftChanges, onStateMutated, refresh, studentId]);

  const approve = useCallback(async () => {
    setApproving(true);
    try {
      await adminApi.approveCopilotStudent(studentId, {
        session_id: sessionId ?? undefined,
        draft_id: selectedDraft?.id,
        idempotency_key: crypto.randomUUID(),
      });
      toast.success("Draft approved.");
      await refresh();
      await onStateMutated?.("workflow");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to approve draft");
    } finally {
      setApproving(false);
    }
  }, [onStateMutated, refresh, selectedDraft?.id, sessionId, studentId]);

  const send = useCallback(async () => {
    setSending(true);
    try {
      await adminApi.sendCopilotStudent(studentId, {
        session_id: sessionId ?? undefined,
        draft_id: selectedDraft?.id,
        idempotency_key: crypto.randomUUID(),
      });
      toast.success("Draft sent.");
      await refresh();
      await onStateMutated?.("workflow");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to send draft");
    } finally {
      setSending(false);
    }
  }, [onStateMutated, refresh, selectedDraft?.id, sessionId, studentId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDraft();
        return;
      }
      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        void send();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void approve();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [approve, saveDraft, send]);

  const disableActions = loading || savingAudit || savingDraft || approving || sending;

  return (
    <Card className="border-border/80 bg-card/85 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Student Workspace</h2>
          <p className="text-xs leading-5 text-muted-foreground">
            Shortcuts: Save draft <kbd>Cmd/Ctrl+S</kbd> | Approve <kbd>Cmd/Ctrl+Enter</kbd> | Send{" "}
            <kbd>Cmd/Ctrl+Shift+Enter</kbd>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={disableActions}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading draft and audit...</p>
      ) : selectedDraft == null ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No draft found for this student/session yet.
        </p>
      ) : (
        <div className="space-y-4 animate-fade-in-short">
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              AI Insight
            </p>
            <p className="text-sm leading-6 text-foreground">{selectedDraft.ai_insight ?? "No AI insight provided."}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-2.5 rounded-xl border border-border/80 bg-background/60 p-3.5 shadow-sm">
              <h3 className="text-sm font-semibold tracking-wide">Block A: Audit</h3>
              <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm">
                <input
                  type="checkbox"
                  checked={goodAsIs}
                  onChange={(event) => setGoodAsIs(event.target.checked)}
                  disabled={disableActions}
                />
                Good as-is
              </label>
              <textarea
                rows={4}
                value={correctedInsight}
                disabled={disableActions}
                onChange={(event) => setCorrectedInsight(event.target.value)}
                placeholder="Corrected insight (required when not good as-is)"
                className={fieldClassName}
              />
              <ReasonChipSelector
                chips={chips}
                selected={auditReasons}
                customReason={auditCustomReason}
                onSelectedChange={setAuditReasons}
                onCustomReasonChange={setAuditCustomReason}
                disabled={disableActions}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={() => void saveAudit()} disabled={disableActions}>
                  {savingAudit ? "Saving..." : "Save audit"}
                </Button>
              </div>
            </section>

            <section className="space-y-2.5 rounded-xl border border-border/80 bg-background/60 p-3.5 shadow-sm">
              <h3 className="text-sm font-semibold tracking-wide">Block B: Draft Composer</h3>
              <input
                value={draftForm.grade_draft}
                onChange={(event) =>
                  setDraftForm((prev) => ({
                    ...prev,
                    grade_draft: event.target.value,
                  }))
                }
                disabled={disableActions}
                placeholder="Grade draft (0-10)"
                className={`h-10 py-0 ${fieldClassName}`}
              />
              <textarea
                rows={3}
                value={draftForm.comment_draft}
                onChange={(event) =>
                  setDraftForm((prev) => ({
                    ...prev,
                    comment_draft: event.target.value,
                  }))
                }
                disabled={disableActions}
                placeholder="Coach comment draft"
                className={fieldClassName}
              />
              <textarea
                rows={3}
                value={draftForm.task_draft}
                onChange={(event) =>
                  setDraftForm((prev) => ({
                    ...prev,
                    task_draft: event.target.value,
                  }))
                }
                disabled={disableActions}
                placeholder="Task draft"
                className={fieldClassName}
              />
              <textarea
                rows={4}
                value={draftForm.email_draft}
                onChange={(event) =>
                  setDraftForm((prev) => ({
                    ...prev,
                    email_draft: event.target.value,
                  }))
                }
                disabled={disableActions}
                placeholder="Email draft"
                className={fieldClassName}
              />
              <textarea
                rows={4}
                value={draftForm.script_draft}
                onChange={(event) =>
                  setDraftForm((prev) => ({
                    ...prev,
                    script_draft: event.target.value,
                  }))
                }
                disabled={disableActions}
                placeholder="Script draft"
                className={fieldClassName}
              />

              <ReasonChipSelector
                chips={chips}
                selected={draftReasons}
                customReason={draftCustomReason}
                onSelectedChange={setDraftReasons}
                onCustomReasonChange={setDraftCustomReason}
                disabled={disableActions}
              />

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => void approve()} disabled={disableActions}>
                  {approving ? "Approving..." : "Approve"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => void send()} disabled={disableActions}>
                  {sending ? "Sending..." : "Send"}
                </Button>
                <Button size="sm" onClick={() => void saveDraft()} disabled={disableActions}>
                  {savingDraft ? "Saving..." : "Save draft"}
                </Button>
              </div>
            </section>
          </div>
        </div>
      )}
    </Card>
  );
}

import { CoachEmail } from "@/components/CoachEmail";
import { CoachCompletionEmail } from "@/components/CoachCompletionEmail";
import { StudentCompletionEmail } from "@/components/StudentCompletionEmail";

/**
 * Preview email layouts used by backend templates.
 * - default: coach completion email
 * - ?type=assignment: assignment email
 */
export default function EmailPreviewPage({
  searchParams,
}: {
  searchParams?: { type?: string };
}) {
  const type = (searchParams?.type ?? "").toLowerCase();
  const isAssignment = type === "assignment";
  const isStudentCompletion = type === "student-completion";

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        Previewing: {isAssignment ? "assignment email" : isStudentCompletion ? "student completion email" : "coach completion email"}.
        {" "}Use{" "}
        <code>?type=assignment</code>,{" "}
        <code>?type=student-completion</code>,{" "}or{" "}
        <code>?type=completion</code>.
      </div>
      {isAssignment ? <CoachEmail /> : isStudentCompletion ? <StudentCompletionEmail /> : <CoachCompletionEmail />}
    </div>
  );
}

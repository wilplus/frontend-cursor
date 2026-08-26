import { Suspense } from "react";
import LoadingState from "@/components/willab/LoadingState";
import CoachAuditPageClient from "./page.client";

export const dynamic = "force-dynamic";

export default function CoachAuditPage({
  params,
}: {
  params: { studentId: string };
}) {
  return (
    <Suspense fallback={<LoadingState placement="viewport" />}>
      <CoachAuditPageClient studentId={params.studentId} />
    </Suspense>
  );
}

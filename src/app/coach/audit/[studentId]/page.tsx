import { Suspense } from "react";
import CoachAuditPageClient from "./page.client";

export const dynamic = "force-dynamic";

export default function CoachAuditPage({
  params,
}: {
  params: { studentId: string };
}) {
  return (
    <Suspense>
      <CoachAuditPageClient studentId={params.studentId} />
    </Suspense>
  );
}

"use client";

import AdminGate from "@/components/admin/AdminGate";
import { ProjectDeletionQueue } from "@/components/admin/ProjectDeletionQueue";

/** Operator queue for project deletions (P1, N8). Admin only. */
export default function AdminProjectDeletionsPage() {
  return (
    <AdminGate>
      <ProjectDeletionQueue />
    </AdminGate>
  );
}

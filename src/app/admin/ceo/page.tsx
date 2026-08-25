"use client";

import AdminGate from "@/components/admin/AdminGate";
import CeoWorkspace from "@/components/ceo/CeoWorkspace";

export default function AdminCeoPage() {
  return (
    <AdminGate>
      <CeoWorkspace />
    </AdminGate>
  );
}

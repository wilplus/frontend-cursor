"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminGate from "@/components/admin/AdminGate";
import { CeoCorpusPage } from "@/components/ceo/CeoCorpus";

/** /admin/training-corpus — the admin menu's Training corpus row (backend
 *  N511): the corpus's screens, open at once; ✕ goes to the CEO panel. */
export default function AdminTrainingCorpusPage() {
  const router = useRouter();
  const toCeo = useCallback(() => router.replace("/admin/ceo"), [router]);
  return (
    <AdminGate>
      <CeoCorpusPage onClose={toCeo} />
    </AdminGate>
  );
}

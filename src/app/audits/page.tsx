import { Suspense } from "react";
import LoadingState from "@/components/willab/LoadingState";
import AuditsPageClient from "./page.client";

export const dynamic = "force-dynamic";

export default function AuditsPage() {
  return (
    <Suspense fallback={<LoadingState placement="viewport" />}>
      <AuditsPageClient />
    </Suspense>
  );
}

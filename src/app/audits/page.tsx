import { Suspense } from "react";
import AuditsPageClient from "./page.client";

export const dynamic = "force-dynamic";

export default function AuditsPage() {
  return (
    <Suspense>
      <AuditsPageClient />
    </Suspense>
  );
}

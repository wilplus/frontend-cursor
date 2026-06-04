"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fetchReviewQueue, type ReviewQueueRow } from "@/services/api/reviewQueue";

/**
 * /coach/willab — willab coach review queue (§14 / §3.8).
 *
 * Lists review_pending sessions (keyed on the pseudonymous id); a row opens the
 * authoring view at /coach/willab/<sessionId>. Data lands when BE confirms
 * contract ① (fetchReviewQueue); the UI is ready for it.
 */
export default function CoachWillabQueuePage() {
  const [rows, setRows] = useState<ReviewQueueRow[] | null>(null);

  useEffect(() => {
    let active = true;
    void fetchReviewQueue().then((r) => {
      if (active) setRows(r);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col px-4 py-6">
      <h1 className="text-[17px] font-semibold text-foreground">Review queue</h1>
      <p className="mb-4 text-[12px] text-muted-foreground">
        Sessions awaiting your read.
      </p>

      {rows === null ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">
          No sessions awaiting review.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.sessionId}>
              <Link
                href={`/coach/willab/${r.sessionId}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/50"
              >
                <div>
                  <p className="text-[15px] font-medium text-foreground">
                    {r.topic || "Untitled session"}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {r.pseudonymousUserId}
                    {r.sentAt ? ` · ${r.sentAt}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] text-primary">Review →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

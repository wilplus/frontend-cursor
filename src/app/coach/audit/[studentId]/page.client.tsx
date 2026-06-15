"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  fetchCoachAuditData,
  type CoachAuditData,
  type FeelingBucket,
} from "@/services/api/coachAuditData";

const FEELING_LABEL: Record<string, string> = {
  nervous: "Nervous",
  excited: "Excited",
  calm: "Calm",
  unsure: "Unsure",
};

const FEELING_COLOR: Record<string, string> = {
  nervous: "bg-amber-400",
  excited: "bg-emerald-400",
  calm: "bg-sky-400",
  unsure: "bg-slate-400",
};

function PerformanceBar({ bucket, max }: { bucket: FeelingBucket; max: number }) {
  const pct = max > 0 ? Math.round((bucket.score / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[13px] text-muted-foreground">
        {FEELING_LABEL[bucket.feeling] ?? bucket.feeling}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${FEELING_COLOR[bucket.feeling] ?? "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[13px] text-muted-foreground">
        {bucket.score.toFixed(2)}
      </span>
      <span className="w-12 shrink-0 text-right text-[11px] text-muted-foreground">
        n={bucket.n}
      </span>
    </div>
  );
}

export default function CoachAuditPageClient({
  studentId,
}: {
  studentId: string;
}) {
  const [data, setData] = useState<CoachAuditData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    void fetchCoachAuditData(studentId).then((d) => {
      setData(d);
      setStatus(d ? "ready" : "error");
    });
  }, [studentId]);

  const perf = data?.performanceUnderFeeling ?? null;
  const stress = data?.stressAsFuel ?? null;
  const maxScore = perf
    ? Math.max(...perf.buckets.map((b) => b.score), 0.001)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center border-b border-border px-4">
        <Link
          href="/chat"
          className="flex items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <span className="ml-4 text-[15px] font-semibold text-foreground">
          Speaking Impact Audit
        </span>
        <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          Coach view
        </span>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {status === "loading" ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : status === "error" ? (
          <p className="text-[15px] text-muted-foreground">
            No data available yet.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Performance under feeling */}
            {perf ? (
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-1 text-[17px] font-semibold text-foreground">
                  Performance under feeling
                </h2>
                {perf.headline ? (
                  <p className="mb-4 text-[14px] text-muted-foreground">
                    {perf.headline}
                  </p>
                ) : null}
                <div className="flex flex-col gap-3">
                  {perf.buckets
                    .slice()
                    .sort((a, b) => b.score - a.score)
                    .map((b) => (
                      <PerformanceBar key={b.feeling} bucket={b} max={maxScore} />
                    ))}
                </div>
              </section>
            ) : null}

            {/* Stress as fuel */}
            {stress ? (
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-1 text-[17px] font-semibold text-foreground">
                  Stress as fuel
                </h2>
                {stress.headline ? (
                  <p className="mb-4 text-[14px] text-muted-foreground">
                    {stress.headline}
                  </p>
                ) : null}
                <div className="flex items-end gap-3">
                  <span className="text-[48px] font-bold leading-none text-foreground">
                    {stress.pct}%
                  </span>
                  <span className="mb-1 text-[14px] text-muted-foreground">
                    of nervous takes performed above average
                  </span>
                </div>
              </section>
            ) : null}

            {/* Your best line, slide by slide — user-facing section */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 text-[17px] font-semibold text-foreground">
                Your best line, slide by slide
              </h2>
              <p className="text-[14px] text-muted-foreground">
                This section draws from the student&apos;s personal strengths view
                and is visible when the student opens their audit.
              </p>
            </section>

            {(!perf && !stress) ? (
              <p className="text-[15px] text-muted-foreground">
                Not enough data to populate sections yet.
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

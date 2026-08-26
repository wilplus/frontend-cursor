"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingState from "@/components/willab/LoadingState";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import {
  fetchFounderConfidenceComparison,
  type ConfidenceComparisonValue,
  type FounderConfidenceComparison,
} from "@/services/api/founderConfidenceComparison";

function label(value: ConfidenceComparisonValue | null): string {
  if (value === "yes") return "Confident";
  if (value === "in_between") return "In-between";
  if (value === "no") return "Not confident";
  if (value === "not_sure" || value === "neutral") return "Not sure";
  if (value === "audio_unclear") return "Audio unclear";
  return "No stored read";
}

export default function FounderComparisonClient({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const [comparison, setComparison] =
    useState<FounderConfidenceComparison | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchFounderConfidenceComparison(sessionId).then((result) => {
      if (cancelled) return;
      setComparison(result);
      setFailed(result === null);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main className="mx-auto flex h-full w-full max-w-2xl flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-[15px] font-semibold text-foreground">
            Machine × coach
          </h1>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Founder audit · after blind labeling
          </p>
        </div>
        <OverlayCloseButton
          onClick={() => router.push("/coach/corpus")}
          ariaLabel="Close comparison"
        />
      </header>

      <div className="scrollbar-none flex flex-1 flex-col overflow-y-auto px-4 py-6">
        {!comparison && !failed ? (
          <LoadingState placement="surface" />
        ) : failed ? (
          <p className="text-center text-[14px] text-muted-foreground">
            This comparison is unavailable.
          </p>
        ) : comparison ? (
          <div className="space-y-5">
            <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-[13px] text-muted-foreground">
              {comparison.note} This screen is an audit summary; it never
              changes training labels, user feedback, or Voice Album state.
            </p>

            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ["Labeled", comparison.summary.labelled],
                ["Comparable", comparison.summary.comparable],
                ["Same", comparison.summary.same],
                ["Different", comparison.summary.different],
                ["Both confident", comparison.summary.bothConfident],
              ].map(([name, number]) => (
                <div
                  key={String(name)}
                  className="rounded-xl border border-border p-3"
                >
                  <dt className="text-[11px] text-muted-foreground">{name}</dt>
                  <dd className="mt-1 text-[20px] font-semibold text-foreground">
                    {number}
                  </dd>
                </div>
              ))}
            </dl>

            <ol className="space-y-3">
              {comparison.rows.map((row, index) => (
                <li
                  key={row.snippetId}
                  className="rounded-2xl border border-border p-4"
                >
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Piece {index + 1}
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                    {row.transcript || "No transcript"}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-muted-foreground">Machine</p>
                      <p className="mt-1 font-medium text-foreground">
                        {label(row.machineValue)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-muted-foreground">Your blind label</p>
                      <p className="mt-1 font-medium text-foreground">
                        {row.coachUnrateable
                          ? "Couldn’t judge"
                          : label(row.coachValue)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[12px] font-medium text-muted-foreground">
                    {row.agreement === true
                      ? "Same"
                      : row.agreement === false
                        ? "Different"
                        : "Not comparable"}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </main>
  );
}

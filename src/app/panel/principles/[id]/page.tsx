"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import { EMPTY } from "@/lib/life/copy";
import { mistakeCategoryLabel } from "@/lib/life/types";
import { fetchPrinciple } from "@/services/api/life";
import {
  EmptyState,
  Eyebrow,
  PanelCard,
  Resource,
  usePanelResource,
} from "@/components/life/primitives";

/* -------------------------------------------------------------------------- */
/*  FE-4 — principle detail: the full case, all five slots at once             */
/*                                                                            */
/*    1  the case at hand                                                     */
/*    2  👾 the category (there may be several, and the corpus has cases that  */
/*       carry two)                                                           */
/*    3  the principles that applied, and how they were weighed                */
/*    4  the reflections — WRITTEN BY THE USER. Rendered read-only here, with  */
/*       no draft button and no placeholder that writes for them (N6 / L-1).   */
/*    5  ⚜️ the principle itself                                               */
/*                                                                            */
/*  Plus the application log (L-5): every place this principle has actually    */
/*  been cited. That log is the honest answer to which principles are load-    */
/*  bearing and which are decorative. It shows COUNTS AND CONTEXTS, never a    */
/*  rank and never a score (N4) — the ordering is chronological, so the view   */
/*  cannot be read as a league table.                                          */
/* -------------------------------------------------------------------------- */

export default function PrincipleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const load = useCallback(() => fetchPrinciple(params.id), [params.id]);
  const resource = usePanelResource(`principle:${params.id}`, load);
  const router = useRouter();

  return (
    <>
      {/* Game-style header row (the design reference): title left, the one
          close control right — no back text or arrow (founder, item 6d). */}
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-foreground">Principle</h2>
        <OverlayCloseButton
          onClick={() => router.push("/panel/principles")}
          ariaLabel="Close principle"
        />
      </div>

      <Resource resource={resource}>
        {(principle) => {
          if (!principle) return <EmptyState>{EMPTY.principles}</EmptyState>;
          return (
            <article className="mt-5">
              <h1 className="text-2xl font-semibold leading-snug tracking-tight text-foreground">
                <span aria-hidden>⚜️ </span>
                {principle.title}
              </h1>
              {principle.body ? (
                <p className="mt-2 text-[15px] leading-[1.7] text-foreground/90">
                  {principle.body}
                </p>
              ) : null}
              {principle.retired ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Retired. It stays here because it was true when you wrote it.
                </p>
              ) : null}

              <Slot label="The case at hand">
                <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground/90">
                  {principle.caseAtHand}
                </p>
                {principle.occurredOn ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {principle.occurredOn}
                  </p>
                ) : null}
              </Slot>

              {principle.categories.length > 0 ? (
                <Slot label="What kind of error">
                  <ul className="space-y-1">
                    {principle.categories.map((c) => (
                      <li key={c} className="text-[15px] text-foreground/90">
                        <span aria-hidden>👾 </span>
                        {mistakeCategoryLabel(c)}
                      </li>
                    ))}
                  </ul>
                </Slot>
              ) : null}

              {principle.principlesApplied.length > 0 ? (
                <Slot label="Principles that applied">
                  <ul className="space-y-2">
                    {principle.principlesApplied.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/panel/principles/${p.id}`}
                          className="text-[15px] text-foreground underline-offset-4 hover:underline"
                        >
                          {p.title}
                        </Link>
                        {p.note ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {p.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Slot>
              ) : null}

              {principle.reflections ? (
                <Slot label="Your reflections">
                  <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground/90">
                    {principle.reflections}
                  </p>
                </Slot>
              ) : null}

              <Slot label="Where this has been cited">
                {principle.applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {EMPTY.applications}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {principle.applications.map((a) => (
                      <li key={a.id}>
                        <PanelCard>
                          <p className="text-sm text-foreground">{a.summary}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {contextLabel(a.context)}
                            {a.at ? ` · ${formatDay(a.at)}` : ""}
                          </p>
                          {a.href ? (
                            <Link
                              href={a.href}
                              className="mt-1 inline-block text-xs text-foreground underline underline-offset-4"
                            >
                              Open
                            </Link>
                          ) : null}
                        </PanelCard>
                      </li>
                    ))}
                  </ul>
                )}
              </Slot>
            </article>
          );
        }}
      </Resource>
    </>
  );
}

function Slot({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function contextLabel(context: string): string {
  if (context === "comparison") return "Comparison flag";
  if (context === "conflict") return "Conflict pair";
  if (context === "lookup") return "Lookup";
  return "Case";
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

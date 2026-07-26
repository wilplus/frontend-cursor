"use client";

import { useCallback, useState } from "react";
import { DAY, EMPTY, VIEWS } from "@/lib/life/copy";
import { betByKey, type LifeCheck, type LifeDay } from "@/lib/life/types";
import { fetchDay, setDayCheck } from "@/services/api/life";
import ProposalDeck from "@/components/life/ProposalCards";
import {
  EmptyState,
  Eyebrow,
  PanelHeading,
  Resource,
  usePanelResource,
} from "@/components/life/primitives";

/* -------------------------------------------------------------------------- */
/*  FE-6 — the daily card                                                      */
/*                                                                            */
/*  A LANDING STATE, NEVER A NOTIFICATION (N3 / L-4). The card is written      */
/*  server-side at 05:00 and waits here. Generation is scheduled; delivery is  */
/*  not. There is no badge, no unread mark, and nothing anywhere that counts   */
/*  the days a card went unopened. Not typing means living, not failing.       */
/*                                                                            */
/*  FRAME FIXED, CONTENT EDITABLE. The heading "Today's one thing" is part of  */
/*  the frame and cannot be edited away: there is always one thing. What that  */
/*  thing IS can change, through #edit in the chat, and the card says so.      */
/*  The "why" of an edit is the payload, which is why it is captured in chat   */
/*  rather than as a silent inline overwrite here.                             */
/*                                                                            */
/*  Layout follows the founder's template order exactly: morning checks, the   */
/*  one thing, three focus blocks, the distraction check, the three bets with  */
/*  their goals, daily habits, the evening review.                             */
/* -------------------------------------------------------------------------- */

export default function TodayPage() {
  const load = useCallback(() => fetchDay(), []);
  const resource = usePanelResource(load);

  return (
    <>
      <PanelHeading title={VIEWS.today.title} />
      <ProposalDeck title="Waiting for you" />
      <Resource resource={resource}>
        {(day) =>
          day === null ? <EmptyState>{EMPTY.today}</EmptyState> : <DayCard day={day} />
        }
      </Resource>
    </>
  );
}

function DayCard({ day }: { day: LifeDay }) {
  return (
    <article className="space-y-8">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {formatDate(day.date)}
      </p>

      {day.morningChecks.length > 0 ? (
        <Section label={DAY.morningLabel}>
          <CheckList checks={day.morningChecks} />
        </Section>
      ) : null}

      {/* The one thing. Framed heavily on purpose: it is the fixed part. */}
      <section className="rounded-2xl border border-foreground/15 bg-muted/40 p-5">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span aria-hidden>🎯</span>
          {DAY.oneThingLabel}
        </p>
        <p className="mt-2 text-xl font-semibold leading-snug tracking-tight text-foreground">
          {day.oneThing || "Not set."}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">{DAY.frameNote}</p>
        <p className="mt-1 text-xs text-muted-foreground">{DAY.editHint}</p>
      </section>

      {day.focusBlocks.length > 0 ? (
        <Section label={`⚡ ${DAY.focusLabel}`}>
          <ol className="space-y-2">
            {day.focusBlocks.map((block, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-4 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-[15px] text-foreground">{block.text}</span>
                {block.box ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {block.box}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {day.distractionFlagged ? (
        <Section label={`🔴 ${DAY.distractionLabel}`}>
          <p className="text-[15px] text-foreground">{day.distractionFlagged}</p>
        </Section>
      ) : null}

      {day.bets.length > 0 ? (
        <Section label={DAY.betsLabel}>
          <ol className="space-y-4">
            {[...day.bets]
              .sort((a, b) => a.rank - b.rank)
              .map((bet) => {
                const meta = betByKey(bet.key);
                return (
                  <li key={bet.key}>
                    <p className="text-sm font-medium text-foreground">
                      <span aria-hidden>{meta?.glyph} </span>
                      {bet.rank}. {bet.label || meta?.label}
                    </p>
                    {bet.goals.length > 0 ? (
                      <ul className="mt-1 space-y-1 pl-6">
                        {bet.goals.map((goal) => (
                          <li
                            key={goal.id}
                            className="flex items-baseline justify-between gap-3 text-sm text-foreground/90"
                          >
                            <span>{goal.title}</span>
                            {goal.dueLabel ? (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {goal.dueLabel}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
          </ol>
        </Section>
      ) : null}

      {day.dailyHabits.length > 0 ? (
        <Section label={DAY.habitsLabel}>
          <CheckList checks={day.dailyHabits} />
        </Section>
      ) : null}

      <Section label={`🌙 ${DAY.eveningLabel}`}>
        <ul className="space-y-1.5 text-[15px] text-foreground/90">
          <li>Habits ran: {day.evening.habitsRan ? "yes" : "not yet"}</li>
          <li>The one thing: {day.evening.oneThingDone ? "done" : "not yet"}</li>
          {day.evening.distraction ? (
            <li>What pulled at you: {day.evening.distraction}</li>
          ) : null}
        </ul>
        {day.evening.line ? (
          <p className="mt-3 text-[15px] italic leading-relaxed text-foreground/80">
            {day.evening.line}
          </p>
        ) : null}
      </Section>
    </article>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function CheckList({ checks }: { checks: LifeCheck[] }) {
  return (
    <ul className="space-y-1.5">
      {checks.map((check) => (
        <li key={check.id}>
          <CheckRow check={check} />
        </li>
      ))}
    </ul>
  );
}

function CheckRow({ check }: { check: LifeCheck }) {
  const [done, setDone] = useState(check.done);
  const [pending, setPending] = useState(false);

  async function toggle(next: boolean) {
    if (pending) return;
    setPending(true);
    setDone(next);
    try {
      await setDayCheck(check.id, next);
    } catch {
      // Put the box back where it was. A tick that did not save must not look
      // like one that did.
      setDone(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <label className="flex items-center gap-2.5 text-[15px] text-foreground">
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={(e) => void toggle(e.target.checked)}
        className="h-4 w-4 accent-foreground"
      />
      <span className={done ? "text-muted-foreground line-through" : ""}>
        {check.label}
      </span>
    </label>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

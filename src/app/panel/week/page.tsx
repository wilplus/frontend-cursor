"use client";

import { useCallback, useState } from "react";
import { EMPTY, VIEWS, WEEK } from "@/lib/life/copy";
import type { LifeWeek } from "@/lib/life/types";
import { fetchWeek, saveWeek } from "@/services/api/life";
import { ProposalItems } from "@/components/life/ProposalCards";
import {
  EmptyState,
  Eyebrow,
  PanelLede,
  Resource,
  usePanelResource,
} from "@/components/life/primitives";

/* -------------------------------------------------------------------------- */
/*  The Sunday review (spec §3.3). Live backend since BE #262.                 */
/*                                                                            */
/*  Two things make this view different from the others.                      */
/*                                                                            */
/*  L-2b LANDS HERE. Proposals that did not fit the one-a-day allowance queue  */
/*  to this page and arrive as a RANKED BATCH OF THREE. Scarcity is what keeps */
/*  "approve" meaningful: a daily stream of diffs becomes a rubber stamp       */
/*  within three weeks, and the rubber stamp is the drift. So there is no      */
/*  "show the rest" affordance here, and there must never be one. The mapper   */
/*  caps at three as well, because the FE is the surface where a longer batch  */
/*  would actually do the damage.                                             */
/*                                                                            */
/*  ONE ENVIRONMENTAL CHANGE, SINGULAR. Section IV answers every distraction   */
/*  with a design response rather than with willpower, at a rate of one a week.*/
/*  A list here would turn that into a backlog, which is the same as not doing */
/*  it. One field, one change.                                                 */
/*                                                                            */
/*  Everything the user writes on this page is theirs. Nothing is drafted, and */
/*  no field carries a placeholder that would write it for them (L-1 / N6).    */
/*  The review reads what happened; it does not grade it (N4).                 */
/* -------------------------------------------------------------------------- */

export default function WeekPage() {
  const load = useCallback(() => fetchWeek(), []);
  const resource = usePanelResource(load);

  return (
    <>
      <PanelLede lede={VIEWS.week.lede} />
      <Resource resource={resource}>
        {(week) =>
          week === null ? (
            <EmptyState>{EMPTY.week}</EmptyState>
          ) : (
            <WeekReview week={week} />
          )
        }
      </Resource>
    </>
  );
}

function WeekReview({ week }: { week: LifeWeek }) {
  return (
    <div className="space-y-10">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {formatWeek(week.weekOf)}
      </p>

      {week.habitsFailed.length > 0 ? (
        <section>
          <Eyebrow>{WEEK.habitsLabel}</Eyebrow>
          <ul className="mt-3 space-y-3">
            {week.habitsFailed.map((habit) => (
              <li
                key={habit.id}
                className="rounded-2xl border border-border bg-background p-4"
              >
                <p className="text-[15px] text-foreground">{habit.label}</p>
                <SavedText
                  initial={habit.why}
                  rows={2}
                  onSave={(why) =>
                    saveWeek({
                      habitsFailed: week.habitsFailed.map((h) =>
                        h.id === habit.id ? { ...h, why } : h
                      ),
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {week.goalsMoved.length > 0 ? (
        <section>
          <Eyebrow>{WEEK.goalsLabel}</Eyebrow>
          <ul className="mt-3 space-y-3">
            {week.goalsMoved.map((goal) => (
              <li
                key={goal.id}
                className="rounded-2xl border border-border bg-background p-4"
              >
                <p className="text-[15px] text-foreground">{goal.title}</p>
                <SavedText
                  initial={goal.nextAction}
                  rows={2}
                  onSave={(nextAction) =>
                    saveWeek({
                      goalsMoved: week.goalsMoved.map((g) =>
                        g.id === goal.id ? { ...g, nextAction } : g
                      ),
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <Eyebrow>{WEEK.distractionLabel}</Eyebrow>
        <SavedText
          initial={week.mainDistraction}
          rows={2}
          onSave={(mainDistraction) => saveWeek({ mainDistraction })}
        />
      </section>

      <section>
        <Eyebrow>{WEEK.changeLabel}</Eyebrow>
        <p className="mt-1 text-sm text-muted-foreground">{WEEK.changeHint}</p>
        {/* Singular. One field, not a list: a list is a backlog, and a backlog
            is the same as not doing it. */}
        <SavedText
          initial={week.environmentalChange}
          rows={2}
          onSave={(environmentalChange) => saveWeek({ environmentalChange })}
        />
      </section>

      <section>
        <Eyebrow>{WEEK.becomingLabel}</Eyebrow>
        <SavedText
          initial={week.becomingSentence}
          rows={3}
          onSave={(becomingSentence) => saveWeek({ becomingSentence })}
        />
      </section>

      {week.proposals.length > 0 ? (
        <section className="border-t border-border pt-8">
          <Eyebrow>{WEEK.batchLabel}</Eyebrow>
          <p className="mt-1 text-sm text-muted-foreground">{WEEK.batchHint}</p>
          <div className="mt-4">
            <ProposalItems proposals={week.proposals} />
          </div>
        </section>
      ) : null}

      <section className="border-t border-border pt-8">
        <Eyebrow>{WEEK.untaggedLabel}</Eyebrow>
        <p className="mt-1 text-sm text-muted-foreground">
          {WEEK.untaggedHint}
        </p>
        {week.untagged.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{EMPTY.untagged}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {week.untagged.map((note) => (
              <li
                key={note.id}
                className="rounded-2xl border border-border bg-background p-4"
              >
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
                  {note.body}
                </p>
                {note.createdAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDay(note.createdAt)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * A textarea that saves on blur and puts the user's text back if the save
 * failed, so a lost write never looks like a landed one.
 *
 * NO PLACEHOLDER, on any instance. Every field on this page is the user's own
 * account of their week, and a greyed suggestion in one of them is the system
 * drafting the reflection a sentence at a time (N6 / L-1).
 */
function SavedText({
  initial,
  rows,
  onSave,
}: {
  initial: string;
  rows: number;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);

  async function commit() {
    const next = value.trim();
    if (next === saved) return;
    setSaved(next);
    try {
      await onSave(next);
    } catch {
      setSaved(saved);
      setValue(saved);
    }
  }

  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[15px] leading-[1.7] outline-none focus:border-foreground/30"
    />
  );
}

function formatWeek(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `WEEK OF ${d
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase()}`;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

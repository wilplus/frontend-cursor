"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { DAY, EMPTY, STATUS, VIEWS } from "@/lib/life/copy";
import {
  betByKey,
  type LifeBetKey,
  type LifeCheck,
  type LifeDay,
  type LifeDayEvening,
  type LifeDayMorning,
} from "@/lib/life/types";
import {
  fetchDay,
  fetchUserCopy,
  saveDayEvening,
  saveUserCopy,
  setDayCheck,
  type LifeUserCopy,
} from "@/services/api/life";
import ProposalDeck from "@/components/life/ProposalCards";
import {
  EmptyState,
  Eyebrow,
  PanelHeading,
  Resource,
  usePanelResource,
} from "@/components/life/primitives";

/* -------------------------------------------------------------------------- */
/*  FE-6 — the day, in two cards (founder, 2026-07-26)                         */
/*                                                                            */
/*    05:00  the plan     one thing, focus blocks, the bets, the habits        */
/*    23:00  the summary  what the day held, then the user's own review        */
/*                                                                            */
/*  BOTH ARE LANDING STATES, NEVER NOTIFICATIONS (N3 / L-4). Generation is     */
/*  scheduled; delivery is not. The 23:00 summary is written and then waits,   */
/*  exactly like the 05:00 card. Nothing pings, nothing is badged, and         */
/*  nowhere does this view count the days a card went unopened. Not typing     */
/*  means living, not failing.                                                 */
/*                                                                            */
/*  The split runs down the middle of L-1. The summary is the SYSTEM'S, and it */
/*  is factual: what the one thing was, which habits ran, what got flagged.    */
/*  The review below it is the USER'S, and the answer field has no placeholder */
/*  and no draft button, because the system does not write reflections (N6).   */
/*                                                                            */
/*  FRAME FIXED, CONTENT EDITABLE. "Today's one thing" is frame and cannot be  */
/*  edited away: there is always one thing. What that thing IS changes through */
/*  #edit in the chat, where the "why" is captured as a candidate correction.  */
/* -------------------------------------------------------------------------- */

export default function TodayPage() {
  const load = useCallback(() => fetchDay(), []);
  const resource = usePanelResource(load);

  // The user's rewording of the mantra lines (founder 2026-07-30, "my copy
  // as default, editable"). Fetched alongside the day card and NEVER
  // load-bearing: while loading or on failure the founder's defaults render,
  // which is also exactly what null fields mean.
  const [overrides, setOverrides] = useState<LifeUserCopy | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchUserCopy()
      .then((value) => {
        if (!cancelled) setOverrides(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PanelHeading title={VIEWS.today.title} />
      <ProposalDeck title="Waiting for you" />
      <Resource resource={resource}>
        {(day) =>
          day === null ? (
            <EmptyState>{EMPTY.today}</EmptyState>
          ) : (
            <DayCards
              day={day}
              overrides={overrides}
              onOverrides={setOverrides}
            />
          )
        }
      </Resource>
    </>
  );
}

function DayCards({
  day,
  overrides,
  onOverrides,
}: {
  day: LifeDay;
  overrides: LifeUserCopy | null;
  onOverrides: (next: LifeUserCopy) => void;
}) {
  return (
    <div className="space-y-10">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {formatDate(day.date)}
      </p>
      <MantraHeader overrides={overrides} onOverrides={onOverrides} />
      <MorningCard
        morning={day.morning}
        distractionQuestion={
          overrides?.distractionQuestion ?? DAY.distractionQuestion
        }
      />
      <EveningCard evening={day.evening} />
    </div>
  );
}

/** Founder 2026-07-30 — the mantra opens the day card. The founder's copy is
 *  the DEFAULT, set between two quiet rules; the type ramp matches the panel
 *  (eyebrow track for the title, the italic 15px the evening question
 *  already uses).
 *
 *  EDITABLE, same day's second decision: the pencil opens inline inputs for
 *  the three lines (the distraction question is edited here too — one
 *  editor for one set of lines, rather than a second affordance buried in
 *  settings). An emptied field goes back to the founder's line; the copy
 *  says so. The system never suggests a rewording — these inputs take the
 *  user's own words and nothing else (the same rule as the evening answer). */
function MantraHeader({
  overrides,
  onOverrides,
}: {
  overrides: LifeUserCopy | null;
  onOverrides: (next: LifeUserCopy) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [distraction, setDistraction] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const effectiveTitle = overrides?.mantraTitle ?? DAY.mantraTitle;
  const effectiveQuestion = overrides?.mantraQuestion ?? DAY.mantraQuestion;

  function open() {
    setTitle(overrides?.mantraTitle ?? "");
    setQuestion(overrides?.mantraQuestion ?? "");
    setDistraction(overrides?.distractionQuestion ?? "");
    setFailed(false);
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    setFailed(false);
    try {
      // Empty ⇒ null ⇒ the founder's line. What the user typed is sent
      // verbatim; nothing drafts or completes it.
      const saved = await saveUserCopy({
        mantraTitle: title.trim() || null,
        mantraQuestion: question.trim() || null,
        distractionQuestion: distraction.trim() || null,
      });
      onOverrides(saved);
      setEditing(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="relative border-y border-border py-5 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {effectiveTitle}
        </p>
        <p className="mt-1.5 text-[15px] italic leading-relaxed text-foreground/80">
          {effectiveQuestion}
        </p>
        <button
          type="button"
          aria-label={DAY.copyEditLabel}
          onClick={open}
          className="absolute right-0 top-2 rounded-lg p-2 text-muted-foreground/60 hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-y border-border py-5">
      <div className="space-y-3">
        <CopyField
          label={DAY.copyMantraTitleLabel}
          value={title}
          placeholder={DAY.mantraTitle}
          disabled={busy}
          onChange={setTitle}
        />
        <CopyField
          label={DAY.copyMantraQuestionLabel}
          value={question}
          placeholder={DAY.mantraQuestion}
          disabled={busy}
          onChange={setQuestion}
        />
        <CopyField
          label={DAY.copyDistractionQuestionLabel}
          value={distraction}
          placeholder={DAY.distractionQuestion}
          disabled={busy}
          onChange={setDistraction}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{DAY.copyClearNote}</p>
      {failed ? (
        <p className="mt-2 text-sm text-muted-foreground">{STATUS.error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background disabled:opacity-40"
        >
          {DAY.copySaveLabel}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={busy}
          className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground disabled:opacity-40"
        >
          {DAY.copyCancelLabel}
        </button>
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  /** The founder's default line — shown as the placeholder so the user can
   *  see what an emptied field falls back to. */
  placeholder: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
      />
    </label>
  );
}

/* --------------------------------- 05:00 ---------------------------------- */

function MorningCard({
  morning,
  distractionQuestion,
}: {
  morning: LifeDayMorning;
  /** The founder's default, or the user's own rewording (edited from the
   *  mantra block's pencil). */
  distractionQuestion: string;
}) {
  const empty =
    !morning.oneThing &&
    morning.checks.length === 0 &&
    morning.focusBlocks.length === 0 &&
    morning.bets.length === 0 &&
    morning.habits.length === 0;

  return (
    <section className="space-y-8">
      <Eyebrow>{DAY.planTitle}</Eyebrow>

      {empty ? (
        <EmptyState>{DAY.planPending}</EmptyState>
      ) : (
        <>
          {morning.checks.length > 0 ? (
            <Block label={DAY.morningLabel}>
              <CheckList checks={morning.checks} />
            </Block>
          ) : null}

          {/* The one thing. Framed heavily on purpose: it is the fixed part. */}
          <div className="rounded-2xl border border-foreground/15 bg-muted/40 p-5">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span aria-hidden>🎯</span>
              {DAY.oneThingLabel}
            </p>
            <p className="mt-2 text-xl font-semibold leading-snug tracking-tight text-foreground">
              {morning.oneThing || "Not set."}
            </p>
            {/* Which bet this serves. Load-bearing since Bet 3 became eligible
                for daily tasks: with all three in play, an unlabelled card
                makes the rank invisible on the surface the rank governs. */}
            <BetTag betKey={morning.oneThingBet} className="mt-2" />
            <p className="mt-3 text-xs text-muted-foreground">{DAY.frameNote}</p>
            <p className="mt-1 text-xs text-muted-foreground">{DAY.editHint}</p>
          </div>

          {morning.focusBlocks.length > 0 ? (
            <Block label={`⚡ ${DAY.focusLabel}`}>
              <ol className="space-y-2">
                {morning.focusBlocks.map((block, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-4 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="text-[15px] text-foreground">
                        {block.text}
                      </span>
                      <BetTag betKey={block.betKey} className="mt-1" />
                    </span>
                    {block.box ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {block.box}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Block>
          ) : null}

          {/* Founder 2026-07-30 — the block now always renders, opening with
              the distraction question (verbatim copy) above whatever was
              flagged. The question is the check; the flagged text is the
              user's own answer to it when one exists. */}
          <Block label={`🔴 ${DAY.distractionLabel}`}>
            <p className="text-[15px] italic leading-relaxed text-foreground/80">
              {distractionQuestion}
            </p>
            {morning.distractionFlagged ? (
              <p className="mt-2 text-[15px] text-foreground">
                {morning.distractionFlagged}
              </p>
            ) : null}
          </Block>

          {morning.bets.length > 0 ? (
            <Block label={DAY.betsLabel}>
              <ol className="space-y-4">
                {[...morning.bets]
                  .sort((a, b) => a.rank - b.rank)
                  .map((bet) => {
                    const meta = betByKey(bet.key);
                    return (
                      <li key={bet.key}>
                        <p className="text-sm font-medium text-foreground">
                          <span aria-hidden>{meta?.glyph} </span>
                          {/* Known key → LIFE_BETS wins; see the same note on
                              the goals screen. Stored rows still carry the old
                              label the backend wrote when they were generated. */}
                          {bet.rank}. {meta?.label || bet.label}
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
            </Block>
          ) : null}

          {morning.habits.length > 0 ? (
            <Block label={DAY.habitsLabel}>
              <CheckList checks={morning.habits} />
            </Block>
          ) : null}
        </>
      )}
    </section>
  );
}

/* --------------------------------- 23:00 ---------------------------------- */

function EveningCard({ evening }: { evening: LifeDayEvening }) {
  const written = evening.generatedAt !== null;

  return (
    <section className="border-t border-border pt-8">
      <Eyebrow>
        <span aria-hidden>🌙 </span>
        {DAY.summaryTitle}
      </Eyebrow>

      {/* Before the 23:00 pass: the frame, and when it gets filled. Not a
          prompt, not a nudge, not a count of what is missing (N3). */}
      {!written ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {DAY.summaryPending}
        </p>
      ) : (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {DAY.summaryLabel}
          </p>
          {evening.summary.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {evening.summary.map((line, i) => (
                <li
                  key={i}
                  className="text-[15px] leading-relaxed text-foreground/90"
                >
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* The user's half. Answerable whenever they get to it, not only after
          the summary lands. */}
      <EveningReview evening={evening} />
    </section>
  );
}

function EveningReview({ evening }: { evening: LifeDayEvening }) {
  const [habitsRan, setHabitsRan] = useState(evening.habitsRan);
  const [oneThingDone, setOneThingDone] = useState(evening.oneThingDone);
  const [distraction, setDistraction] = useState(evening.distraction);
  const [answer, setAnswer] = useState(evening.answer);
  const [savedDistraction, setSavedDistraction] = useState(evening.distraction);
  const [savedAnswer, setSavedAnswer] = useState(evening.answer);

  async function toggle(
    field: "habitsRan" | "oneThingDone",
    next: boolean,
    apply: (v: boolean) => void
  ) {
    apply(next);
    try {
      await saveDayEvening({ [field]: next });
    } catch {
      // Put the box back. A tick that did not save must not look like one
      // that did.
      apply(!next);
    }
  }

  async function commitText(
    field: "distraction" | "answer",
    value: string,
    saved: string,
    setSaved: (v: string) => void,
    reset: (v: string) => void
  ) {
    const next = value.trim();
    if (next === saved) return;
    setSaved(next);
    try {
      await saveDayEvening({ [field]: next });
    } catch {
      setSaved(saved);
      reset(saved);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-background p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {DAY.reviewLabel}
      </p>

      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2.5 text-[15px] text-foreground">
          <input
            type="checkbox"
            checked={habitsRan}
            onChange={(e) =>
              void toggle("habitsRan", e.target.checked, setHabitsRan)
            }
            className="h-4 w-4 accent-foreground"
          />
          {DAY.habitsRanLabel}
        </label>
        <label className="flex items-center gap-2.5 text-[15px] text-foreground">
          <input
            type="checkbox"
            checked={oneThingDone}
            onChange={(e) =>
              void toggle("oneThingDone", e.target.checked, setOneThingDone)
            }
            className="h-4 w-4 accent-foreground"
          />
          {DAY.oneThingDoneLabel}
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {DAY.eveningDistractionLabel}
        </span>
        <textarea
          value={distraction}
          rows={2}
          onChange={(e) => setDistraction(e.target.value)}
          onBlur={() =>
            void commitText(
              "distraction",
              distraction,
              savedDistraction,
              setSavedDistraction,
              setDistraction
            )
          }
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-foreground/30"
        />
      </label>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-[15px] italic leading-relaxed text-foreground/80">
          {evening.question || DAY.questionFallback}
        </p>
        <label className="mt-2 block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {DAY.answerLabel}
          </span>
          {/* N6 / L-1 — NO placeholder here, and no suggest button. A
              placeholder on this field would be the system drafting the
              reflection, one greyed sentence at a time. */}
          <textarea
            value={answer}
            rows={3}
            onChange={(e) => setAnswer(e.target.value)}
            onBlur={() =>
              void commitText("answer", answer, savedAnswer, setSavedAnswer, setAnswer)
            }
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[15px] leading-[1.7] outline-none focus:border-foreground/30"
          />
        </label>
      </div>
    </div>
  );
}

/* -------------------------------- shared ---------------------------------- */

/** The bet a piece of the day serves, named with its rank.
 *
 *  The rank is the whole point: Bet 3 never outranks Bet 2 in a daily plan
 *  (spec §3.2), and the only way to see that being honoured is to say which
 *  bet, and which number, on the card itself. Renders nothing when the payload
 *  carries no bet, rather than guessing one. */
function BetTag({
  betKey,
  className = "",
}: {
  betKey: LifeBetKey | null;
  className?: string;
}) {
  const meta = betByKey(betKey);
  if (!meta) return null;
  return (
    <span
      className={`block text-xs text-muted-foreground ${className}`}
    >
      <span aria-hidden>{meta.glyph} </span>
      {meta.rank}. {meta.label}
    </span>
  );
}

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2">{children}</div>
    </div>
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

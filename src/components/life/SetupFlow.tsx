"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, GripVertical, Plus, Target, X } from "lucide-react";
import { SETUP, STATUS } from "@/lib/life/copy";
import { LIFE_BETS } from "@/lib/life/types";
import {
  coerceSetupAnswers,
  LIFE_SETUP_STEPS,
  pruneAnswers,
  stepIndex,
  type LifeSetupAnswers,
  type LifeSetupGoal,
} from "@/lib/life/setupSteps";
import {
  applyConfirmedItems,
  completeSetup,
  fetchSetup,
  fetchSetupDocuments,
  proposeFromDocument,
  putSetup,
  uploadSetupDocument,
  type LifeDraftItem,
  type LifeSetupDocument,
} from "@/services/api/life";
import { invalidateLifeState } from "@/lib/life/useLifeState";
import { Eyebrow, ErrorLine, LoadingLine, PanelCard } from "./primitives";
import { useDragReorder } from "./useDragReorder";
import { StepHead, WizardChip, WizardProgress } from "@/components/ui/wizard";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import { duePresets } from "@/lib/life/duePresets";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  FE-3 — setup. Once, but editable forever.                                  */
/*                                                                            */
/*  SAVE-AND-RESUME IS LOAD-BEARING, not a nicety, and it got MORE load-       */
/*  bearing on 2026-07-26. A `#` typed before this form is finished now falls  */
/*  through as ordinary chat and stores nothing at all (BE, superseding §6.2:  */
/*  a half-working tag teaches that it costs something louder than a redirect  */
/*  does, because it answers, looks like it understood, and produces nothing). */
/*  So an interruption partway through eight horizons is the ONLY thing        */
/*  standing between a user and the feature, and resume is the only door back. */
/*  Every step writes (PUT /v2/life/setup), and the step the user stopped on   */
/*  comes back from `/state.setup.resume_step`.                                */
/*                                                                            */
/*  Consequence worth holding while reading this file: this form is the only   */
/*  entrance to the feature, so its completion rate IS the feature's adoption  */
/*  rate. Nothing here is allowed to be clever at the cost of being finishable.*/
/*                                                                            */
/*  On completion the backend generates the document set. There is no replay   */
/*  step, because nothing was held back to replay.                             */
/* -------------------------------------------------------------------------- */

export default function SetupFlow({
  resumeStep,
  onComplete,
}: {
  resumeStep: string | null;
  onComplete: () => void;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<LifeSetupAnswers | null>(null);
  const [index, setIndex] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(false);
  const resumedRef = useRef(false);

  // Item 9 (founder 2026-07-30) — the optional strategy upload and what was
  // drafted from it. Both live HERE rather than in their steps because the
  // draft is reviewed on the last screen and applied on Finish: a step-local
  // state would be lost the moment the user pressed Next.
  const [docs, setDocs] = useState<LifeSetupDocument[]>([]);
  const [draft, setDraft] = useState<LifeDraftItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSetup()
      .then((draft) => {
        if (cancelled) return;
        setAnswers(coerceSetupAnswers(draft.answers));
        if (!resumedRef.current) {
          resumedRef.current = true;
          setIndex(stepIndex(draft.step ?? resumeStep));
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    // A previously uploaded document survives an interruption exactly like
    // the answers do; failure here degrades to "no document yet", never an
    // error screen — the upload is optional.
    void fetchSetupDocuments()
      .then((list) => {
        if (!cancelled) setDocs(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resumeStep]);

  const save = useCallback(
    async (stepKey: string, next: LifeSetupAnswers) => {
      setSaveState("saving");
      try {
        await putSetup(stepKey, pruneAnswers(next) as unknown as Record<string, unknown>);
        setSaveState("saved");
      } catch {
        // A failed save is not fatal mid-form: the answers are still in state
        // and the next step's write retries the whole draft.
        setSaveState("idle");
      }
    },
    []
  );

  if (loadFailed) return <ErrorLine />;
  if (!answers) return <LoadingLine />;

  if (done) return <SetupComplete onDone={onComplete} />;

  const step = LIFE_SETUP_STEPS[index];
  const isLast = index === LIFE_SETUP_STEPS.length - 1;

  async function goNext() {
    await save(step.key, answers!);
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    setFinishing(true);
    try {
      // The ticked draft rows land FIRST, then the documents are written, so
      // a failure here stops the finish visibly instead of completing setup
      // with half the review applied. Only checked rows are ever sent (N5):
      // the tick is the approve, an unticked row is simply never created.
      if (draft && draft.some((d) => d.checked)) {
        await applyConfirmedItems(draft);
      }
      await completeSetup();
      invalidateLifeState();
      setDone(true);
    } catch {
      setFinishing(false);
      setSaveState("idle");
    }
  }

  const status = finishing
    ? SETUP.workingLabel
    : saveState === "saving"
      ? STATUS.saving
      : saveState === "saved"
        ? SETUP.savedNote
        : "";

  // Founder 2026-07-27 — this flow now wears the recording onboarding's chrome:
  // the dot row with Back, the eyebrow + question + helper head, and one
  // full-width rounded CTA. Same components, so the two onboardings cannot
  // drift apart again.
  return (
    // Founder 2026-07-30 — fills its column so the bottom bar is AT the
    // bottom, the way the recording onboarding's is. It used to be
    // `min-h-[60vh]`, which put Next directly under the last card with the
    // rest of the screen empty below it: the button moved up and down as the
    // steps changed length, and on the short steps it sat mid-screen.
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      {/* Founder 2026-07-30 — Back moved to the BOTTOM bar next to Next,
          never the top. The dot row keeps its fixed side slots (showBack
          only empties the leading one), so the dots stay centred and the
          recording flow, which keeps its top Back, is untouched. */}
      <WizardProgress
        count={LIFE_SETUP_STEPS.length}
        current={index}
        showBack={false}
        trailing={
          // Founder 2026-07-30 — the way out, top-right, as the voice-game
          // has. This screen took the app header off, which took the
          // hamburger with it, so until now a user part-way through ten
          // steps had no exit at all. /chat is where the consent screen's
          // "Not now" already goes, so leaving lands in the same place
          // whichever door you use. Nothing is discarded: every step has
          // already been written, and the resume step brings you back here.
          <OverlayCloseButton
            onClick={() => router.push("/chat")}
            ariaLabel="Close setup"
          />
        }
      />

      <div className="flex-1">
        {/* Founder 2026-07-30 — "STEP n OF 10" is DELETED. It had been kept as
            the one thing telling a user how much was left, but the dot row is
            directly above it doing exactly that, in the same glance and
            without words: ten dots, the current one long. The counter was the
            sentence version of the picture, and the recording onboarding has
            never had one.
            FE-10 — the grey "Eight horizons…" paragraph is gone: it rendered on
            screen 1 only, which is exactly what made screen 1 the odd one out.
            With it gone all the steps render through this one path. */}
        {/* Founder 2026-07-27 — no grey supporting line under the question.
            The step's `hint` is deliberately NOT passed: one goal per screen
            means one heading and the thing you fill in, and a paragraph of
            grey between them is what made this read as a form rather than a
            question. (FE-10 removed the same kind of line from screen 1; this
            finishes it on all of them.) */}
        {/* Founder 2026-07-30 — the question wears the voice-game head, and
            the target is this flow's mark: every step of it is the user
            setting their strategy, so the mark is the flow's, not the step's.
            No eyebrow: the dots above are the position indicator now. */}
        <StepHead icon={Target} question={step.title} />

        {step.kind === "bets" ? (
          <BetsStep answers={answers} onChange={(next) => setAnswers(next)} />
        ) : step.kind === "document" ? (
          <DocumentStep
            docs={docs}
            onUploaded={(doc) => setDocs((prev) => [doc, ...prev])}
          />
        ) : (
          <>
            <GoalsStep
              stepKey={step.key}
              duePlaceholder={step.duePlaceholder ?? ""}
              answers={answers}
              onChange={(next) => setAnswers(next)}
            />
            {/* The draft review lives on the LAST step, right above Finish —
                the step definitions have no separate review screen, and the
                honest place to show "these rows get created" is next to the
                button that creates them (N5: nothing lands without display). */}
            {isLast && docs.some((d) => d.status === "processed") ? (
              <DraftSection
                draft={draft}
                onDraft={setDraft}
                disabled={finishing}
              />
            ) : null}
          </>
        )}
      </div>

      {/* `mt-auto` is what pins this to the bottom of the column — the same
          bar the recording onboarding draws, in the same place. */}
      <div className="mt-auto pt-8">
        {status ? (
          <p className="mb-2 text-center text-xs text-muted-foreground">
            {status}
          </p>
        ) : null}
        {/* Founder 2026-07-30 — [Back, compact] [Next/Finish, full] side by
            side at the bottom. Back is hidden on step 0 rather than
            disabled: a dead button on the first screen is a question. */}
        <div className="flex items-center gap-3">
          {index > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={finishing}
              className="w-24 shrink-0 rounded-full"
            >
              {SETUP.backLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => void goNext()}
            disabled={finishing}
            className="flex-1 rounded-full"
          >
            {isLast ? SETUP.completeLabel : SETUP.nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- steps ---------------------------------- */

/** Item 9 (founder 2026-07-30) — the optional strategy upload.
 *
 *  OPTIONAL IS THE DESIGN: pressing Next with nothing here is a complete
 *  answer, the copy says so, and nothing later refers back to this screen
 *  with a should-have. Only the EXTRACTED TEXT is stored, never the file;
 *  an unreadable file is kept as `extraction_failed` and said plainly, so
 *  the user knows drafting has nothing to read rather than wondering. */
function DocumentStep({
  docs,
  onUploaded,
}: {
  docs: LifeSetupDocument[];
  onUploaded: (doc: LifeSetupDocument) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    setFailed(false);
    try {
      onUploaded(await uploadSetupDocument(file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {SETUP.documentHint}
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !busy) void onFile(file);
        }}
        className={`rounded-2xl border border-dashed px-4 py-8 text-center transition ${
          dragOver ? "border-foreground/40 bg-muted/40" : "border-border"
        }`}
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="mx-auto flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40"
        >
          <FileText className="h-4 w-4" />
          {busy ? SETUP.documentUploading : SETUP.documentBrowseLabel}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          {SETUP.documentDropNote}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFile(file);
          }}
        />
      </div>

      {failed ? (
        <p className="text-sm text-muted-foreground">
          {SETUP.documentUploadError}
        </p>
      ) : null}

      {docs.map((doc) => (
        <PanelCard key={doc.id}>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {doc.fileName}
              </p>
              {doc.status === "processed" ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {doc.charCount.toLocaleString("en-GB")}{" "}
                  {SETUP.documentCharsSuffix}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {SETUP.documentFailedNote}
                </p>
              )}
            </div>
          </div>
        </PanelCard>
      ))}
    </div>
  );
}

/** The draft-from-document review, on the last step above Finish.
 *
 *  NEVER AUTOMATIC (founder 2026-07-30): the button asks, every returned row
 *  renders as a checkable line the user can edit or untick, and Finish sends
 *  ONLY the ticked rows. Default-checked is allowed precisely because every
 *  row is fully displayed here first — the default never bypasses the
 *  display (N5). */
function DraftSection({
  draft,
  onDraft,
  disabled,
}: {
  draft: LifeDraftItem[] | null;
  onDraft: (items: LifeDraftItem[] | null) => void;
  disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run() {
    setLoading(true);
    setFailed(false);
    try {
      onDraft(await proposeFromDocument());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (draft === null) {
    return (
      <div className="mt-8 border-t border-border pt-6 text-center">
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || disabled}
          className="mx-auto rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40"
        >
          {loading ? SETUP.draftWorking : SETUP.draftButton}
        </button>
        <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
          {SETUP.draftHint}
        </p>
        {failed ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {SETUP.draftFailed}
          </p>
        ) : null}
      </div>
    );
  }

  const kinds: Array<LifeDraftItem["kind"]> = [
    "bet",
    "goal",
    "habit",
    "distraction",
  ];

  function update(item: LifeDraftItem, patch: Partial<LifeDraftItem>) {
    onDraft(
      (draft ?? []).map((d) => (d === item ? { ...d, ...patch } : d))
    );
  }

  return (
    <div className="mt-8 border-t border-border pt-6">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {SETUP.draftReviewTitle}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {SETUP.draftReviewNote}
      </p>

      {draft.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {SETUP.draftEmpty}
        </p>
      ) : (
        kinds.map((kind) => {
          const rows = draft.filter((d) => d.kind === kind);
          if (rows.length === 0) return null;
          return (
            <div key={kind} className="mt-4">
              <p className="text-xs font-medium text-foreground">
                {SETUP.draftKindLabels[kind]}
              </p>
              <ul className="mt-2 space-y-2">
                {rows.map((item, i) => (
                  <li
                    key={`${kind}-${item.externalId ?? i}`}
                    className="flex items-center gap-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={disabled}
                      onChange={(e) =>
                        update(item, { checked: e.target.checked })
                      }
                      className="h-4 w-4 shrink-0 accent-foreground"
                      aria-label={`Create ${item.title}`}
                    />
                    <input
                      value={item.title}
                      disabled={disabled}
                      onChange={(e) => update(item, { title: e.target.value })}
                      className={`min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/30 ${
                        item.checked ? "" : "text-muted-foreground"
                      }`}
                    />
                    {item.dueLabel ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.dueLabel}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}

export function BetsStep({
  answers,
  onChange,
}: {
  answers: LifeSetupAnswers;
  onChange: (next: LifeSetupAnswers) => void;
}) {
  // `useCallback` because the drag engine holds this in an effect for the life
  // of a drag — a new function every render would tear the listeners down and
  // put them back mid-gesture.
  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= answers.bets.length) return;
      const bets = [...answers.bets];
      const [moved] = bets.splice(from, 1);
      bets.splice(to, 0, moved);
      // Rank is re-derived from position, never carried: it is load-bearing
      // downstream (bet 3 never outranks bet 2 in a daily plan), so the list
      // order and the stored rank cannot be allowed to disagree.
      onChange({ ...answers, bets: bets.map((b, i) => ({ ...b, rank: i + 1 })) });
    },
    [answers, onChange]
  );

  const dnd = useDragReorder(answers.bets.length, move);

  return (
    // Founder 2026-07-27 — the up/down arrows are replaced by press-hold-move.
    // `select-none` on the list is what keeps a hold on a phone from raising
    // the OS text-selection callout over the row being dragged; the textarea
    // opts back in, because selecting the text you typed still has to work.
    <ol className="select-none space-y-3">
      {answers.bets.map((bet, i) => {
        const meta = LIFE_BETS.find((b) => b.key === bet.key);
        const label = meta?.label ?? bet.key;
        const dragging = dnd.draggingIndex === i;
        return (
          <li key={bet.key} {...dnd.rowProps(i)}>
            <PanelCard className={dragging ? "border-foreground/25 bg-card" : undefined}>
              <div className="flex items-start gap-3">
                <span className="text-lg leading-none" aria-hidden>
                  {meta?.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {dnd.projectedIndex(i) + 1}. {label}
                  </p>
                  <textarea
                    value={bet.meaning}
                    onChange={(e) => {
                      const bets = [...answers.bets];
                      bets[i] = { ...bet, meaning: e.target.value };
                      onChange({ ...answers, bets });
                    }}
                    rows={2}
                    placeholder="What this one covers, in your words"
                    /* `scrollbar-none` + `overflow-x-hidden`: same as the chat
                       composer — a bar inside a small bordered field reads as a
                       broken control, and a textarea soft-wraps, so it has no
                       business scrolling sideways at all. */
                    className="scrollbar-none mt-2 w-full select-text resize-none overflow-x-hidden rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
                  />
                </div>
                {/* The grip. It is a real button so it takes focus and Up/Down
                    still reorder from a keyboard — the arrows left the screen,
                    not the product. */}
                <button
                  type="button"
                  data-drag-handle
                  aria-label={`Reorder ${label}. Position ${i + 1} of ${
                    answers.bets.length
                  }. Hold and move, or use the up and down arrow keys.`}
                  className={`-mr-1 shrink-0 cursor-grab rounded-lg p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
                    dragging ? "cursor-grabbing text-foreground" : ""
                  }`}
                  {...dnd.handleProps(i)}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </div>
            </PanelCard>
          </li>
        );
      })}
    </ol>
  );
}

/** Row ids only have to be unique within one draft, and stable across renders
 *  so React does not remount an input the user is typing into. A counter is
 *  enough; these are never persisted as identity. */
let goalIdSeq = 0;
function nextGoalId(stepKey: string): string {
  goalIdSeq += 1;
  return `${stepKey}-${goalIdSeq}`;
}

function GoalsStep({
  stepKey,
  duePlaceholder,
  answers,
  onChange,
}: {
  stepKey: string;
  duePlaceholder: string;
  answers: LifeSetupAnswers;
  onChange: (next: LifeSetupAnswers) => void;
}) {
  const goals = answers.horizons[stepKey] ?? [];
  // Computed once per render from today's date — "[Aug]" has to mean the month
  // the user is actually in, not one baked in at build time.
  const presets = duePresets(stepKey, new Date());

  function write(next: LifeSetupGoal[]) {
    onChange({
      ...answers,
      horizons: { ...answers.horizons, [stepKey]: next },
    });
  }

  function update(i: number, patch: Partial<LifeSetupGoal>) {
    const next = [...goals];
    next[i] = { ...next[i], ...patch };
    write(next);
  }

  return (
    <div className="space-y-3">
      {goals.map((goal, i) => (
        <PanelCard key={goal.id}>
          <div className="flex items-start justify-between gap-3">
            <input
              value={goal.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="The goal, in one line"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
            />
            <button
              type="button"
              aria-label="Remove this goal"
              onClick={() => write(goals.filter((_, j) => j !== i))}
              className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Due, as you write it">
              <input
                value={goal.dueLabel}
                onChange={(e) => update(i, { dueLabel: e.target.value })}
                placeholder={duePlaceholder}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
              />
              {/* Chips, not a date picker (spec §3.2): the label is the source
                  of truth, and a picker would normalise "[Jul '27]" into a
                  concrete day nobody chose. Tapping writes the label VERBATIM
                  and the field stays typeable, so the common answers cost one
                  tap and every other answer still fits. Same affordance as the
                  recording flow's length presets. */}
              {presets.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {presets.map((preset) => (
                    <WizardChip
                      key={preset}
                      size="sm"
                      active={goal.dueLabel === preset}
                      onClick={() =>
                        update(i, {
                          // Tapping the active chip clears it — otherwise a
                          // mis-tap can only be undone by selecting the text.
                          dueLabel: goal.dueLabel === preset ? "" : preset,
                        })
                      }
                    >
                      {preset}
                    </WizardChip>
                  ))}
                </div>
              ) : null}
            </Field>
            <Field label="How much">
              <input
                value={goal.quantity}
                onChange={(e) => update(i, { quantity: e.target.value })}
                placeholder="3 talks, 10kg, one draft"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
              />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="How you will know it happened">
              <input
                value={goal.measure}
                onChange={(e) => update(i, { measure: e.target.value })}
                placeholder="What you would point at"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
              />
            </Field>
            <Field label="Which bet it serves">
              <select
                value={goal.betKey ?? ""}
                onChange={(e) =>
                  update(i, {
                    betKey: (e.target.value || null) as LifeSetupGoal["betKey"],
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
              >
                <option value="">Pick one</option>
                {answers.bets.map((b) => {
                  const meta = LIFE_BETS.find((x) => x.key === b.key);
                  return (
                    <option key={b.key} value={b.key}>
                      {meta?.glyph} {meta?.label}
                    </option>
                  );
                })}
              </select>
            </Field>
          </div>
        </PanelCard>
      ))}

      <button
        type="button"
        onClick={() =>
          write([
            ...goals,
            {
              id: nextGoalId(stepKey),
              title: "",
              dueLabel: "",
              quantity: "",
              measure: "",
              betKey: null,
            },
          ])
        }
        // Centred, like every other CTA in the flow — a left-aligned button
        // under centred content reads as a stray element rather than the next
        // thing to do.
        className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" />
        Add a goal
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ------------------------------- completion ------------------------------- */

/** No replay section (BE, 2026-07-26, superseding §6.2): a `#` typed before
 *  onboarding finished stored nothing, so there is nothing waiting to show. */
function SetupComplete({ onDone }: { onDone: () => void }) {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {SETUP.doneTitle}
      </h1>
      <button
        type="button"
        onClick={onDone}
        className="mt-8 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
      >
        {SETUP.doneLabel}
      </button>
    </div>
  );
}

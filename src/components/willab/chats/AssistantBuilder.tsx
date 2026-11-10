"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useBackDismiss } from "../useBackDismiss";
import { getBuilder, saveRecipe, type AnswerWith, type Builder, type Recipe, type RecipeQuestion } from "@/services/api/assistants";
import { BUILDER_COPY as C } from "./assistantCopy";

/* -------------------------------------------------------------------------- */
/*  The builder of a host's own chat, the MVP (backend N579 item 1): the      */
/*  welcome people read first, the first Take's questions (starting from      */
/*  Artur's five, to keep, change, add or remove) and how people answer (tap  */
/*  answers, type, record). The name is "{name}'s assistant" (N578 item 1).   */
/*  What it does not set (the welcome's lines about the host, who their chat  */
/*  is for, the model) is kept as it was: the setup in Will's chat sets them. */
/*  The backend checks a host's words as it checks Will's (N578 item 6) and  */
/*  says why it refuses; that sentence is shown as it comes. Behind the ring */
/*  row `chat_builder`: without it the read is 404 and the sheet closes.     */
/* -------------------------------------------------------------------------- */

const MAX_WELCOME_LINES = 4;
const MAX_QUESTIONS = 8;

/** The recipe the builder starts from: the one kept, or the welcome empty,
 *  Artur's five and every way to answer. */
export function draftOf(builder: Builder): Recipe {
  return (
    builder.recipe ?? {
      welcome: [],
      questions: builder.startingQuestions,
      answer_with: { tap: true, type: true, record: true },
      about: [],
    }
  );
}

/** Empty lines and empty answers are left out before saving. */
export function cleaned(recipe: Recipe): Recipe {
  return {
    ...recipe,
    welcome: recipe.welcome.map((w) => w.trim()).filter(Boolean),
    questions: recipe.questions
      .filter((q) => q.q.trim())
      .map((q) => ({ ...q, q: q.q.trim(), answers: q.answers.map((a) => a.trim()).filter(Boolean) })),
  };
}

const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-[15px] text-foreground";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
      {children}
    </section>
  );
}

function QuestionCard({ question, onChange, onRemove }: { question: RecipeQuestion; onChange: (q: RecipeQuestion) => void; onRemove: () => void }) {
  return (
    <div data-builder-question="" className="flex flex-col gap-2 rounded-xl bg-muted p-3">
      <textarea aria-label={C.questions} rows={2} className={field} value={question.q} onChange={(e) => onChange({ ...question, q: e.target.value })} />
      <textarea
        aria-label={C.answersHint}
        placeholder={C.answersHint}
        rows={2}
        className={field}
        value={question.answers.join("\n")}
        onChange={(e) => onChange({ ...question, answers: e.target.value.split("\n") })}
      />
      <button type="button" onClick={onRemove} className="self-end text-[13px] font-medium text-muted-foreground">
        {C.remove}
      </button>
    </div>
  );
}

function WaysToAnswer({ value, onChange }: { value: AnswerWith; onChange: (w: AnswerWith) => void }) {
  const ways: [keyof AnswerWith, string][] = [["tap", C.tap], ["type", C.type], ["record", C.record]];
  return (
    <div className="flex flex-col gap-1">
      {ways.map(([key, label]) => (
        <label key={key} className="flex min-h-[44px] items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            data-builder-way={key}
            checked={value[key]}
            // At least one way stays on (the backend refuses none).
            disabled={value[key] && Object.values(value).filter(Boolean).length === 1}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function BuilderForm({ builder }: { builder: Builder }) {
  const [draft, setDraft] = useState<Recipe>(() => draftOf(builder));
  const [state, setState] = useState<{ at: "editing" | "saving" | "saved" } | { at: "refused"; why: string }>({ at: "editing" });
  const edit = (next: Recipe) => {
    setDraft(next);
    setState({ at: "editing" });
  };
  const save = async () => {
    setState({ at: "saving" });
    const kept = await saveRecipe(cleaned(draft));
    if (kept.ok) {
      setDraft(kept.recipe);
      setState({ at: "saved" });
    } else {
      setState({ at: "refused", why: kept.error ?? C.notSaved });
    }
  };
  const setQuestion = (i: number, q: RecipeQuestion) => edit({ ...draft, questions: draft.questions.map((old, j) => (j === i ? q : old)) });
  return (
    <>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6 pt-2">
        <Section title={C.welcome} hint={C.welcomeHint}>
          {draft.welcome.map((line, i) => (
            <textarea
              key={i}
              data-builder-welcome={i}
              aria-label={C.welcome}
              rows={2}
              className={field}
              value={line}
              onChange={(e) => edit({ ...draft, welcome: draft.welcome.map((w, j) => (j === i ? e.target.value : w)) })}
            />
          ))}
          {draft.welcome.length < MAX_WELCOME_LINES ? (
            <button type="button" data-builder-add-line="" onClick={() => edit({ ...draft, welcome: [...draft.welcome, ""] })} className="self-start text-[14px] font-semibold text-foreground">
              {C.addLine}
            </button>
          ) : null}
        </Section>
        <Section title={C.questions} hint={C.questionsHint}>
          {draft.questions.map((q, i) => (
            <QuestionCard key={i} question={q} onChange={(next) => setQuestion(i, next)} onRemove={() => edit({ ...draft, questions: draft.questions.filter((_, j) => j !== i) })} />
          ))}
          {draft.questions.length < MAX_QUESTIONS ? (
            <button type="button" data-builder-add-question="" onClick={() => edit({ ...draft, questions: [...draft.questions, { q: "", answers: [] }] })} className="self-start text-[14px] font-semibold text-foreground">
              {C.addQuestion}
            </button>
          ) : null}
        </Section>
        <Section title={C.answerWith}>
          <WaysToAnswer value={draft.answer_with} onChange={(answer_with) => edit({ ...draft, answer_with })} />
        </Section>
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-border p-3">
        {state.at === "refused" ? (
          <p role="alert" data-builder-refused="" className="text-[13.5px] text-[#B42318]">
            {state.why}
          </p>
        ) : null}
        <button
          type="button"
          data-builder-save=""
          disabled={state.at === "saving"}
          onClick={() => void save()}
          className="h-12 w-full rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-60"
        >
          {state.at === "saved" ? C.saved : C.save}
        </button>
      </div>
    </>
  );
}

/** The builder over the whole screen; Back or ✕ closes it. Draws nothing
 *  (and closes) when the read says there is no builder for this person. */
export default function AssistantBuilder({ onClose }: { onClose: () => void }) {
  useBackDismiss(onClose);
  const [builder, setBuilder] = useState<Builder | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void getBuilder().then((got) => {
      if (!alive) return;
      setBuilder(got);
      if (!got) onClose();
    });
    return () => {
      alive = false;
    };
  }, [onClose]);
  if (!builder) return null;
  return (
    <div data-assistant-builder="" className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center gap-2 px-2">
        <button type="button" aria-label="Close" onClick={onClose} className="flex h-11 w-11 items-center justify-center text-foreground">
          <X className="h-5 w-5" aria-hidden />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-foreground">{builder.assistant}</h2>
      </div>
      <BuilderForm builder={builder} />
    </div>
  );
}

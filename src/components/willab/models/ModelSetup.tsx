"use client";

import { useEffect, useRef, useState } from "react";
import WalkFooter from "../walk/WalkFooter";
import {
  answerFirstTen,
  beginSetup,
  getFirstTen,
  getSetup,
  saveSetupStep,
  startNow,
  uploadData,
  uploadStudy,
  type SetupRefusal,
  type SetupState,
  type SetupStep,
} from "@/services/api/modelSetup";
import { getModelCode } from "@/services/api/models";
import { getMyChatLink } from "@/services/api/chats";
import { TeachStep } from "./ModelTeach";
import {
  AiStep,
  CheckStep,
  ColumnsStep,
  DataStep,
  DescribeStep,
  ExamStep,
  InviteStep,
  JourneyStep,
  KindStep,
  PublicStep,
  QuestionStep,
  ReadyStep,
  RulesStep,
  ScaleStep,
  SetupFrame,
  ShareStep,
  type Answer,
  type StepProps,
} from "./SetupSteps";
import { Muted, Said } from "./SetupParts";

/* -------------------------------------------------------------------------- */
/*  Starting a model (backend N528 item 4, N566 items 2 to 6, N570, N571,     */
/*  N582, N585; App Model MOD-24 to MOD-38, MOD-54, MOD-55; the locked        */
/*  prototype's s:1 to s:17 and the test drive's setup-20 and setup-21).      */
/*                                                                            */
/*  "Start your own" begins a draft (after a first Take, Describe opens       */
/*  filled from its answers, MOD-54); "Continue" opens it where it stopped    */
/*  (MOD-25); a checklist item opens its own step (openSetup). Each answer is saved as it  */
/*  is given, so ✕ keeps the draft and goes back to the list, which shows it  */
/*  with "Continue". The backend says which step comes next and draws every  */
/*  word; a refused answer shows the backend's reason under it.             */
/*                                                                            */
/*  The owner's first 10 (MOD-55) are answered on the teachers' own screen,   */
/*  without the model's guess (Never 2). "Try it" shows only once the         */
/*  model's code route answers (ModelApiScreens).                            */
/* -------------------------------------------------------------------------- */

const isRefusal = (got: SetupState | SetupRefusal | null): got is SetupRefusal => Boolean(got && "refused" in got);

function useSetup(first: SetupState) {
  const [state, setState] = useState<SetupState>(first);
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trail = useRef<SetupStep[]>([]);
  /** Shows what the backend answered: the next step, or the reason it refused. */
  const land = (got: SetupState | SetupRefusal | null, from: SetupStep | null) => {
    setBusy(false);
    if (isRefusal(got)) return setRefused(got.refused);
    if (!got) return;
    setRefused(null);
    if (from && from !== got.screen.step && from !== "public") trail.current.push(from);
    setState(got);
  };
  const run = (work: () => Promise<SetupState | SetupRefusal | null>, from: SetupStep | null) => {
    if (busy) return;
    setBusy(true);
    void work().then((got) => land(got, from), () => land(null, from));
  };
  const id = state.model_id;
  const step = state.screen.step;
  return {
    state,
    refused,
    busy,
    send: (answer: Answer) => run(() => saveSetupStep(id, step as Exclude<SetupStep, "ready">, answer), step),
    open: (to: SetupStep) => run(() => getSetup(id, to), step),
    startNow: (scale: { t: string; d: string }[]) => run(() => startNow(id, scale), step),
    study: (file: File) => run(() => uploadStudy(id, file), null),
    data: (file: File) => run(() => uploadData(id, file), step),
    firstTen: () => run(() => getFirstTen(id), null),
    answerFirst: (exampleId: string, s: "rate" | "pick" | "words", answer: string | null) =>
      run(() => answerFirstTen(id, exampleId, s, answer), null),
    /** ‹: the step before, read again as it was saved; null on the first. */
    back: trail.current.length
      ? () => {
          const to = trail.current.pop()!;
          run(() => getSetup(id, to), null);
        }
      : null,
  };
}

/** "Try it", once the model's code route answers (MOD-45; ModelApiScreens). */
function useTry(modelId: string | null, live: boolean): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => {
    if (!modelId || !live) return;
    let alive = true;
    void getModelCode(modelId).then((code) => {
      if (alive) setCan(Boolean(code));
    });
    return () => {
      alive = false;
    };
  }, [modelId, live]);
  return can;
}

function FirstTen(p: StepProps & { onStart: () => void; onAnswer: (exampleId: string, step: "rate" | "pick" | "words", answer: string | null) => void }) {
  const { screen } = p;
  const teaching = screen.teaching;
  if (teaching) {
    const exampleId = String(teaching.example?.id ?? "");
    return (
      <TeachStep
        screen={teaching}
        caption={screen.caption}
        content={teaching.example?.content}
        note={null}
        chosen={null}
        onPick={(a) => p.onAnswer(exampleId, teaching.step, a)}
        onSkip={() => p.onAnswer(exampleId, teaching.step, null)}
        onBack={p.onBack ?? p.onClose}
        onClose={p.onClose}
      />
    );
  }
  // Start, then "Do it later"; with nothing to answer yet, "Do it later"
  // alone; once all 10 are answered, Next.
  const [first, second] = screen.actions;
  const starts = second !== undefined;
  const footer = (
    <WalkFooter
      pill={{ label: first, onClick: starts ? p.onStart : () => p.send({}), disabled: p.busy }}
      links={starts ? [{ label: second, onClick: () => p.send({}), disabled: p.busy }] : []}
    />
  );
  return (
    <SetupFrame {...p} footer={footer}>
      {screen.lines.map((line) => (
        <Said key={line}>{line}</Said>
      ))}
      {screen.notes.map((n) => (
        <Muted key={n}>{n}</Muted>
      ))}
    </SetupFrame>
  );
}

/** The way in: "Start your own" begins a draft, "Continue" reads one where
 *  it stopped, a checklist item reads its step. Null when the setup's routes
 *  answer 404 (below the ring, or before the backend has them): the caller
 *  then hides that way in. */
export function openSetup(modelId: string | null, step: SetupStep | null = null): Promise<SetupState | null> {
  return modelId ? getSetup(modelId, step) : beginSetup();
}

export default function ModelSetup({ first, onBack, onClose, onList, onTeachOther, onTry }: {
  first: SetupState;
  /** ‹ on the setup's first screen: out of it. */
  onBack?: () => void;
  /** ✕: the draft is kept; back to the list (MOD-25). */
  onClose: () => void;
  /** "Back to the list". */
  onList: () => void;
  /** "Teach this one", from the sheet "A model like yours already exists". */
  onTeachOther: (modelId: string) => void;
  onTry: (modelId: string) => void;
}) {
  const s = useSetup(first);
  const canTry = useTry(s.state.model_id, s.state.status !== "draft");
  const { screen, model_id: id } = s.state;
  const p: StepProps = {
    screen,
    busy: s.busy,
    refused: s.refused,
    send: s.send,
    open: s.open,
    onBack: s.back ?? onBack,
    onClose,
  };
  // A fresh key per screen, so each step starts from what the backend
  // drew rather than from the step before's edits.
  const key = `${screen.step}|${s.state.status}|${JSON.stringify(screen.fields)}|${screen.caption}`;
  switch (screen.step) {
    case "problem":
    case "today":
    case "teach":
      return <DescribeStep key={key} {...p} onTeachOther={onTeachOther} />;
    case "kind":
      return <KindStep key={key} {...p} />;
    case "scale":
      return <ScaleStep key={key} {...p} onStartNow={s.startNow} />;
    case "question":
      return <QuestionStep key={key} {...p} />;
    case "ai":
      return <AiStep key={key} {...p} />;
    case "rules":
      return <RulesStep key={key} {...p} onStudy={s.study} />;
    case "data":
      return <DataStep key={key} {...p} onData={s.data} />;
    case "columns":
      return <ColumnsStep key={key} {...p} />;
    case "check":
      return <CheckStep key={key} {...p} />;
    case "exam":
      return <ExamStep key={key} {...p} />;
    case "journey":
      return <JourneyStep key={key} {...p} />;
    case "first10":
      return <FirstTen key={key} {...p} onStart={s.firstTen} onAnswer={s.answerFirst} />;
    case "share":
      return <ShareStep key={key} {...p} />;
    case "public":
      return <PublicStep key={key} {...p} />;
    case "invite":
      return (
        <InviteStep
          key={key}
          {...p}
          onCopyLink={() => {
            // The owner's own chat link (backend N598): no separate teacher link.
            const own = screen.chat_link ? Promise.resolve(screen.chat_link) : getMyChatLink();
            void own.then((path) => {
              if (path) void navigator.clipboard?.writeText(`${window.location.origin}${path}`).catch(() => undefined);
            });
          }}
        />
      );
    default:
      return <ReadyStep key={key} {...p} onTry={canTry ? () => onTry(id) : null} onList={onList} />;
  }
}

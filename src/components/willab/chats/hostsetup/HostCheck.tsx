"use client";

import { useEffect, useRef, useState } from "react";
import { ExampleCase } from "../../models/ModelBits";
import { answerCheck, getCheck, type ModelCheck } from "@/services/api/hostSetup";
import { W } from "./hostSetupCopy";
import { Btn, Cap, Card, Frame, Opt, Say, Two } from "./SetupBits";

/* -------------------------------------------------------------------------- */
/*  "Check its guesses" inside the blank setup (FIRST-08's check, LEARN-03;   */
/*  backend N616 item 23; the locked prototype's step "check"): ten examples */
/*  the model was not fitted on, one per screen, its guess first; Keep, or    */
/*  Change and the right one of the other answers. Only when the model has   */
/*  something to check (GET .../check has items); else straight on. No count, */
/*  no mark, no "passed": only the prototype's words.                        */
/* -------------------------------------------------------------------------- */

export default function HostCheck({ modelId, question, onBack, onDone, onNothing = onDone }: {
  modelId: string;
  /** The model's question, as its card in the setup shows it. */
  question: string;
  /** ‹ on the first example: the step before. */
  onBack: () => void;
  /** Every example checked, or nothing to check: on to "Add another model?". */
  onDone: () => void;
  /** Nothing to check (no head yet, or checked before): on, the way the host was going. */
  onNothing?: () => void;
}) {
  const [check, setCheck] = useState<ModelCheck | null>(null);
  const [at, setAt] = useState(0);
  const [fixing, setFixing] = useState(false);
  const [busy, setBusy] = useState(false);
  const nothingRef = useRef(onNothing);
  nothingRef.current = onNothing;
  useEffect(() => {
    let alive = true;
    void getCheck(modelId).then((got) => {
      if (!alive) return;
      if (!got || !got.items.length || got.done) return nothingRef.current();
      setCheck(got);
      // Where the owner stopped: the first example not checked yet.
      setAt(Math.max(0, got.items.findIndex((item) => item.kept === null || item.kept === undefined)));
    });
    return () => {
      alive = false;
    };
  }, [modelId]);
  if (!check) return null;
  const item = check.items[at];
  if (!item) return null;
  const send = (answer: string | null) => {
    if (busy) return;
    setBusy(true);
    void answerCheck(modelId, item.example_id, answer).then((got) => {
      setBusy(false);
      if (!got) return;
      setCheck(got);
      setFixing(false);
      if (at + 1 >= got.items.length || got.done) onDone();
      else setAt(at + 1);
    });
  };
  const back = () => {
    if (fixing) return setFixing(false);
    if (at > 0) return setAt(at - 1);
    onBack();
  };
  if (fixing) {
    return (
      <Frame onBack={back}>
        <Say>{W.rightAnswer}</Say>
        {check.answers.filter((a) => a !== item.guess).map((a) => (
          <Opt key={a} title={a} onClick={() => send(a)} />
        ))}
        <Cap>{W.eachFix}</Cap>
      </Frame>
    );
  }
  return (
    <Frame
      onBack={back}
      foot={<Two left={<Btn out label={W.change} onClick={() => setFixing(true)} />} right={<Btn label={W.keep} disabled={busy} onClick={() => send(null)} />} />}
    >
      <Say>{W.checkSay}</Say>
      <div data-check-example={item.example_id}>
        <ExampleCase content={item.example?.content ?? null} />
      </div>
      <Card b={question} s={W.itsGuess(item.guess)} />
    </Frame>
  );
}

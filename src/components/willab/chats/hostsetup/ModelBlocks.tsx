"use client";

import { useState } from "react";
import { beginFromBlocks } from "@/services/api/modelSetup";
import { OPTS, W } from "./hostSetupCopy";
import { Box, Btn, Card, Chips, Frame, Link, Say, Two } from "./SetupBits";
import { BaseScreen, BlocksScreen, GivesScreen, OwnWhyScreen, type BlockKey } from "./ModelBlockScreens";
import HostTeach from "./HostTeach";

/* -------------------------------------------------------------------------- */
/*  One way to start a model (backend N636 item 7): on the AI models page,    */
/*  "Start your own" and "Start the first one" open the same blocks as the    */
/*  chat setup: why, what it gives back, what it is built on, what it should  */
/*  notice, the four blocks, then "Teach it". Outside a chat Will has no      */
/*  question to suggest, so "What should it notice?" opens on "Type my own":  */
/*  the question typed in Will's chat, then one of the three sets of answers. */
/*  "Teach it" starts the model once (POST /v2/models/setup/blocks) and opens */
/*  its first 10 (HostTeach); a refusal keeps the blocks.                     */
/* -------------------------------------------------------------------------- */

type At = "why" | "gives" | "base" | "model" | "stack" | "teach";
const NEXT: Record<Exclude<At, "teach">, At> = { why: "gives", gives: "base", base: "model", model: "stack", stack: "teach" };

export default function ModelBlocks({ onBack, onDone }: {
  /** Back from the first screen, or "Not now". */
  onBack: () => void;
  /** The model's first 10 are over (or left for later). */
  onDone: () => void;
}) {
  const [at, setAt] = useState<At>("why");
  const [trail, setTrail] = useState<At[]>([]);
  const [gives, setGives] = useState<string | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const [q, setQ] = useState<string | null>(null);
  const [opts, setOpts] = useState(0);
  const [typing, setTyping] = useState(false);
  const [toStack, setToStack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modelId, setModelId] = useState<string | null>(null);

  const go = (to: At) => {
    setTrail((t) => [...t, at]);
    setAt(to);
    // "What should it notice?" with no question yet: straight to typing it.
    if (to === "model" && !q) setTyping(true);
  };
  const back = () => {
    if (typing) {
      setTyping(false);
      if (q) return;
    }
    const was = trail.at(-1);
    if (!was) return onBack();
    setTrail((t) => t.slice(0, -1));
    setAt(was);
  };
  const next = () => (at === "teach" ? undefined : go(NEXT[at]));
  const chosen = () => {
    if (!toStack) return next();
    setToStack(false);
    go("stack");
  };
  const teach = () => {
    if (busy || !q) return;
    if (modelId) return go("teach");
    setBusy(true);
    void beginFromBlocks({ question: q, answers: OPTS[opts % OPTS.length], gives: gives ?? "pick", base: base ?? "gpt" }).then((got) => {
      setBusy(false);
      if (got && "model_id" in got) {
        setModelId(got.model_id);
        go("teach");
      }
    });
  };

  if (typing) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Frame onBack={back}>
          <Say>{W.modelAsk}</Say>
        </Frame>
        <Box
          placeholder={W.modelPlaceholder}
          onSend={(v) => {
            setQ(/\?$/.test(v) ? v : `${v}?`);
            setTyping(false);
          }}
        />
      </div>
    );
  }
  switch (at) {
    case "why":
      return <OwnWhyScreen onBack={back} onNo={onBack} onYes={next} />;
    case "gives":
      return <GivesScreen onBack={back} on={gives} onPick={(id) => { setGives(id); chosen(); }} />;
    case "base":
      return <BaseScreen onBack={back} on={base} onPick={(id) => { setBase(id); chosen(); }} />;
    case "model":
      return (
        <Frame
          onBack={back}
          foot={
            <>
              <Two left={<Btn out label={W.change} onClick={() => setOpts((n) => n + 1)} />} right={<Btn label={W.keep} onClick={next} />} />
              <Link label={W.typeOwn} onClick={() => setTyping(true)} />
            </>
          }
        >
          <Say>{W.firstModel}</Say>
          <Card b={q ?? ""} />
          <Chips items={OPTS[opts % OPTS.length]} />
        </Frame>
      );
    case "stack":
      return (
        <BlocksScreen
          onBack={back}
          q={q ?? ""}
          gives={gives}
          busy={busy}
          onOpen={(block: BlockKey) => {
            setToStack(block !== "model");
            go(block);
          }}
          onTeach={teach}
        />
      );
    case "teach":
      return modelId ? <HostTeach key={modelId} modelId={modelId} onDone={onDone} /> : null;
  }
}

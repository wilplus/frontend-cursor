"use client";

import { useState, type ReactNode } from "react";
import { TapRow } from "../../WillQuestion";
import { LetterCircle } from "../ChatList";
import { TopBar } from "../TopBar";
import { HostAboutLines } from "../HostChat";
import { askReply, tryMyChat, type HostRecipe } from "@/services/api/hostSetup";
import { readOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { visitorKind } from "@/lib/willab/chatBuilder/replyPrompt";
import { W } from "./hostSetupCopy";
import { Dots, Frame, Mine, Say } from "./SetupBits";
import ChatComposer from "../ChatComposer";

/* -------------------------------------------------------------------------- */
/*  "Test my chat" (backend N618 item 8; FIRST-20): the host's own chat opens */
/*  under their name, like any chat in the list; what can be tapped shows as  */
/*  the orange bubbles of any chat. What they send goes to the setup's try    */
/*  route and nothing is kept; the answer and each model's line come back,    */
/*  each saying who it is from, then "Was this useful?", which never stands   */
/*  before the next thing they send.                                          */
/* -------------------------------------------------------------------------- */

type Line = { w?: string; by?: string; me?: string };

export default function HostOwnChat({ name, recipe, onBack, bar = null, about = [] }: {
  name: string;
  recipe: HostRecipe;
  onBack: () => void;
  /** Live's bar, in place of the chat's own (backend N642 item 3). */
  bar?: ReactNode;
  /** Who the host is, on top, as people meet the chat (own_chat.about). */
  about?: readonly string[];
}) {
  const [log, setLog] = useState<Line[]>(() => [{ w: recipe.hello }, ...(recipe.taps.length ? [{ w: W.tellMe }] : [])]);
  const [asking, setAsking] = useState(() => recipe.taps.length > 0);
  const [waiting, setWaiting] = useState(false);
  const [useful, setUseful] = useState(false);
  const add = (...lines: Line[]) => setLog((was) => [...was, ...lines]);
  const send = async (v: string) => {
    const entry = { me: v };
    add(entry);
    setUseful(false);
    setWaiting(true);
    let kept = false;
    try {
      const got = await askReply(readOwnChat().id || "your-chat", { text: v, kind: "text" });
      const seen = visitorKind(got);
      if (seen === "reply" && got?.reply) {
        add({ w: got.reply }, { w: W.useful });
        setUseful(true);
        kept = true;
        return true;
      }
      if (seen === "held" || seen === "host" || seen === "wait") {
        add({ w: seen === "held" ? W.replyHeld : seen === "wait" ? W.replyWait : W.replyHost });
        kept = true;
        return true;
      }
      const lines = await tryMyChat(v);
      if (!lines) return false;
      add(...lines.map((l) => ({ w: l.body, by: l.by })), { w: W.useful });
      setUseful(true);
      kept = true;
      return true;
    } finally {
      setWaiting(false);
      if (!kept) setLog((was) => was.filter((line) => line !== entry));
    }
  };
  const header = bar ?? (
    <TopBar
      circle={<LetterCircle id={`own-${name}`} name={name} size={36} />}
      title={name}
      subtitle={recipe.spec}
      onBack={onBack}
    />
  );
  return (
    <div data-host-own-chat="" className="flex min-h-0 flex-1 flex-col">
      <Frame bar={header} onBack={onBack} dock={null}>
        <HostAboutLines lines={about} />
        {log.map((m, k) => (m.me ? <Mine key={k}>{m.me}</Mine> : <Say key={k} by={m.by}>{m.w}</Say>))}
        {asking ? (
          <TapRow
            even
            labels={[...recipe.taps, W.somethingElse]}
            dataAttr={{ "data-host-taps": "" }}
            onTap={(label) => {
              add({ me: label }, { w: recipe.questions[0]?.q || W.goAhead });
              setAsking(false);
            }}
          />
        ) : null}
        {waiting ? <Dots /> : null}
        {useful ? (
          <TapRow
            even
            labels={[W.yes, W.no, W.skip]}
            dataAttr={{ "data-host-useful": "" }}
            onTap={(label) => {
              setUseful(false);
              if (label !== W.skip) add({ me: label });
              add({ w: W.nextOne });
            }}
          />
        ) : null}
      </Frame>
      <ChatComposer placeholder={W.message(name)} busy={waiting} onSend={asking ? undefined : (words) => send(words.trim())} />
    </div>
  );
}

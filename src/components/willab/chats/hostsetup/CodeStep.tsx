"use client";

import { useState } from "react";
import ChatComposer from "@/components/willab/chats/ChatComposer";
import { LetterCircle } from "../ChatList";
import { TopBar } from "../TopBar";
import { W } from "./hostSetupCopy";
import { WRITTEN_PASTE } from "./talkTurn";
import { checkPlugin } from "@/lib/willab/chatBuilder/plugins";

/* Your own code, as its own row. One locked top bar. After Yes, the host
   either says what it should do or pastes code. */

type Step = "ask" | "way" | "tell" | "summary" | "paste";

export default function CodeStep({ place, onBack, onSave }: {
  place: string;
  onBack: () => void;
  onSave: (paste: string, line: string) => void;
}) {
  const [step, setStep] = useState<Step>("ask");
  const [trouble, setTrouble] = useState("");
  const bar = (
    <TopBar circle={<LetterCircle id="part-code" name={W.codeTitle} size={36} />} title={W.codeTitle} subtitle={place} onBack={onBack} />
  );
  if (step === "way") {
    return (
      <div data-part-chat="code" className="flex min-h-0 flex-1 flex-col">
        {bar}
        <CodeWay onTell={() => setStep("tell")} onPaste={() => { setTrouble(""); setStep("paste"); }} />
      </div>
    );
  }
  if (step === "tell") return <div data-part-chat="code" className="flex min-h-0 flex-1 flex-col">{bar}<CodeTell onReady={() => setStep("summary")} onTrouble={setTrouble} /></div>;
  if (step === "summary") {
    return (
      <div data-part-chat="code" className="flex min-h-0 flex-1 flex-col">
        {bar}
        <CodeSummary onKeep={() => onSave(WRITTEN_PASTE, W.codeTold)} onChange={() => setStep("tell")} />
      </div>
    );
  }
  if (step === "paste") {
    return (
      <div data-part-chat="code" className="flex min-h-0 flex-1 flex-col">
        {bar}
        <CodePaste trouble={trouble} onSave={onSave} onTrouble={setTrouble} />
      </div>
    );
  }
  return (
    <div data-part-chat="code" className="flex min-h-0 flex-1 flex-col">
      {bar}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden px-4 py-4">
        <p className="m-0 text-[18px] font-semibold leading-snug">{W.codeAsk}</p>
        <div className="flex gap-2">
          <button type="button" className="h-[52px] min-w-11 flex-1 rounded-full border border-border text-[16px] font-medium" onClick={() => onSave("", "")}>No</button>
          <button type="button" className="h-[52px] min-w-11 flex-1 rounded-full bg-primary text-[16px] font-medium text-primary-foreground" onClick={() => setStep("way")}>Yes</button>
        </div>
      </div>
    </div>
  );
}

function CodeWay({ onTell, onPaste }: { onTell: () => void; onPaste: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
      <p className="m-0 text-[18px] font-semibold leading-snug">{W.codeHow}</p>
      <button type="button" data-code-way="tell" className="h-[52px] min-w-11 rounded-full border border-border text-[16px] font-medium" onClick={onTell}>{W.codeTell}</button>
      <button type="button" data-code-way="paste" className="h-[52px] min-w-11 rounded-full border border-border text-[16px] font-medium" onClick={onPaste}>{W.codeOwn}</button>
    </div>
  );
}

function CodeTell({ onReady, onTrouble }: { onReady: () => void; onTrouble: (text: string) => void }) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <p className="m-0 text-[18px] font-semibold leading-snug">{W.codeDescribe}</p>
      </div>
      <ChatComposer placeholder={W.codeDescribe} autoFocus maxLength={400} onSend={async (words) => {
          if (!words.trim()) return false;
          const checked = await checkPlugin(WRITTEN_PASTE);
          if (checked.status !== "checked" || !checked.manifest) {
            onTrouble(W.codeMissing);
            return false;
          }
          onReady();
          return true;
        }} />
    </>
  );
}

function CodeSummary({ onKeep, onChange }: { onKeep: () => void; onChange: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
      <p data-code-summary="" className="m-0 text-[18px] font-semibold leading-snug">{W.codeTold}</p>
      <div className="flex gap-2">
        <button type="button" data-code-change="" className="h-[52px] min-w-11 flex-1 rounded-full border border-border text-[16px] font-medium" onClick={onChange}>{W.codeChange}</button>
        <button type="button" data-code-keep="" className="h-[52px] min-w-11 flex-1 rounded-full bg-primary text-[16px] font-medium text-primary-foreground" onClick={onKeep}>{W.codeKeep}</button>
      </div>
    </div>
  );
}

function CodePaste({ trouble, onSave, onTrouble }: {
  trouble: string;
  onSave: (paste: string, line: string) => void;
  onTrouble: (text: string) => void;
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
        <p className="m-0 text-[18px] font-semibold leading-snug">{W.codePaste}</p>
        {trouble ? <p className="m-0 text-[16px]">{trouble}</p> : null}
      </div>
      <ChatComposer placeholder={W.codePaste} autoFocus maxLength={400} onSend={async (words) => {
          const checked = await checkPlugin(words);
          if (checked.status !== "checked" || !checked.manifest) {
            onTrouble(W.codeMissing);
            return false;
          }
          onSave(words, W.codePasted);
          return true;
        }} />
    </>
  );
}

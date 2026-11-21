"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import { BarBox, ChatBarRow, useFilePicker, usePhotoPicker } from "@/components/willab/chats/ChatBar";
import { OwnAvatar } from "./ChatIconPicker";
import { TopBar } from "../TopBar";
import { W } from "./hostSetupCopy";
import type { SendKind } from "@/services/api/hostSetup";
import type { CoachDefinition } from "@/lib/willab/chatBuilder/types";
import { askReply } from "@/services/api/hostSetup";
import { markTileStep } from "@/lib/willab/chatBuilder/tileSteps";
import { readTalkDraft } from "@/lib/willab/chatBuilder/talkDraft";
import { readOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { fileTooBig, visitorKind } from "@/lib/willab/chatBuilder/replyPrompt";

/* The chat as a visitor meets it on the shared link. A send uses the
   server when it answers, and the chat's own words when it does not. */

type Bubble = { who: "them" | "me"; text: string };

function fileData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const comma = raw.indexOf(",");
      resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function localReply(doc: CoachDefinition, kind: "text" | "rec"): string[] {
  const extra = readTalkDraft()?.codeLine?.trim();
  if (kind === "rec") {
    const lines = doc.walk.steps.map((step) => step.fixed).filter((line) => line.trim());
    if (lines.length) return extra ? [...lines.slice(0, 3), extra] : lines.slice(0, 3);
  }
  const line = doc.chat.line || doc.chat.hello;
  return [line, extra].filter((item): item is string => Boolean(item && item.trim()));
}

export default function VisitorTry({ name, doc, sends, onBack }: {
  name: string;
  doc: CoachDefinition;
  sends: SendKind[];
  onBack: () => void;
}) {
  const hello = doc.chat.hello;
  const taps = doc.chat.taps;
  const [lines, setLines] = useState<Bubble[]>(hello ? [{ who: "them", text: hello }] : []);
  const [busy, setBusy] = useState(false);
  const replyLines = async (words: string, kind: "text" | "rec", extra?: Record<string, unknown>) => {
    const remote = await askReply(readOwnChat().id || "your-chat", { text: words, kind, ...extra });
    const seen = visitorKind(remote);
    if (seen === "reply" && remote?.reply) return [remote.reply];
    if (seen === "held") return [W.replyHeld];
    if (seen === "host") return [W.replyHost];
    if (seen === "wait") return [W.replyWait];
    if (seen === "too-big") return [W.fileTooBig];
    if (seen === "unreadable") return [W.fileUnread];
    return localReply(doc, kind);
  };
  const say = async (text: string, kind: "text" | "rec") => {
    const words = text.trim();
    if (!words || busy) return;
    markTileStep("test", true);
    setLines((was) => [...was, { who: "me", text: words }]);
    setBusy(true);
    const reply = await replyLines(words, kind);
    setLines((was) => [...was, ...reply.map((line) => ({ who: "them" as const, text: line }))]);
    setBusy(false);
  };
  const sendFile = async (file: File, fileKind: "photo" | "file") => {
    if (busy) return;
    markTileStep("test", true);
    if (fileTooBig(fileKind, file.size)) {
      setLines((was) => [...was, { who: "me", text: file.name }, { who: "them", text: W.fileTooBig }]);
      return;
    }
    setLines((was) => [...was, { who: "me", text: file.name }]);
    setBusy(true);
    let data = "";
    try {
      data = await fileData(file);
    } catch {
      setLines((was) => [...was, { who: "them", text: W.fileUnread }]);
      setBusy(false);
      return;
    }
    const reply = await replyLines(file.name, "text", { kind: fileKind, data, mime: file.type, name: file.name });
    setLines((was) => [...was, ...reply.map((line) => ({ who: "them" as const, text: line }))]);
    setBusy(false);
  };
  const photo = usePhotoPicker((file) => void sendFile(file, "photo"));
  const file = useFilePicker((file) => void sendFile(file, "file"));
  return (
    <div data-visitor-try="" className="flex min-h-0 flex-1 flex-col bg-background">
      <TopBar circle={<OwnAvatar id={`visit-${name}`} name={name} size={36} />} title={name} onBack={onBack} />
      <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 py-4">
        {taps.length ? (
          <div className="flex flex-wrap gap-2">
            {taps.map((tap) => (
              <button key={tap} type="button" data-visitor-tap="" className="inline-flex min-h-11 items-center rounded-full bg-[#fff1e8] px-3 text-[15px] font-semibold text-[#c84d06]" onClick={() => void say(tap, "text")}>{tap}</button>
            ))}
          </div>
        ) : null}
        {lines.map((line, n) => (
          <p key={n} data-visitor-line={line.who} className={line.who === "me" ? "max-w-[86%] min-w-0 self-end break-words rounded-2xl bg-primary px-3.5 py-2.5 text-[16px] text-primary-foreground" : "max-w-[86%] min-w-0 self-start break-words rounded-2xl bg-muted px-3.5 py-2.5 text-[16px]"}>{line.text}</p>
        ))}
      </div>
      <ChatBarRow>
        {sends.includes("rec") ? (
          <button type="button" aria-label="Send a recording" data-visitor-rec="" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground" onClick={() => void say("A recording", "rec")}>
            <Mic className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        {sends.includes("photo") ? (
          <>
            {photo.input}
            <button type="button" aria-label="Send a photo" data-visitor-photo="" className="flex h-10 min-w-11 shrink-0 items-center justify-center rounded-full px-2 text-[15px] font-medium" onClick={photo.pick}>Photo</button>
          </>
        ) : null}
        {sends.includes("file") ? (
          <>
            {file.input}
            <button type="button" aria-label="Send a file" data-visitor-file="" className="flex h-10 min-w-11 shrink-0 items-center justify-center rounded-full px-2 text-[15px] font-medium" onClick={file.pick}>File</button>
          </>
        ) : null}
        {sends.includes("text") ? (
          <BarBox hint={W.message(name)} open grow onSend={async (words) => { await say(words, "text"); return true; }} />
        ) : null}
      </ChatBarRow>
    </div>
  );
}

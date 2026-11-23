"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic } from "lucide-react";
import { TapRow } from "@/components/willab/WillQuestion";
import { BarBox, ChatBarRow, useFilePicker, usePhotoPicker } from "@/components/willab/chats/ChatBar";
import { OwnAvatar } from "./ChatIconPicker";
import { TopBar } from "../TopBar";
import { W } from "./hostSetupCopy";
import type { SendKind } from "@/services/api/hostSetup";
import type { CoachDefinition } from "@/lib/willab/chatBuilder/types";
import { askReply, keepReplyExample } from "@/services/api/hostSetup";
import { markTileStep } from "@/lib/willab/chatBuilder/tileSteps";
import { readTalkDraft } from "@/lib/willab/chatBuilder/talkDraft";
import { readHold, subscribeHold } from "@/lib/willab/experiments/voiceHold";
import { VoiceTurn } from "@/components/willab/chats/voice/VoiceTurn";
import { readOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { fileTooBig, visitorKind } from "@/lib/willab/chatBuilder/replyPrompt";
import { audioTooBig, audioTooLong, readWav } from "@/lib/willab/chatBuilder/voiceMeasures";

/* The chat as a visitor meets it on the shared link. A send uses the
   server when it answers, and the chat's own words when it does not. */

type Bubble = { who: "them" | "me"; text: string; at?: number | null };

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

export default function VisitorTry({ name, doc, sends, onBack, onWorks }: {
  name: string;
  doc: CoachDefinition;
  sends: SendKind[];
  onBack: () => void;
  /** The host says the test is done. */
  onWorks?: () => void;
}) {
  const hold = useSyncExternalStore(subscribeHold, readHold, readHold);
  const hello = doc.chat.hello;
  const taps = doc.chat.taps;
  const [lines, setLines] = useState<Bubble[]>(hello ? [{ who: "them", text: hello }] : []);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [pair, setPair] = useState<{ ask: string; answer: string } | null>(null);
  useEffect(() => {
    let live = true;
    void askReply(readOwnChat().id || "your-chat", { text: "hello", kind: "text" }).then((remote) => {
      if (live && !remote) setNote(W.voiceOff);
    });
    return () => { live = false; };
  }, []);
  const replyLines = async (words: string, kind: "text" | "rec", extra?: Record<string, unknown>): Promise<Bubble[]> => {
    const remote = await askReply(readOwnChat().id || "your-chat", { text: words, kind, ...extra });
    const seen = visitorKind(remote);
    if (seen === "reply" && remote?.shown && remote.walk?.length && !remote.held) {
      return remote.walk.map((beat) => ({ who: "them" as const, text: beat.text, at: beat.at }));
    }
    const text = seen === "reply" && remote?.reply ? remote.reply
      : seen === "held" ? W.replyHeld
      : seen === "host" ? W.replyHost
      : seen === "wait" ? W.replyWait
      : seen === "too-big" ? W.fileTooBig
      : seen === "too-long" ? W.audioTooLong
      : seen === "unreadable" ? W.fileUnread
      : null;
    if (text) return [{ who: "them", text }];
    return localReply(doc, kind).map((line) => ({ who: "them", text: line }));
  };
  const say = async (text: string, kind: "text" | "rec") => {
    const words = text.trim();
    if (!words || busy) return;
    markTileStep("test", true);
    setLines((was) => [...was, { who: "me", text: words }]);
    setBusy(true);
    const reply = await replyLines(words, kind);
    setLines((was) => [...was, ...reply]);
    setPair({ ask: words, answer: reply.map((line) => line.text).join(" ") });
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
    setLines((was) => [...was, ...reply]);
    setBusy(false);
  };
  const sound = useRef<HTMLAudioElement | null>(null);
  const sendAudio = async (blob: Blob) => {
    if (audioTooBig(blob.size)) {
      setLines((was) => [...was, { who: "me", text: "A recording" }, { who: "them", text: W.audioTooBig }]);
      return;
    }
    const data = await fileData(new File([blob], "talk.webm", { type: blob.type || "audio/webm" }));
    if (blob.type.includes("wav")) {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const read = readWav(bytes);
      if (audioTooLong(read.samples.length / read.sampleRate)) {
        setLines((was) => [...was, { who: "me", text: "A recording" }, { who: "them", text: W.audioTooLong }]);
        return;
      }
    }
    const url = URL.createObjectURL(blob);
    sound.current = new Audio(url);
    markTileStep("test", true);
    setLines((was) => [...was, { who: "me", text: "A recording" }]);
    setBusy(true);
    const reply = await replyLines("A recording", "rec", { kind: "rec", data, mime: blob.type || "audio/webm", name: "talk.webm" });
    setLines((was) => [...was, ...reply]);
    setBusy(false);
  };
  const clip = useRef<MediaRecorder | null>(null);
  const [live, setLive] = useState(false);
  const onRec = async () => {
    if (live) {
      clip.current?.stop();
      setLive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const bits: Blob[] = [];
      const media = new MediaRecorder(stream);
      media.ondataavailable = (event) => { if (event.data.size) bits.push(event.data); };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void sendAudio(new Blob(bits, { type: media.mimeType || "audio/webm" }));
      };
      media.start();
      clip.current = media;
      setLive(true);
    } catch {
      void say("A recording", "rec");
    }
  };
  const replay = (at: number) => {
    const audio = sound.current;
    if (!audio) return;
    audio.currentTime = at;
    void audio.play();
  };
  const photo = usePhotoPicker((file) => void sendFile(file, "photo"));
  const file = useFilePicker((file) => void sendFile(file, "file"));
  return (
    <div data-visitor-try="" className="flex min-h-0 flex-1 flex-col bg-background">
      <TopBar circle={<OwnAvatar id={`visit-${name}`} name={name} size={36} />} title={name} onBack={onBack} />
      <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 py-4">
        {note ? <p data-voice-note="" className="m-0 text-[15px] text-muted-foreground">{note}</p> : null}
        {lines.map((line, n) => (
          line.at != null ? (
            <button key={n} type="button" data-visitor-line={line.who} data-walk-at={line.at} className="max-w-[86%] min-w-0 self-start break-words rounded-2xl bg-muted px-3.5 py-2.5 text-left text-[16px]" onClick={() => replay(line.at ?? 0)}>{line.text}</button>
          ) : (
            <p key={n} data-visitor-line={line.who} className={line.who === "me" ? "max-w-[86%] min-w-0 self-end break-words rounded-2xl bg-primary px-3.5 py-2.5 text-[16px] text-primary-foreground" : "max-w-[86%] min-w-0 self-start break-words rounded-2xl bg-muted px-3.5 py-2.5 text-[16px]"}>{line.text}</p>
          )
        ))}
      </div>
      {taps.length || onWorks ? (
        <div className="px-3 pb-1">
          <TapRow
            even
            labels={pair ? ["Keep this answer", ...(onWorks ? ["This works"] : [])] : [...taps, ...(onWorks ? ["This works"] : [])]}
            dataAttr={{ "data-visitor-taps": "", "data-tap-row": "" }}
            onTap={(label) => {
              if (label === "This works") onWorks?.();
              else if (label === "Keep this answer" && pair) {
                void keepReplyExample(readOwnChat().id || "your-chat", pair.ask, pair.answer);
                setLines((was) => [...was, { who: "them", text: "Kept." }]);
                setPair(null);
              } else void say(label, "text");
            }}
          />
        </div>
      ) : null}
      {hold.model ? (
        <VoiceTurn
          model={hold.model}
          prompts={hold.prompts}
          onReply={async (analysis) => {
            setBusy(true);
            const reply = await replyLines("A recording", "rec", analysis ? { kind: "rec", analysis } : { kind: "rec" });
            setLines((was) => [...was, ...reply]);
            setBusy(false);
          }}
        />
      ) : null}
      <ChatBarRow>
        {sends.includes("rec") && !hold.model ? (
          <button type="button" aria-label="Send a recording" data-visitor-rec="" data-recording={live ? "" : undefined} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground" onClick={() => void onRec()}>
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

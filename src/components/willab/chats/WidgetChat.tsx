"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TapRow } from "@/components/willab/WillQuestion";
import { VoicePlayer } from "@/components/willab/plan/VoicePlayer";
import { LetterCircle } from "@/components/willab/chats/ChatList";
import { VoiceWords, setupWaits } from "@/components/willab/chats/ChatThread";
import { CHAT_EMOJI, type ChatMessage } from "@/services/api/chats";
import {
  answerWidgetSetup,
  askWidget,
  readWidgetChat,
  sendWidgetEmoji,
  startWidgetChat,
  widgetVoiceUrl,
} from "@/services/api/chatWidget";
import {
  AGREE_AND_START,
  CONTINUE_WITH_GOOGLE,
  KEEP_THIS_CHAT,
  KEEP_TITLE,
  NOT_NOW,
  PRIVACY,
  SEND_PICKED,
  WITH_WILLPOWERLAB,
  askName,
  keepLine,
  widgetAsk,
  widgetConsent,
  widgetHello,
  widgetWaits,
} from "@/components/willab/chats/joinCopy";

/* -------------------------------------------------------------------------- */
/*  Your chat on any website (backend N530; rules: docs/flows/                 */
/*  customer-requests.md §B, a person's widget). The page w.js opens in an     */
/*  iframe on someone's site: the pill, "Ask {name}", and the chat behind it.  */
/*  The visitor has no account and can only tap: "Agree and start", the       */
/*  owner's join questions (N487), one of three questions, the three emoji,    */
/*  and the owner's answers, heard here with "Read it". Their secret is kept   */
/*  in this browser for this site; w.js sizes the iframe to what is shown.     */
/* -------------------------------------------------------------------------- */

const KEY = (token: string) => `wpl-widget:${token}`;
const SEEN = (token: string) => `wpl-widget-seen:${token}`;
const READ_EVERY_MS = 15_000;

function kept(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function keep(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // A browser that keeps nothing still chats; the chat is new next time.
  }
}

/** Tell w.js what to make room for: the pill's size, or the open chat. */
function tellHost(state: "closed" | "open", size?: { w: number; h: number }) {
  try {
    window.parent?.postMessage({ wpl: "widget", state, ...(size ?? {}) }, "*");
  } catch {
    // Opened on its own, not in a frame: nothing to tell.
  }
}

/** The visitor's newest question waits for the owner's answer. */
function askWaits(messages: readonly ChatMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (!messages[i].mine) return false;
    if (messages[i].meta && "widget_ask" in messages[i].meta!) return true;
  }
  return false;
}

function Voice({ token, guest, message }: { token: string; guest: string; message: ChatMessage }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void widgetVoiceUrl(token, guest, message.id).then((url) => {
      made = url;
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [token, guest, message.id]);
  const ms = typeof message.meta?.duration_ms === "number" ? (message.meta.duration_ms as number) : null;
  return (
    <div data-widget-voice="" className="mr-auto flex max-w-[85%] flex-col rounded-[16px] rounded-bl-md bg-muted px-3 py-2">
      {src ? <VoicePlayer src={src} tone="grey" durationMs={ms} /> : <span className="h-8 w-48" />}
      {typeof message.words === "string" && message.words ? <VoiceWords words={message.words} mine={false} /> : null}
    </div>
  );
}

function Bubble({ token, guest, message }: { token: string; guest: string; message: ChatMessage }) {
  if (message.kind === "voice") return <Voice token={token} guest={guest} message={message} />;
  if (message.kind === "emoji") {
    return <div className={`${message.mine ? "ml-auto" : "mr-auto"} px-1 text-[44px] leading-none`}>{message.body}</div>;
  }
  if (!message.body) return null;
  return (
    <div
      className={
        message.mine
          ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[15px] text-primary-foreground"
          : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-[16px] rounded-bl-md bg-muted px-3 py-2 text-[15px] text-foreground"
      }
    >
      {message.body}
    </div>
  );
}

function Theirs({ text }: { text: string }) {
  return <div className="mr-auto max-w-[85%] rounded-[16px] rounded-bl-md bg-muted px-3 py-2 text-[15px] text-foreground">{text}</div>;
}

function KeepSheet({ name, onKeep, onClose }: { name: string; onKeep: () => void; onClose: () => void }) {
  return (
    <div data-widget-keep="" className="absolute inset-0 z-10 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div role="dialog" aria-label={KEEP_TITLE} className="flex flex-col gap-3 rounded-t-3xl bg-background px-4 pb-5 pt-2.5" onClick={(e) => e.stopPropagation()}>
        <span aria-hidden className="h-[5px] w-10 self-center rounded-full bg-[#E0E0E0]" />
        <p className="mt-1 text-[19px] font-bold leading-tight text-foreground">{KEEP_TITLE}</p>
        <p className="text-[14px] leading-snug text-muted-foreground">{keepLine(name)}</p>
        <button type="button" data-widget-google="" onClick={onKeep} className="flex h-12 items-center justify-center gap-2.5 rounded-full border border-border bg-background text-[15px] font-semibold text-foreground">
          <span aria-hidden className="h-[18px] w-[18px] rounded-full" style={{ background: "conic-gradient(#EA4335 0 25%, #FBBC05 0 50%, #34A853 0 75%, #4285F4 0)" }} />
          {CONTINUE_WITH_GOOGLE}
        </button>
        <button type="button" onClick={onClose} className="h-9 text-[14.5px] font-medium text-muted-foreground">
          {NOT_NOW}
        </button>
      </div>
    </div>
  );
}

export default function WidgetChat({ token, name, asks, site }: { token: string; name: string; asks: string[]; site: string | null }) {
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isKept, setKept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [day, setDay] = useState("");
  const pill = useRef<HTMLButtonElement>(null);
  const thread = useRef<HTMLDivElement>(null);

  const theirsCount = (list: readonly ChatMessage[]) => list.filter((m) => !m.mine).length;

  const read = useCallback(
    async (who: string, opened: boolean) => {
      const chat = await readWidgetChat(token, who);
      if (!chat) {
        // The link was replaced or the chat is gone: start again next time.
        keep(KEY(token), null);
        setGuest(null);
        setMessages([]);
        return;
      }
      setMessages(chat.messages);
      setKept(chat.kept);
      const count = String(theirsCount(chat.messages));
      if (opened) keep(SEEN(token), count);
      else setUnread(count !== (kept(SEEN(token)) ?? "0") && Number(count) > 0);
    },
    [token],
  );

  // The visitor's chat on this site, if they started one before.
  useEffect(() => {
    const who = kept(KEY(token));
    if (who) {
      setGuest(who);
      void read(who, false);
    }
  }, [token, read]);

  // Read again now and then, so the owner's answer arrives while the page is open.
  useEffect(() => {
    if (!guest) return;
    const every = window.setInterval(() => void read(guest, open), open ? READ_EVERY_MS : READ_EVERY_MS * 4);
    return () => window.clearInterval(every);
  }, [guest, open, read]);

  // w.js makes room for the pill, or for the open chat.
  useLayoutEffect(() => {
    if (open) return tellHost("open");
    const el = pill.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    tellHost("closed", { w: Math.ceil(r.width) + 24, h: Math.ceil(r.height) + 24 });
  }, [open, unread, name]);

  useEffect(() => {
    const el = thread.current;
    if (open && el) el.scrollTop = el.scrollHeight;
  }, [open, messages, busy]);

  const openChat = () => {
    setOpen(true);
    setUnread(false);
    keep(SEEN(token), String(theirsCount(messages)));
    if (guest) void read(guest, true);
  };

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const agree = () =>
    run(async () => {
      const started = await startWidgetChat(token, site);
      if (!started) return;
      keep(KEY(token), started.guest);
      setGuest(started.guest);
      setMessages(started.chat.messages);
    });

  const tapSetup = (message: ChatMessage, picked: string[], date?: string) =>
    run(async () => {
      if (!guest) return;
      const after = await answerWidgetSetup(token, guest, message.id, picked, date);
      if (after) setMessages((was) => [...was, ...after]);
      setDay("");
    });

  const tapAsk = (label: string) =>
    run(async () => {
      if (!guest) return;
      const sent = await askWidget(token, guest, asks.indexOf(label));
      if (sent) setMessages((was) => [...was, sent]);
    });

  const tapEmoji = (emoji: string) =>
    run(async () => {
      if (!guest) return;
      const sent = await sendWidgetEmoji(token, guest, emoji);
      if (sent) setMessages((was) => [...was, sent]);
    });

  const keepIt = () => {
    if (!guest) return;
    const back = `${window.location.origin}/c/${encodeURIComponent(token)}?from=widget#g=${encodeURIComponent(guest)}`;
    window.open(back, "_blank", "noopener");
    setKeeping(false);
  };

  if (!open) {
    return (
      <div className="fixed bottom-3 right-3">
        <button
          ref={pill}
          type="button"
          data-widget-pill=""
          onClick={openChat}
          className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-[18px] text-[15px] font-semibold text-[#121212] shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
        >
          <LetterCircle id={token} name={name} size={36} />
          {askName(name)}
          {unread ? <span aria-hidden data-widget-new="" className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
        </button>
      </div>
    );
  }

  const waiting = setupWaits(messages);
  const question = waiting?.question ?? null;
  const hurryYes = question && question.kind === "hurry";
  const started = Boolean(guest);
  const asked = messages.some((m) => m.mine && m.meta && "widget_ask" in m.meta);
  const waits = askWaits(messages);
  const canAsk = started && !waiting && !waits;

  return (
    <section data-widget-chat="" aria-label={name} className="fixed inset-0 flex flex-col overflow-hidden rounded-[22px] bg-background text-foreground">
      <header className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-border pl-3.5 pr-2">
        <LetterCircle id={token} name={name} size={36} />
        <b className="min-w-0 flex-1 truncate text-[16px]">{name}</b>
        <button type="button" aria-label="Close" data-widget-close="" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[15px]">
          ✕
        </button>
      </header>
      <div ref={thread} data-widget-thread="" className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2 pt-3">
        <div className="flex-1" />
        <Theirs text={widgetHello(name)} />
        {messages.map((m) => (
          <Bubble key={m.id} token={token} guest={guest ?? ""} message={m} />
        ))}
        {canAsk ? <Theirs text={widgetAsk(name)} /> : null}
        {waits ? (
          <p data-widget-waits="" className="mx-auto mt-1 max-w-[86%] rounded-[10px] bg-muted px-2.5 py-1.5 text-center text-[12.5px] text-muted-foreground">
            {widgetWaits(name)}
          </p>
        ) : null}
      </div>
      {!started ? (
        <div data-widget-consent="" className="mx-3 mb-2.5 flex flex-col gap-2.5 rounded-2xl border border-border p-3">
          <p className="text-[13.5px] leading-snug text-muted-foreground">
            {widgetConsent(name)}{" "}
            <a href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-2">
              {PRIVACY}
            </a>
          </p>
          <button type="button" data-widget-agree="" disabled={busy} onClick={() => void agree()} className="h-11 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-60">
            {AGREE_AND_START}
          </button>
        </div>
      ) : waiting && question ? (
        <div className="px-3 pb-2">
          {hurryYes && day !== "" ? (
            <div className="flex items-center justify-end gap-2">
              <input type="date" aria-label={waiting.message.body} value={day === "pick" ? "" : day} onChange={(e) => setDay(e.target.value || "pick")} className="h-11 rounded-full border border-border bg-background px-3 text-[15px]" />
              <button type="button" disabled={busy || day === "pick"} onClick={() => void tapSetup(waiting.message, ["Yes"], day)} className="h-11 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground disabled:opacity-50">
                {SEND_PICKED}
              </button>
            </div>
          ) : (
            <TapRow
              labels={question.answers}
              disabled={busy}
              dataAttr={{ "data-widget-answers": "" }}
              onTap={(label) => (hurryYes && label === "Yes" ? setDay("pick") : void tapSetup(waiting.message, [label]))}
            />
          )}
        </div>
      ) : canAsk ? (
        <div className="px-3 pb-2">
          <TapRow labels={asks} even disabled={busy} dataAttr={{ "data-widget-asks": "" }} onTap={(label) => void tapAsk(label)} />
        </div>
      ) : null}
      {started && !waiting ? (
        <div className="px-3 pb-1.5">
          <div data-widget-emoji="" className="flex h-[46px] items-center justify-around rounded-full border border-border">
            {CHAT_EMOJI.map((e) => (
              <button key={e} type="button" disabled={busy} onClick={() => void tapEmoji(e)} className="h-10 w-14 rounded-full text-[24px] disabled:opacity-60">
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <footer data-widget-foot="" className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3.5 pb-2.5 pt-1.5 text-[12px] text-muted-foreground">
        {asked && !isKept ? (
          <button type="button" data-widget-keep-open="" onClick={() => setKeeping(true)} className="py-1 text-[13.5px] font-semibold text-foreground">
            {KEEP_THIS_CHAT}
          </button>
        ) : (
          <span />
        )}
        <a href="/" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-flex gap-[3px]">
            <i className="h-1 w-1 rounded-full bg-muted-foreground" />
            <i className="h-1 w-1 rounded-full bg-muted-foreground" />
            <i className="h-1 w-1 rounded-full bg-muted-foreground" />
          </span>
          {WITH_WILLPOWERLAB}
        </a>
      </footer>
      {keeping ? <KeepSheet name={name} onKeep={keepIt} onClose={() => setKeeping(false)} /> : null}
    </section>
  );
}

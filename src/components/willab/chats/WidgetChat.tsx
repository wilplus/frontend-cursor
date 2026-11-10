"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TapRow } from "@/components/willab/WillQuestion";
import { VoicePlayer } from "@/components/willab/plan/VoicePlayer";
import { LetterCircle } from "@/components/willab/chats/ChatList";
import { VoiceWords, setupWaits } from "@/components/willab/chats/ChatThread";
import { CHAT_EMOJI, type ChatMessage } from "@/services/api/chats";
import {
  answerWidgetSetup,
  readWidgetChat,
  sendWidgetMessage,
  startWidgetChat,
  widgetVoiceUrl,
  type WidgetChat as WidgetChatRead,
  type WidgetWrites,
} from "@/services/api/chatWidget";
import {
  NOT_NOW,
  SEND_PICKED,
  SIGN_UP,
  WIDGET_SIGN_UP_NOTE,
  WITH_WILLPOWERLAB,
  askName,
  widgetSignUpLine,
  widgetSignedUp,
} from "@/components/willab/chats/joinCopy";

/* -------------------------------------------------------------------------- */
/*  The website chat (backend N591, N595, N600; rules: docs/flows/            */
/*  customer-requests.md B8 to B13). The page w.js opens in an iframe on       */
/*  someone's site: the pill, "Ask {name}", and the host's own chat behind it, */
/*  on the public side. No consent card (N595 item 1): the visitor writes at  */
/*  once, and their first message makes their chat, with the host's welcome  */
/*  and the host's own questions (N590 item 2), tapped above the bar. The bar */
/*  follows the host's recipe as in a host's chat (N600): "+" on the left,    */
/*  the typing box (or the three emoji) in the middle, a small mic on the     */
/*  right once recording is open to them. After asking, they sign up to get  */
/*  the answer (N591 item 4, N595's signed words): until then the host's      */
/*  answers are held back by the backend. The sign-up opens the join page in */
/*  a new tab with the visitor's secret; once signed up, the answers show    */
/*  here, a voice answer with "Read it". The secret is kept in this browser  */
/*  for this site; w.js sizes the iframe to what is shown.                    */
/* -------------------------------------------------------------------------- */

const KEY = (token: string) => `wpl-widget:${token}`;
const SEEN = (token: string) => `wpl-widget-seen:${token}`;
const READ_EVERY_MS = 15_000;
/** The longest message a visitor types (backend chat_widget.MAX_TEXT). */
const MAX_TEXT = 2000;

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

/** One of the host's own questions, answered by taps above the bar (N487,
 *  N590 item 2, N600 item 3); "Yes" to "Are you in a hurry?" opens a date
 *  with Send. */
function SetupAnswers({ waiting, busy, onAnswer }: {
  waiting: NonNullable<ReturnType<typeof setupWaits>>;
  busy: boolean;
  onAnswer: (message: ChatMessage, picked: string[], date?: string) => void;
}) {
  const [day, setDay] = useState("");
  const question = waiting.question;
  const hurryYes = question.kind === "hurry";
  if (hurryYes && day !== "") {
    return (
      <div className="flex items-center justify-end gap-2 px-3 pb-2">
        <input type="date" aria-label={waiting.message.body} value={day === "pick" ? "" : day} onChange={(e) => setDay(e.target.value || "pick")} className="h-11 rounded-full border border-border bg-background px-3 text-[15px]" />
        <button type="button" disabled={busy || day === "pick"} onClick={() => onAnswer(waiting.message, ["Yes"], day)} className="h-11 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground disabled:opacity-50">
          {SEND_PICKED}
        </button>
      </div>
    );
  }
  return (
    <div className="px-3 pb-2">
      <TapRow
        labels={question.answers}
        disabled={busy}
        dataAttr={{ "data-widget-answers": "" }}
        onTap={(label) => (hurryYes && label === "Yes" ? setDay("pick") : onAnswer(waiting.message, [label]))}
      />
    </div>
  );
}

/** After asking, the sign-up step (N591 item 4), in N595's signed words:
 *  the line, the note, Sign up, Not now. */
function SignUpCard({ name, onSignUp, onLater }: { name: string; onSignUp: () => void; onLater: () => void }) {
  return (
    <div data-widget-sign-up="" className="mx-3 mb-2 flex flex-col gap-2 rounded-2xl border border-border p-3">
      <p data-widget-sign-up-line="" className="text-[15px] font-semibold leading-snug text-foreground">{widgetSignUpLine(name)}</p>
      <p className="text-[13.5px] leading-snug text-muted-foreground">{WIDGET_SIGN_UP_NOTE}</p>
      <button type="button" data-widget-sign-up-go="" onClick={onSignUp} className="h-11 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground">
        {SIGN_UP}
      </button>
      <button type="button" data-widget-later="" onClick={onLater} className="h-9 text-[14.5px] font-medium text-muted-foreground">
        {NOT_NOW}
      </button>
    </div>
  );
}

/** The visitor's bar (N600 items 1 to 3, as for a host's chat): "+" on the
 *  left; in the middle the typing box when the host's recipe takes words,
 *  else the three emoji; a small mic on the right when it takes recordings
 *  (for a visitor, only once signed up, N591). The same bar whether or not
 *  a question waits: its tap answers sit above it. "+" and the mic open the
 *  chat in WillpowerLab, where a recording goes through the
 *  processing-authorization path; before the sign-up "+" opens the sign-up. */
function WriteBar({ name, writes, busy, onSend, onPlus, onMic }: {
  name: string;
  writes: WidgetWrites;
  busy: boolean;
  onSend: (kind: "emoji" | "text", body: string) => Promise<boolean>;
  onPlus: (() => void) | null;
  onMic: () => void;
}) {
  const [draft, setDraft] = useState("");
  const words = draft.trim();
  const send = async () => {
    if (words && (await onSend("text", words))) setDraft("");
  };
  const round = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full";
  return (
    <div data-widget-bar="" className="flex items-center gap-2 px-3 pb-1.5">
      {onPlus ? (
        <button type="button" data-widget-plus="" aria-label="+" onClick={onPlus} className={`${round} border border-border text-[22px] leading-none text-foreground`}>
          +
        </button>
      ) : null}
      {writes.type ? (
        <form
          data-widget-type=""
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            type="text"
            value={draft}
            maxLength={MAX_TEXT}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={name}
            className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-[15px]"
          />
          {words ? (
            <button type="submit" data-widget-send="" disabled={busy} className="h-11 shrink-0 rounded-full bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-50">
              {SEND_PICKED}
            </button>
          ) : null}
        </form>
      ) : (
        <div data-widget-emoji="" className="flex h-[46px] min-w-0 flex-1 items-center justify-around rounded-full border border-border">
          {CHAT_EMOJI.map((e) => (
            <button key={e} type="button" disabled={busy} onClick={() => void onSend("emoji", e)} className="h-10 w-12 rounded-full text-[24px] disabled:opacity-60">
              {e}
            </button>
          ))}
        </div>
      )}
      {writes.record ? (
        <button type="button" data-widget-mic="" aria-label="🎤" onClick={onMic} className={`${round} text-[18px] text-muted-foreground`}>
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function Foot({ signUpLater, onSignUp }: { signUpLater: boolean; onSignUp: () => void }) {
  return (
    <footer data-widget-foot="" className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3.5 pb-2.5 pt-1.5 text-[12px] text-muted-foreground">
      {signUpLater ? (
        <button type="button" data-widget-sign-up-later="" onClick={onSignUp} className="py-1 text-[13.5px] font-semibold text-foreground">
          {SIGN_UP}
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
  );
}

/** What the pill's dot counts: the host's messages shown, and one more while
 *  an answer waits behind the sign-up. */
const seenCount = (chat: Pick<WidgetChatRead, "messages" | "answered">) =>
  String(chat.messages.filter((m) => !m.mine).length + (chat.answered ? 1 : 0));

const NOTHING_YET: Pick<WidgetChatRead, "signedUp" | "signUp" | "answered" | "noticeTo"> = { signedUp: false, signUp: false, answered: false, noticeTo: null };

export default function WidgetChat({ token, name, welcome = [], writes: firstWrites, site }: {
  token: string;
  name: string;
  /** The host's welcome, shown before the visitor writes (N595 item 1). */
  welcome?: string[];
  writes: WidgetWrites;
  site: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [writes, setWrites] = useState<WidgetWrites>(firstWrites);
  const [state, setState] = useState(NOTHING_YET);
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const thread = useRef<HTMLDivElement>(null);

  const took = useCallback((chat: WidgetChatRead) => {
    setMessages(chat.messages);
    setWrites(chat.writes);
    setState({ signedUp: chat.signedUp, signUp: chat.signUp, answered: chat.answered, noticeTo: chat.noticeTo });
  }, []);

  const read = useCallback(
    async (who: string, opened: boolean) => {
      const chat = await readWidgetChat(token, who);
      if (!chat) {
        // The link was replaced or the chat is gone: start again next time.
        keep(KEY(token), null);
        setGuest(null);
        setMessages([]);
        setState(NOTHING_YET);
        return;
      }
      took(chat);
      const count = seenCount(chat);
      if (opened) keep(SEEN(token), count);
      else setUnread(count !== (kept(SEEN(token)) ?? "0") && Number(count) > 0);
    },
    [token, took],
  );

  // The visitor's chat on this site, if they started one before.
  useEffect(() => {
    const who = kept(KEY(token));
    if (who) {
      setGuest(who);
      void read(who, false);
    }
  }, [token, read]);

  // Read again now and then, so the host's answer, and the sign-up made in
  // the other tab, arrive while the page is open.
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
  }, [open, messages, busy, state]);

  const openChat = () => {
    setOpen(true);
    setUnread(false);
    keep(SEEN(token), seenCount({ messages, answered: state.answered }));
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

  const tapSetup = (message: ChatMessage, picked: string[], date?: string) =>
    run(async () => {
      if (!guest) return;
      const after = await answerWidgetSetup(token, guest, message.id, picked, date);
      if (after) setMessages((was) => [...was, ...after]);
    });

  // No consent card (N595 item 1): the visitor writes at once. Their first
  // message makes their chat (the backend's "start"), the host's welcome and
  // questions first, then the message; after that each goes into it.
  const send = async (kind: "emoji" | "text", body: string): Promise<boolean> => {
    if (busy) return false;
    let went = false;
    await run(async () => {
      if (!guest) {
        const started = await startWidgetChat(token, site, { kind, body });
        if (!started) return;
        went = true;
        keep(KEY(token), started.guest);
        setGuest(started.guest);
        took(started.chat);
        setLater(false);
        return;
      }
      const sent = await sendWidgetMessage(token, guest, kind, body);
      if (!sent) return;
      went = true;
      setMessages((was) => [...was, sent.message]);
      if (sent.signUp) {
        setState((was) => ({ ...was, signUp: true }));
        setLater(false);
      }
    });
    return went;
  };

  // The sign-up (N591 item 4): the join page in a new tab, carrying the
  // visitor's secret after `#g=`; sign in there with a phone, email, Google
  // or another sign-in (the sign-up page keeps "By signing up, you agree to
  // our Terms of Service and Privacy Policy.", N595 item 1), and the chat
  // becomes theirs.
  const signUp = () => {
    if (!guest) return;
    const back = `${window.location.origin}/c/${encodeURIComponent(token)}?from=widget#g=${encodeURIComponent(guest)}`;
    window.open(back, "_blank", "noopener");
    setLater(true);
  };

  // Signed up: "+" and the mic open the chat in WillpowerLab, where a
  // recording goes through the processing-authorization path.
  const inTheApp = () => window.open(`${window.location.origin}/chat`, "_blank", "noopener");

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
  const signUpDue = Boolean(guest) && !state.signedUp && state.signUp;
  const plus = state.signedUp ? inTheApp : guest ? signUp : null;

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
        {!guest
          ? welcome.map((line, i) => (
              <div key={`welcome-${i}`} data-widget-welcome="" className="mr-auto max-w-[85%] whitespace-pre-wrap rounded-[16px] rounded-bl-md bg-muted px-3 py-2 text-[15px] text-foreground">
                {line}
              </div>
            ))
          : null}
        {messages.map((m) => (
          <Bubble key={m.id} token={token} guest={guest ?? ""} message={m} />
        ))}
        {state.signedUp && state.noticeTo ? (
          <p data-widget-signed-up="" className="mx-auto mt-1 max-w-[86%] rounded-[10px] bg-muted px-2.5 py-1.5 text-center text-[12.5px] text-muted-foreground">
            {widgetSignedUp(state.noticeTo)}
          </p>
        ) : null}
      </div>
      {waiting && waiting.question ? (
        <SetupAnswers key={waiting.message.id} waiting={waiting} busy={busy} onAnswer={(m, picked, date) => void tapSetup(m, picked, date)} />
      ) : signUpDue && !later ? (
        <SignUpCard name={name} onSignUp={signUp} onLater={() => setLater(true)} />
      ) : null}
      <WriteBar name={name} writes={writes} busy={busy} onSend={send} onPlus={plus} onMic={inTheApp} />
      <Foot signUpLater={signUpDue && later} onSignUp={signUp} />
    </section>
  );
}

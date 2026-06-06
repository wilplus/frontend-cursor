"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postChatQuery } from "@/services/api/chatQuery";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { useLoungeThreadCtx } from "./LoungeThreadContext";
import { loungeToHistory } from "./willabHelpers";
import ReportCard from "./ReportCard";
import InsightsOverlay from "./InsightsOverlay";
import LibraryOverlay from "./LibraryOverlay";
import HistoryOverlay from "./HistoryOverlay";
import { clearInsightsReady, getInsightsReady, getReviewPending } from "./sendStatus";
import { useSpeechInput } from "./useSpeechInput";
import { isLabOverlay, type WillabState } from "./useWillabFlow";

/* -------------------------------------------------------------------------- */
/*  Lounge — the always-mounted science-chat home (§3 / §6a / §7)             */
/*                                                                            */
/*  Replaces the LoungeStub: a persistent thread (useLoungeThread — server     */
/*  when signed in, localStorage when not), a librarian bot over the existing  */
/*  /v2/chat/query endpoint (we read `.answer`; the funnel-only flags are      */
/*  ignored), the single-active status region (§6a: parked / review / ready),  */
/*  and the entry into the Lab. Audio, KPIs and labels live in the Lab — the   */
/*  Lounge is text-only and never judges (§7 librarian-not-judge).            */
/* -------------------------------------------------------------------------- */

export default function Lounge({
  state,
  onStart,
  goTo,
}: {
  state: WillabState;
  onStart: () => void;
  goTo: (s: WillabState) => void;
}) {
  const thread = useLoungeThreadCtx();
  const { messages, reload } = thread;
  const [draftText, setDraftText] = useState("");
  const [botThinking, setBotThinking] = useState(false);
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Voice input (§3): text-or-speech, both unmeasured. Released while the Lab
  // overlay is open so only the Lab's MediaRecorder holds the mic (§4).
  const speech = useSpeechInput({
    enabled: !isLabOverlay(state),
    onTranscript: (t) => setDraftText((d) => (d ? `${d} ${t}` : t)),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, botThinking]);

  // §6c: when the coach publishes (status flips to insights_ready), pull the
  // thread so the BE-appended "insights ready" ping shows in-chat at once — the
  // status card already flips live. The BE is the sole writer; we only re-read.
  useEffect(() => {
    if (state === "insights_ready") void reload();
  }, [state, reload]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const q = draftText.trim();
    if (!q || botThinking) return;
    const history = loungeToHistory(messages); // snapshot of prior turns (pre-append)
    setDraftText("");
    await thread.append({ role: "user", kind: "text", body: q });
    setBotThinking(true);
    try {
      const resp = await postChatQuery({ question: q, history });
      const answer = (resp.answer ?? "").trim();
      await thread.append({
        role: "bot",
        kind: "text",
        body: answer || "I didn't quite catch that — mind putting it another way?",
      });
    } catch {
      await thread.append({
        role: "bot",
        kind: "text",
        body: "I'm having trouble reaching the lab right now — give it another try in a moment.",
      });
    } finally {
      setBotThinking(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <StatusRegion state={state} goTo={goTo} onViewReadout={setActiveInsight} />

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {thread.hasMore && (
          <button
            type="button"
            onClick={() => void thread.loadOlder()}
            disabled={thread.loadingOlder}
            className="mx-auto text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {thread.loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}

        {thread.loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <LoungeEmptyState />
        ) : (
          messages.map((m) => (
            <Bubble
              key={m.client_id}
              message={m}
              onViewInsights={setActiveInsight}
            />
          ))
        )}

        {botThinking && (
          <div className="mr-auto rounded-2xl bg-muted px-3 py-2 text-[15px] text-muted-foreground">
            …
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onStart}
        className="w-full rounded-full"
      >
        ▶ Start official recording
      </Button>
      <div className="flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="text-[13px] text-muted-foreground hover:text-foreground"
        >
          ★ Your strong sides
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="text-[13px] text-muted-foreground hover:text-foreground"
        >
          🕓 Your recordings
        </button>
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Ask about how communication works…"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-[15px] outline-none focus:border-primary"
          aria-label="Message the willab librarian"
        />
        {speech.supported ? (
          <Button
            type="button"
            variant={speech.listening ? "default" : "outline"}
            onClick={speech.toggle}
            disabled={botThinking}
            className="rounded-full px-3"
            aria-label={speech.listening ? "Stop voice input" : "Speak your message"}
            aria-pressed={speech.listening}
          >
            <Mic className={`h-4 w-4 ${speech.listening ? "animate-pulse" : ""}`} />
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={!draftText.trim() || botThinking}
          className="rounded-full px-4"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {activeInsight && (
        <InsightsOverlay
          sessionId={activeInsight}
          onClose={() => setActiveInsight(null)}
        />
      )}
      {libraryOpen && <LibraryOverlay onClose={() => setLibraryOpen(false)} />}
      {historyOpen && (
        <HistoryOverlay
          onClose={() => setHistoryOpen(false)}
          onOpenSession={(sid) => {
            setHistoryOpen(false);
            setActiveInsight(sid);
          }}
        />
      )}
    </div>
  );
}

function Bubble({
  message,
  onViewInsights,
}: {
  message: LoungeMessage;
  onViewInsights?: (sessionId: string) => void;
}) {
  if (message.kind === "recording_summary" || message.kind === "insight") {
    return <ReportCard message={message} onViewInsights={onViewInsights} />;
  }
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-[15px] text-primary-foreground">
        {message.body}
      </div>
    );
  }
  if (message.role === "bot") {
    return (
      <div className="mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
        {message.body}
      </div>
    );
  }
  // system / status / recording_summary / insight → centered meta line
  return (
    <div className="mx-auto max-w-[90%] text-center text-[12px] text-muted-foreground">
      {message.body}
    </div>
  );
}

function LoungeEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <p className="max-w-sm text-[15px] text-foreground">
        Hi — I&apos;m your willab librarian.
      </p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
        Ask me anything about how communication actually works, or hit{" "}
        <span className="font-medium text-foreground">
          Start official recording
        </span>{" "}
        when you want a coach&apos;s read on how you sound.
      </p>
    </div>
  );
}

/* ----------------------------- status region (§6a) ------------------------ */
/*  Single-active by construction: these states are mutually exclusive in the
 *  §8 machine, so at most one card renders. */
function StatusRegion({
  state,
  goTo,
  onViewReadout,
}: {
  state: WillabState;
  goTo: (s: WillabState) => void;
  onViewReadout: (sessionId: string) => void;
}) {
  if (state === "parked") {
    return (
      <StatusCard tone="hold">
        <p className="text-[15px] text-foreground">
          Your Readout is held — pick it back up whenever you&apos;re ready.
        </p>
        {/* TODO(slice: Readout): restore the held Readout data on resume. */}
        <Button
          type="button"
          size="sm"
          onClick={() => goTo("readout")}
          className="mt-2 rounded-full"
        >
          Resume Readout
        </Button>
      </StatusCard>
    );
  }
  if (state === "review_pending") {
    const sid = getReviewPending();
    return (
      <StatusCard tone="info">
        <p className="text-[15px] text-foreground">
          Your recording is with a coach.
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          We&apos;ll surface their read here as soon as it lands — no need to
          wait around.
        </p>
        {sid ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onViewReadout(sid)}
            className="mt-2 rounded-full"
          >
            View your readout
          </Button>
        ) : null}
      </StatusCard>
    );
  }
  if (state === "insights_ready") {
    const sid = getInsightsReady();
    return (
      <StatusCard tone="ready">
        <p className="text-[15px] text-foreground">
          Your coach sent through new insights.
        </p>
        {sid ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onViewReadout(sid); // opens the annotated Readout (read → BE library fold §3.11)
              clearInsightsReady();
              goTo("lounge_idle"); // transient: once read, back to the launch CTA (§6a)
            }}
            className="mt-2 rounded-full"
          >
            Read ›
          </Button>
        ) : (
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            They&apos;re saved to your history.
          </p>
        )}
      </StatusCard>
    );
  }
  return null;
}

function StatusCard({
  tone,
  children,
}: {
  tone: "hold" | "info" | "ready";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "ready"
      ? "border-primary/30 bg-primary/5"
      : tone === "hold"
        ? "border-border bg-muted/30"
        : "border-border bg-muted/20";
  return <div className={`rounded-2xl border p-3 ${toneClass}`}>{children}</div>;
}

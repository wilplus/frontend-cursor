"use client";

import {
  Activity,
  Gauge,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Square,
  Waves,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MediaPlayer from "@/components/results/MediaPlayer";

/* -------------------------------------------------------------------------- */
/*  Rich chat bubbles — the in-chat replacement for the old /results page    */
/*                                                                            */
/*  All variants share a left-anchored bot-bubble look (orange "W"           */
/*  avatar + rounded-2xl card) so they read as the coach talking, not as     */
/*  modals stapled into the thread. Each variant owns its own internal       */
/*  state where useful, but data-fetching + write-back side effects are     */
/*  caller-driven so a parent state machine can sequence things             */
/*  deterministically.                                                       */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Shared bubble shell                                                       */
/* -------------------------------------------------------------------------- */

function BubbleShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex justify-start animate-fade-in-up">
      <div className="flex max-w-[92%] items-start gap-2.5 sm:max-w-[85%]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <span className="text-xs font-bold text-primary-foreground">W</span>
        </div>
        <div
          className={cn(
            "rounded-2xl rounded-tl-sm border border-border bg-chat-bot px-4 py-3 shadow-sm w-full",
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SnippetPlayerBubble                                                       */
/*                                                                            */
/*  Renders one coach-pulled snippet inside the chat stream — the coach      */
/*  insight as a left-bordered quote, the audio player below it, and the     */
/*  type badge in the corner so the user knows whether this is a charisma    */
/*  highlight or a stress moment before they press play.                     */
/* -------------------------------------------------------------------------- */

export interface SnippetPlayerData {
  id: string;
  type: "charisma" | "stress";
  badgeLabel: string;
  insight: string;
  audioUrl: string | null;
  startOffsetMs: number;
  durationMs: number;
}

export function SnippetPlayerBubble({ snippet }: { snippet: SnippetPlayerData }) {
  const isCharisma = snippet.type === "charisma";
  return (
    <BubbleShell>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            isCharisma
              ? "bg-emerald-100 text-emerald-800"
              : "border border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          {snippet.badgeLabel}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {(snippet.durationMs / 1000).toFixed(1)}s
        </span>
      </div>
      <blockquote className="mt-3 border-l-2 border-primary/60 pl-3 text-[13px] italic leading-relaxed text-foreground">
        {snippet.insight}
      </blockquote>
      <div className="mt-3">
        <MediaPlayer
          src={snippet.audioUrl}
          startOffsetMs={snippet.startOffsetMs}
          durationMs={snippet.durationMs}
        />
      </div>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  ActionBubble                                                              */
/*                                                                            */
/*  Inline button row inside the chat — the user makes a choice and the      */
/*  bubble visually confirms which option was tapped (selected one stays      */
/*  highlighted, the rest disable). Caller owns the click handler so it      */
/*  can fire API calls + advance the state machine.                          */
/* -------------------------------------------------------------------------- */

export interface ActionOption {
  /** Stable identifier passed back to the caller's onSelect. */
  value: string;
  /** Display text. */
  label: string;
  /** Optional variant for visual valence. Constrained to the Button
   *  component's accepted variants. */
  variant?: "default" | "outline" | "ghost";
}

export function ActionBubble({
  prompt,
  options,
  selected,
  submitting,
  onSelect,
}: {
  /** Short prompt above the buttons, e.g. "Was this charisma?". */
  prompt: string;
  options: ActionOption[];
  /** Value of the option the user already picked (locked, shown
   *  highlighted). Null = nothing picked yet. */
  selected: string | null;
  /** True while the API call is in flight. Disables every button. */
  submitting: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <BubbleShell>
      <p className="text-[13px] leading-relaxed text-foreground">{prompt}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selected === opt.value;
          const isLocked = selected !== null;
          return (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={isSelected ? "default" : opt.variant ?? "outline"}
              disabled={(isLocked && !isSelected) || submitting}
              onClick={() => onSelect(opt.value)}
              className={cn(
                "rounded-full text-xs",
                isSelected && "ring-2 ring-primary/40"
              )}
            >
              {submitting && isSelected && (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              )}
              {opt.label}
            </Button>
          );
        })}
      </div>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  DashboardBubble — the Calm Anchor                                         */
/*                                                                            */
/*  Drastically pared back per the "Single Surface" spec: archetype label    */
/*  is hard-locked to "The Calm Anchor" (no per-session AI archetyping at    */
/*  this surface), followed by the three trinity bars (POWER, WARMTH,        */
/*  PRESENCE). No narrative, no pace, no sticky topic. The dashboard is     */
/*  meant to be a quiet anchor, not a wall of text.                          */
/* -------------------------------------------------------------------------- */

export interface DashboardBubbleData {
  trinity: { power: number; warmth: number; presence: number };
}

const ARCHETYPE_LABEL = "The Calm Anchor";

export function DashboardBubble({ data }: { data: DashboardBubbleData }) {
  const trinityBars: Array<[string, number]> = [
    ["Power", data.trinity.power],
    ["Warmth", data.trinity.warmth],
    ["Presence", data.trinity.presence],
  ];
  return (
    <BubbleShell>
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-semibold text-foreground">
        <span className="dash-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        {ARCHETYPE_LABEL}
      </span>
      <div className="mt-3 space-y-1.5">
        {trinityBars.map(([label, val]) => {
          const pct = Math.max(0, Math.min(1, val));
          return (
            <div key={label} className="flex items-center gap-2">
              <span className="w-16 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-foreground">
                {Math.round(pct * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  TextBubble — plain bot text in a chat bubble                              */
/* -------------------------------------------------------------------------- */

export function TextBubble({ children }: { children: React.ReactNode }) {
  return (
    <BubbleShell>
      <div className="text-[13px] leading-relaxed text-foreground">{children}</div>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  AcousticMetricsBubble                                                     */
/*                                                                            */
/*  Shown the moment the cold-start recording hits its 30-second cap. Renders*/
/*  raw aggregate acoustic numbers (WPM, pitch, flow, etc.) inside a chat    */
/*  bubble — NO human-coach interpretation yet, that's what the email is    */
/*  for. Drives the "we need a human to give meaning to that raw data" ask  */
/*  immediately below it in the chat thread.                                 */
/* -------------------------------------------------------------------------- */

export interface AcousticMetricsBubbleData {
  /** Words per minute across the full 30s recording. */
  wpm: number | null;
  /** Pitch centre — either a label ("B3") or a number ("195 Hz"). */
  pitch: string | null;
  /** 0..1 — smoothness of delivery (low pauses / fillers = high flow). */
  flow: number | null;
  /** Filler word count for the whole recording. */
  fillers: number | null;
  /** Dynamic range in dB. */
  dynamicDb: number | null;
  /** 0..1 — relative vocal energy. */
  energy: number | null;
}

export function AcousticMetricsBubble({
  metrics,
}: {
  metrics: AcousticMetricsBubbleData;
}) {
  const items: Array<{
    label: string;
    value: string;
    Icon: typeof Activity;
    pctBar?: number;
  }> = [];
  if (metrics.wpm != null) {
    items.push({
      label: "Words / minute",
      value: `${Math.round(metrics.wpm)}`,
      Icon: Gauge,
    });
  }
  if (metrics.pitch) {
    items.push({
      label: "Pitch centre",
      value: metrics.pitch,
      Icon: Waves,
    });
  }
  if (metrics.flow != null) {
    const pct = Math.max(0, Math.min(1, metrics.flow));
    items.push({
      label: "Flow",
      value: `${Math.round(pct * 100)}%`,
      Icon: Activity,
      pctBar: pct,
    });
  }
  if (metrics.fillers != null) {
    items.push({
      label: "Fillers",
      value: String(metrics.fillers),
      Icon: Activity,
    });
  }
  if (metrics.dynamicDb != null) {
    items.push({
      label: "Dynamic range",
      value: `${metrics.dynamicDb.toFixed(1)} dB`,
      Icon: Waves,
    });
  }
  if (metrics.energy != null) {
    const pct = Math.max(0, Math.min(1, metrics.energy));
    items.push({
      label: "Energy",
      value: `${Math.round(pct * 100)}%`,
      Icon: Activity,
      pctBar: pct,
    });
  }

  return (
    <BubbleShell>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Acoustic profile · raw
      </p>
      <h3 className="mt-1 text-base font-semibold text-foreground">
        Here&apos;s what your voice did for the last 30 seconds.
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-background/60 px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <item.Icon className="h-3 w-3" aria-hidden />
              {item.label}
            </div>
            <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
              {item.value}
            </div>
            {item.pctBar != null && (
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${item.pctBar * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <p className="mt-3 text-xs italic text-muted-foreground">
          Acoustic metrics are still being computed.
        </p>
      )}
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  TypingBubble                                                              */
/*                                                                            */
/*  Three bouncing dots inside a bot bubble — used when the chat is waiting */
/*  on a backend response (e.g. compiling acoustic metrics or fetching the  */
/*  KB-backed Q&A answer). Mirrors the bot-bubble look so it reads as the   */
/*  coach "thinking", not a generic spinner.                                 */
/* -------------------------------------------------------------------------- */

export function TypingBubble() {
  return (
    <BubbleShell>
      <div
        className="flex items-center gap-1 px-1 py-1"
        aria-label="Composing reply"
      >
        {[0, 120, 240].map((delay) => (
          <span
            key={delay}
            className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
            style={{
              animation: "fade-in 0.9s ease-in-out infinite alternate",
              animationDelay: `${delay}ms`,
            }}
          />
        ))}
      </div>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  MicButton                                                                  */
/*                                                                            */
/*  Default bottom-slot control for the non-recording surface (welcome_back, */
/*  q_and_a, reviewing) per the matrix's "mic default" rule. A single tap   */
/*  starts a browser-native SpeechRecognition session. The Web Speech API   */
/*  auto-stops on silence (or when the user taps again) and fires `onresult`*/
/*  with the transcript, which the parent treats as if the user had typed   */
/*  the same string into the legacy QAInput — i.e. it routes through the    */
/*  same handleComposerSubmit pipeline (which branches to handleQASend or   */
/*  handleFollowUpReply based on `pendingFollowUp`).                         */
/*                                                                            */
/*  Browser support — `webkitSpeechRecognition` works in Chromium-based     */
/*  browsers and Safari. Firefox/older browsers fall back to a short        */
/*  "voice input isn't supported, type instead" notice with a manual text  */
/*  field so the user is never blocked. Falling back to text in-place keeps */
/*  the bottom-slot contract clean — caller doesn't have to detect support */
/*  and pick a different mode.                                              */
/* -------------------------------------------------------------------------- */

// `webkitSpeechRecognition` is a webkit prefix that TypeScript doesn't know
// about. Minimal local typings cover only the surface we use; full Web Speech
// API types live in `@types/dom-speech-recognition` if richer typing becomes
// necessary later.
type SpeechRecognitionResult = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResult) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function MicButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [fallbackText, setFallbackText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Probe support on mount only — Web Speech API is constructed lazily on
  // first tap, but we need the support flag for the unsupported-browser
  // fallback render.
  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const startRecording = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) onTranscript(transcript);
      setRecording(false);
      recognitionRef.current = null;
    };
    r.onerror = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    r.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = r;
    setRecording(true);
    r.start();
  };

  // Unsupported-browser fallback: small text input so the user is never
  // blocked. Same submit semantics as the mic — emits a transcript-shaped
  // string through onTranscript.
  if (supported === false) {
    const sendFallback = () => {
      const trimmed = fallbackText.trim();
      if (!trimmed || disabled) return;
      onTranscript(trimmed);
      setFallbackText("");
    };
    return (
      <div className="flex w-full max-w-2xl items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm focus-within:border-primary/50">
        <input
          type="text"
          value={fallbackText}
          onChange={(e) => setFallbackText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendFallback();
            }
          }}
          placeholder="Voice input isn't supported — type instead"
          disabled={disabled}
          className="flex-1 border-0 bg-transparent py-1.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:opacity-60"
        />
        <Button
          type="button"
          size="sm"
          onClick={sendFallback}
          disabled={disabled || fallbackText.trim().length === 0}
          className="h-9 w-9 shrink-0 rounded-full p-0"
          aria-label="Send"
        >
          <Send className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={disabled || supported === null}
      aria-label={recording ? "Stop recording" : "Start voice input"}
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
        recording
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : "bg-primary text-primary-foreground hover:shadow-xl",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      {recording ? (
        <Square className="h-5 w-5" aria-hidden fill="currentColor" />
      ) : (
        <Mic className="h-6 w-6" aria-hidden />
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  UploadButton                                                               */
/*                                                                            */
/*  Override-B slot. When `show_upload_ui: true` lands from /chat/query,    */
/*  the toolbar swaps the mic for this paperclip-on-a-button + a native     */
/*  hidden file input. Picked file is forwarded to the parent's upload     */
/*  handler exactly like the QAInput paperclip did, just without the text  */
/*  composer alongside it. Per Rule G, this slot is per-turn — the parent  */
/*  resets `showUploadUi` in `finally` so the mic comes back on the next   */
/*  unrelated turn.                                                          */
/* -------------------------------------------------------------------------- */

export function UploadButton({
  onUploadFile,
  uploading = false,
  disabled,
}: {
  onUploadFile: (file: File) => void;
  uploading?: boolean;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov"
        onChange={onFileChange}
        className="hidden"
        aria-hidden
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        aria-label="Upload an audio or video file"
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
          "bg-primary text-primary-foreground hover:shadow-xl",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        ) : (
          <Paperclip className="h-6 w-6" aria-hidden />
        )}
      </button>
    </>
  );
}

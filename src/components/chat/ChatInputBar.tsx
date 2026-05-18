"use client";

import { Loader2, Mic, MicOff, Paperclip, Send } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isDualCaptureSupported,
  useDualCaptureMic,
} from "@/hooks/useDualCaptureMic";
import {
  hasCasualVoiceConsent,
  setCasualVoiceConsent,
} from "@/lib/chat/casualVoiceConsent";
import { CasualVoiceConsentModal } from "@/components/chat/CasualVoiceConsentModal";

/* -------------------------------------------------------------------------- */
/*  ChatInputBar — composer for The Lounge (FE Prompt 3)                     */
/*                                                                            */
/*  Layout (left→right):                                                      */
/*    [paperclip?]  [textarea]  [mic?]  [send]                                */
/*                                                                            */
/*  Paperclip — Rule G, default-hidden, parent passes `onUploadFile` only    */
/*    when backend signals `show_upload_ui: true` on the last /chat/query.   */
/*  Textarea — always present. During recording its `value` is driven by    */
/*    the dual-capture hook's `partialText` (live Web Speech transcript).   */
/*    After stop, `finalText` becomes editable starting text. The user-     */
/*    visible string IS the message sent to the LLM (C4 contract).          */
/*  Mic — only rendered when Web Speech AND a usable webm MediaRecorder    */
/*    mimeType are BOTH supported (C2). Tap to start/stop. Browser-         */
/*    native indicator clears within ~1s of stop or cancel (C5).            */
/*  Send — disabled until text.trim().length > 0. On click composes the    */
/*    payload: if mic.state is "stopped" the audio blob + duration are     */
/*    included → multipart request. Otherwise plain JSON request.          */
/*                                                                            */
/*  First-time consent — when the user first taps the mic and             */
/*    localStorage["casualVoiceConsent"] is unset, the modal opens INSTEAD */
/*    of starting capture. Accept → flag set + capture starts. Decline →  */
/*    modal closes, capture never started.                                  */
/* -------------------------------------------------------------------------- */

export interface ChatInputBarSendArgs {
  /** What the user saw and intended to send. */
  text: string;
  /** Raw mic capture, only present when the user actually used the
   *  mic on this turn. null on plain-text sends (C1 JSON path). */
  audioBlob: Blob | null;
  /** Recording duration in seconds, only present alongside audioBlob. */
  durationSec: number | null;
}

interface ChatInputBarProps {
  onSend: (args: ChatInputBarSendArgs) => void;
  /** True while a parent-side send is in flight — locks composer +
   *  mic so the user can't double-fire. */
  submitting?: boolean;
  /** Rule G — paperclip is rendered only when this is set. */
  onUploadFile?: (file: File) => void;
  /** True while a user-initiated file upload is in flight. */
  uploading?: boolean;
  placeholder?: string;
}

export function ChatInputBar({
  onSend,
  submitting = false,
  onUploadFile,
  uploading = false,
  placeholder = "Ask anything about your voice analysis…",
}: ChatInputBarProps) {
  // Feature-detection runs on mount, not at module scope, so SSR
  // markup doesn't depend on `window` and we avoid hydration drift.
  // Initial render = no mic; first useEffect tick swaps in the
  // probed value.
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(isDualCaptureSupported());
  }, []);

  const mic = useDualCaptureMic();
  const [text, setText] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mirror dual-capture state into the visible input. During
  // recording the partial transcript overwrites whatever the user
  // had typed — the visible string is the contract (C4), there's
  // no "type + speak to extend" mode. After stop, finalText becomes
  // an editable starting point.
  useEffect(() => {
    if (mic.state.status === "recording") {
      setText(mic.state.partialText);
    } else if (mic.state.status === "stopped") {
      setText(mic.state.finalText);
    }
  }, [mic.state]);

  // Cancel on Esc + window blur + pagehide. Each path tears down
  // getUserMedia inside the hook, releasing the OS mic indicator
  // within ~1s (C5). Only attached while actively recording so we
  // don't capture Esc/blur on the idle surface.
  useEffect(() => {
    if (mic.state.status !== "recording") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") mic.cancel();
    };
    const onBlur = () => mic.cancel();
    const onPageHide = () => mic.cancel();
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [mic.state.status, mic]);

  const handleMicClick = () => {
    if (mic.state.status === "recording") {
      void mic.stop();
      return;
    }
    if (!hasCasualVoiceConsent()) {
      setConsentOpen(true);
      return;
    }
    void mic.start();
  };

  const handleConsentAccept = () => {
    setCasualVoiceConsent();
    setConsentOpen(false);
    void mic.start();
  };

  const handleConsentDecline = () => {
    setConsentOpen(false);
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || submitting || uploading) return;
    const audioBlob =
      mic.state.status === "stopped" ? mic.state.audioBlob : null;
    const durationSec =
      mic.state.status === "stopped" ? mic.state.durationSec : null;
    onSend({ text: trimmed, audioBlob, durationSec });
    setText("");
    mic.cancel();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) onUploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const recording = mic.state.status === "recording";
  const errorMessage =
    mic.state.status === "error" ? mic.state.message : null;

  return (
    <>
      <div className="flex w-full max-w-2xl flex-col gap-1">
        {errorMessage && (
          <p role="alert" className="px-2 text-xs text-destructive">
            {errorMessage}
          </p>
        )}
        <div className="flex w-full items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm focus-within:border-primary/50">
          {onUploadFile && (
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
                disabled={submitting || uploading || recording}
                aria-label="Upload an audio or video file"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Paperclip className="h-4 w-4" aria-hidden />
                )}
              </button>
            </>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={recording ? "Listening…" : placeholder}
            rows={1}
            disabled={submitting || uploading}
            className="flex-1 resize-none border-0 bg-transparent py-1.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:opacity-60"
          />
          {supported && (
            <button
              type="button"
              onClick={handleMicClick}
              disabled={submitting || uploading}
              aria-label={recording ? "Stop recording" : "Start voice input"}
              aria-pressed={recording}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                recording
                  ? "animate-pulse bg-destructive text-destructive-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {recording ? (
                <MicOff className="h-4 w-4" aria-hidden />
              ) : (
                <Mic className="h-4 w-4" aria-hidden />
              )}
            </button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={send}
            disabled={submitting || uploading || text.trim().length === 0}
            className="h-9 w-9 shrink-0 rounded-full p-0"
            aria-label="Send"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
      </div>
      <CasualVoiceConsentModal
        open={consentOpen}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
      />
    </>
  );
}

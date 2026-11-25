"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { ArrowUp, File, Image as ImageIcon, Mic, Paperclip, Square, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { coerceTargetSeconds, formatRecordingClock } from "../willabHelpers";

type KeepDraft = void | boolean | Promise<void | boolean>;

type PickAttachment = {
  label: string;
  accept?: string;
  scope?: string;
  sendFile: (file: File) => KeepDraft;
};

export type ComposerFileAction = PickAttachment | {
  label: string;
  open: () => void;
};

export type ComposerMic = {
  start: () => void;
  label?: string;
  disabled?: boolean;
  ready?: boolean;
  attrs?: Partial<Record<`data-${string}`, string>>;
};

export type ComposerRecording = {
  elapsedMs: number;
  targetSeconds?: number | string | null;
  stop?: () => void;
  discard?: () => void;
  stopLabel?: string;
  center?: ReactNode;
  attrs?: Partial<Record<`data-${string}`, string>>;
};

export type ComposerVoiceDraft = {
  preview: ReactNode;
  send: () => KeepDraft;
  discard: () => void;
};

export type ChatComposerProps = {
  placeholder?: string;
  inputLabel?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
  value?: string;
  initialValue?: string;
  onValue?: (draft: string) => void;
  onSend?: (draft: string) => KeepDraft;
  sendLabel?: string;
  autoFocus?: boolean;
  maxLength?: number;
  newlines?: boolean;
  busy?: boolean;
  textDisabled?: boolean;
  voiceRequired?: boolean;
  mic?: ComposerMic;
  recording?: ComposerRecording;
  voiceDraft?: ComposerVoiceDraft;
  files?: readonly ComposerFileAction[];
  above?: ReactNode;
  status?: ReactNode;
  className?: string;
  formAttrs?: Record<`data-${string}`, string>;
};

const COMPOSER_COPY = {
  en: {
    message: "Message", send: "Send", files: "Add files", remove: "Remove attachment",
    start: "Start recording", stop: "Stop", recording: "Recording",
    answer: "Record your answer", ready: "Recording ready", queued: "For next message",
    discard: "Discard recording", trash: "Throw it away", failed: "Could not send. Try again.",
  },
  pl: {
    message: "Wiadomość", send: "Wyślij", files: "Dodaj pliki", remove: "Usuń załącznik",
    start: "Zacznij nagrywać", stop: "Zatrzymaj", recording: "Nagrywanie",
    answer: "Nagraj odpowiedź", ready: "Nagranie gotowe", queued: "Do następnej wiadomości",
    discard: "Usuń nagranie", trash: "Odrzuć nagranie", failed: "Nie udało się wysłać. Spróbuj ponownie.",
  },
};
const CONTROL = "flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:text-muted-foreground/50 disabled:hover:bg-transparent";
const REMOVE = "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [@media(pointer:coarse)]:size-11";
const NO_FILES: readonly ComposerFileAction[] = [];

type StagedFile = { file: File; choice: PickAttachment };

/** The three slots stay mounted as a chat moves from writing to capturing. */
export default function ChatComposer({
  placeholder,
  inputLabel,
  inputRef,
  value,
  initialValue = "",
  onValue,
  onSend,
  sendLabel,
  autoFocus,
  maxLength,
  newlines,
  busy,
  textDisabled,
  voiceRequired,
  mic,
  recording,
  voiceDraft,
  files = NO_FILES,
  above,
  status,
  className,
  formAttrs,
}: ChatComposerProps) {
  const copy = COMPOSER_COPY[useUiLocale()];
  const [localDraft, setLocalDraft] = useState(initialValue);
  const [stagedFile, setStagedFile] = useState<StagedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitted = useRef(false);
  const text = value ?? localDraft;
  const latestText = useRef(text);
  latestText.current = text;
  const field = useRef<HTMLTextAreaElement | null>(null);
  const updateText = onValue ?? setLocalDraft;
  const canType = onSend !== undefined && !textDisabled && !voiceRequired && !recording;
  const fileAction = stagedFile && files.find((action): action is PickAttachment =>
    "sendFile" in action && action.label === stagedFile.choice.label && action.scope === stagedFile.choice.scope);
  const typed = canType ? text.trim() : "";
  const sendable = voiceRequired ? voiceDraft : voiceDraft ?? fileAction ?? typed;
  const ready = !recording && Boolean(sendable);
  const canSubmit = ready && !busy && !submitting;

  function setField(node: HTMLTextAreaElement | null) {
    field.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) inputRef.current = node;
  }

  useEffect(() => {
    const el = field.current;
    if (!el || recording) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [recording, text]);

  useEffect(() => {
    if (autoFocus && canType) field.current?.focus();
  }, [autoFocus, canType]);

  async function send() {
    if (!canSubmit || submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    setFailed(false);
    try {
      if (voiceDraft) {
        if (await voiceDraft.send() === false) setFailed(true);
        return;
      }
      if (voiceRequired) return;
      if (fileAction && stagedFile) {
        if (await fileAction.sendFile(stagedFile.file) === false) {
          setFailed(true);
          return;
        }
        setStagedFile((current) => current === stagedFile ? null : current);
        return;
      }
      if (!typed || !onSend) return;
      if (await onSend(text) === false) {
        field.current?.focus();
        setFailed(true);
        return;
      }
      if (value === undefined && latestText.current === text) updateText("");
    } catch {
      setFailed(true);
    } finally {
      submitted.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div data-chat-bar="" className={cn("min-w-0 shrink-0 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]", className)}>
      {above}
      <ComposerDrafts stagedFile={stagedFile} voiceDraft={recording ? undefined : voiceDraft}
        queued={Boolean(voiceRequired || recording || !fileAction)} locked={submitting}
        onRemoveFile={() => setStagedFile(null)} />
      <SendStatus status={status} failed={failed && ready} label={copy.failed} />
      <form {...formAttrs} data-chat-composer="" data-chat-box="" aria-busy={Boolean(busy || submitting)}
        className="flex min-h-[54px] min-w-0 items-center gap-px rounded-[28px] border border-border bg-background p-1 focus-within:border-muted-foreground"
        onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <FilesSlot files={files} onPick={setStagedFile} disabled={submitting} />
        {recording ? <RecordingCenter recording={recording} /> : null}
        <ComposerField inputRef={setField} hidden={Boolean(recording)} disabled={!canType}
          value={voiceRequired ? "" : text} onValue={updateText} label={inputLabel ?? placeholder ?? copy.message}
          placeholder={composerPlaceholder(copy, voiceRequired, voiceDraft, placeholder)}
          maxLength={maxLength} newlines={newlines} send={send} />
        {ready ? (
          <button type="submit" data-chat-send="" aria-label={sendLabel ?? copy.send} disabled={!canSubmit}
            className={cn(CONTROL, "bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted")}>
            <ArrowUp className="size-5" aria-hidden />
          </button>
        ) : null}
        <MicSlot mic={mic} recording={recording} required={voiceRequired} submitting={submitting} />
      </form>
    </div>
  );
}

function SendStatus({ status, failed, label }: { status?: ReactNode; failed: boolean; label: string }) {
  return status ?? (failed ? <p role="alert" className="px-2 pb-1 text-sm text-destructive">{label}</p> : null);
}

function composerPlaceholder(copy: typeof COMPOSER_COPY.en, voiceRequired?: boolean, voiceDraft?: ComposerVoiceDraft, placeholder?: string) {
  if (voiceRequired) return voiceDraft ? copy.ready : copy.answer;
  return placeholder ?? copy.message;
}

function ComposerField({ inputRef, value, onValue, label, placeholder, hidden, disabled, maxLength, newlines, send }: {
  inputRef: Ref<HTMLTextAreaElement>;
  value: string;
  onValue: (draft: string) => void;
  label: string;
  placeholder: string;
  hidden: boolean;
  disabled: boolean;
  maxLength?: number;
  newlines?: boolean;
  send: () => Promise<void>;
}) {
  return (
    <textarea ref={inputRef} data-chat-input="" rows={1} hidden={hidden} disabled={disabled}
      aria-label={label} placeholder={placeholder} maxLength={maxLength}
      value={value} onChange={(event) => onValue(event.target.value)}
      enterKeyHint={newlines ? "enter" : "send"} autoComplete="off" autoCorrect="on" autoCapitalize="sentences" spellCheck
      className="scrollbar-none max-h-40 min-h-[42px] min-w-0 flex-1 resize-none overflow-x-hidden bg-transparent px-1 py-2.5 text-base leading-5 text-foreground outline-none placeholder:text-muted-foreground disabled:text-muted-foreground"
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !newlines) {
          event.preventDefault();
          void send();
        }
      }}
    />
  );
}

function ComposerDrafts({ stagedFile, voiceDraft, queued, locked, onRemoveFile }: {
  stagedFile: StagedFile | null;
  voiceDraft?: ComposerVoiceDraft;
  queued: boolean;
  locked: boolean;
  onRemoveFile: () => void;
}) {
  const copy = COMPOSER_COPY[useUiLocale()];
  if (!stagedFile && !voiceDraft) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5 text-sm">
      {stagedFile ? (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-xl bg-muted pl-2">
          <File className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{stagedFile.file.name}</span>
          {queued ? <span className="text-muted-foreground">{copy.queued}</span> : null}
          <button type="button" className={REMOVE} aria-label={copy.remove} disabled={locked} onClick={onRemoveFile}>
            <X className="size-4" aria-hidden />
          </button>
        </span>
      ) : null}
      {voiceDraft ? (
        <span className="inline-flex max-w-full items-center gap-1 rounded-xl bg-muted">
          {voiceDraft.preview}
          <button type="button" className={REMOVE} aria-label={copy.discard} disabled={locked} onClick={voiceDraft.discard}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </span>
      ) : null}
    </div>
  );
}

function FilesSlot({ files, onPick, disabled }: {
  files: readonly ComposerFileAction[];
  onPick: (file: StagedFile) => void;
  disabled: boolean;
}) {
  const copy = COMPOSER_COPY[useUiLocale()];
  const [open, setOpen] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const choice = useRef<PickAttachment | null>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !slot.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function select(action: ComposerFileAction) {
    setOpen(false);
    trigger.current?.focus();
    if ("open" in action) {
      action.open();
    } else if (picker.current) {
      choice.current = action;
      picker.current.accept = action.accept ?? "";
      picker.current.click();
    }
  }

  return (
    <div ref={slot} className="relative shrink-0" onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    }}>
      <button ref={trigger} type="button" className={CONTROL} aria-label={copy.files} title={copy.files} data-chat-files=""
        aria-expanded={open} disabled={disabled || !files.length} onClick={() => setOpen((shown) => !shown)}>
        <Paperclip className="size-[18px]" aria-hidden />
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 z-20 mb-2 grid min-w-44 rounded-xl border border-border bg-background p-1 text-sm text-foreground shadow-lg">
          {files.map((action) => (
            <button key={action.label} type="button" onClick={() => select(action)}
              className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 text-left hover:bg-muted">
              {"accept" in action && action.accept?.startsWith("image/") ? <ImageIcon className="size-4" aria-hidden /> : <File className="size-4" aria-hidden />}
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {files.some((action) => "sendFile" in action) ? <input ref={picker} type="file" hidden data-chat-file-pick="" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file && choice.current) onPick({ file, choice: choice.current });
        choice.current = null;
      }} /> : null}
    </div>
  );
}

function MicSlot({ mic, recording, required, submitting }: {
  mic?: ComposerMic;
  recording?: ComposerRecording;
  required?: boolean;
  submitting: boolean;
}) {
  const copy = COMPOSER_COPY[useUiLocale()];
  const label = recording ? recording.stopLabel ?? copy.stop : mic?.label ?? copy.start;
  const disabled = recording ? !recording.stop : !mic || mic.disabled || submitting;
  const ready = !recording && mic?.ready && !disabled;
  return (
    <button {...(recording ? recording.attrs : mic?.attrs)} type="button" data-chat-mic="" aria-label={label} title={label}
      data-recording={recording ? "" : undefined} disabled={disabled}
      data-practice-ready={ready ? "" : undefined}
      onClick={recording ? recording.stop : mic?.start}
      className={cn(CONTROL, recording ? "bg-destructive/10 text-destructive hover:bg-destructive/15" :
        required && mic ? "bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted" :
          ready ? "bg-primary text-primary-foreground hover:bg-primary/90" : undefined)}>
      {recording ? <Square className="size-4 fill-current" aria-hidden /> : <Mic className="size-5" aria-hidden />}
    </button>
  );
}

function RecordingCenter({ recording }: { recording: ComposerRecording }) {
  const copy = COMPOSER_COPY[useUiLocale()];
  const seconds = recording.elapsedMs / 1000;
  const target = coerceTargetSeconds(recording.targetSeconds ?? null);
  const elapsed = formatRecordingClock(seconds, target);
  return (
    <div data-chat-capture="" className="flex min-w-0 flex-1 items-center gap-1 pl-1 text-sm sm:gap-2">
      {recording.center ?? <>
        <span className="truncate">{copy.recording}</span>
        <span className={cn("shrink-0 tabular-nums", elapsed.overrun && "text-destructive")}>{elapsed.label}</span>
        {target ? (
          <span className="hidden h-1 flex-1 overflow-hidden rounded-full bg-border min-[340px]:block" aria-hidden>
            <span className={cn("block h-full rounded-full", elapsed.overrun ? "bg-destructive" : "bg-primary")}
              style={{ width: `${Math.min(100, seconds / target * 100)}%` }} />
          </span>
        ) : <span className="hidden flex-1 items-center justify-center gap-0.5 min-[340px]:flex" aria-hidden>
          {[8, 14, 20, 12, 18, 10, 14].map((height, index) => (
            <span key={index} className="w-0.5 rounded-full bg-destructive" style={{ height }} />
          ))}
        </span>}
      </>}
      {recording.discard ? (
        <button type="button" className={cn(REMOVE, "ml-auto")} aria-label={copy.trash} onClick={recording.discard}>
          <Trash2 className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

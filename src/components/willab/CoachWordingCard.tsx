"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { readPractiseOffered } from "@/services/api/consentChoices";
import { coachWording, readSavedCoachWording, saveCoachWording, type CoachWording } from "@/services/api/coachWording";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import ChatComposer from "./chats/ChatComposer";
import WalkPlayer from "./walk/WalkPlayer";
import { useVoiceNote } from "./useVoiceNote";

const COPY = {
  en: { practise: "Practise", save: "Save wording", saved: "Saved wording", saving: "Saving…",
    failed: "Couldn’t save. Try again.", unavailable: "Practise isn’t available.", attempt: "Your try" },
  pl: { practise: "Przećwicz", save: "Zapisz wersję", saved: "Zapisana wersja", saving: "Zapisywanie…",
    failed: "Nie udało się zapisać. Spróbuj ponownie.", unavailable: "Ćwiczenie jest niedostępne.", attempt: "Twoja próba" },
};

const CONTROL = "min-h-11 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50";
const activeRehearsals = new WeakSet<HTMLElement>();

export function useSavedCoachWording({ arcId, initArc, account, signedIn, takeIndex, entering }: {
  arcId: string | null;
  initArc: { arcId?: string | null } | null;
  account?: string | null;
  signedIn: boolean | null;
  takeIndex: number;
  entering: boolean;
}) {
  const arc = signedIn === true && entering && takeIndex > 1 ? arcId ?? initArc?.arcId ?? null : null;
  const [saved, setSaved] = useState<{ arc: string; account: string; wording: CoachWording | null } | null>(null);
  useEffect(() => {
    if (!arc || !account) return;
    let current = true;
    void readSavedCoachWording(arc).then((wording) => {
      if (current) setSaved({ arc, account, wording });
    }).catch(() => undefined);
    return () => { current = false; };
  }, [arc, account]);
  return saved?.arc === arc && saved?.account === account ? saved.wording : null;
}

export function SavedCoachWording({ wording }: { wording: CoachWording }) {
  const label = COPY[useUiLocale()].saved;
  return <details data-saved-wording-cue className="mb-1 min-w-0 rounded-lg bg-muted px-3 text-sm">
    <summary className="min-h-11 cursor-pointer content-center">{label}</summary>
    <p className="break-words pb-2">{wording.words}</p>
    {wording.delivery ? <p className="pb-2 text-muted-foreground">{wording.delivery}</p> : null}
  </details>;
}

function PhrasePractise({ dock }: { dock: HTMLDivElement }) {
  const copy = COPY[useUiLocale()];
  const [attempt, setAttempt] = useState<{ url: string; ms: number } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const ownsDock = useRef(false);
  const mounted = useRef(false);
  const voice = useVoiceNote({
    maxSeconds: 25,
    onDone: async ({ audio, durationMs }) => {
      if (mounted.current) setAttempt({ url: URL.createObjectURL(audio), ms: durationMs });
    },
    onUnavailable: () => setUnavailable(true),
  });

  function releaseDock() {
    if (!ownsDock.current) return;
    activeRehearsals.delete(dock);
    ownsDock.current = false;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      releaseDock();
    };
    // The dock is the recording surface for this card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dock]);
  useEffect(() => {
    if (voice.phase === "idle" && !waiting) releaseDock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.phase, waiting]);
  useEffect(() => () => { if (attempt) URL.revokeObjectURL(attempt.url); }, [attempt]);

  async function start() {
    if (activeRehearsals.has(dock) || dock.childElementCount || voice.phase !== "idle") return;
    activeRehearsals.add(dock);
    ownsDock.current = true;
    setWaiting(true);
    setUnavailable(false);
    try {
      const offered = await readPractiseOffered();
      if (!mounted.current) return;
      if (offered && !dock.childElementCount) await voice.start();
      else if (!offered) setUnavailable(true);
    } catch {
      if (mounted.current) setUnavailable(true);
    } finally {
      if (mounted.current) setWaiting(false);
    }
  }

  return <>
    <button type="button" className={CONTROL} disabled={waiting || voice.phase !== "idle"}
      onClick={() => void start()}>{copy.practise}</button>
    {unavailable ? <span role="status" className="text-sm text-muted-foreground">{copy.unavailable}</span> : null}
    {voice.phase === "recording" ? createPortal(<ChatComposer recording={{
      elapsedMs: voice.elapsedMs, stop: voice.send, discard: voice.cancel,
    }} />, dock) : null}
    {attempt && voice.phase === "idle" ? <WalkPlayer seed={attempt.url} src={attempt.url}
      durationMs={attempt.ms} label={copy.attempt} look="bare" /> : null}
  </>;
}

function SaveWording({ arc, replyId, onSaved }: { arc: string; replyId: string; onSaved?: () => void }) {
  const copy = COPY[useUiLocale()];
  const [state, setState] = useState<"ready" | "saving" | "saved" | "failed">("ready");
  const saving = useRef(false);

  async function save() {
    if (saving.current || state === "saved") return;
    saving.current = true;
    setState("saving");
    const saved = await saveCoachWording(arc, replyId).catch(() => false);
    saving.current = false;
    setState(saved ? "saved" : "failed");
    if (saved) onSaved?.();
  }

  if (state === "saved") return <span role="status" className="text-sm text-muted-foreground">{copy.saved}</span>;
  return <>
    <button type="button" className={CONTROL} disabled={state === "saving"} onClick={() => void save()}>
      {state === "saving" ? copy.saving : copy.save}
    </button>
    {state === "failed" ? <span role="status" className="text-sm text-muted-foreground">{copy.failed}</span> : null}
  </>;
}

export function linkedSavedWordings(messages: readonly LoungeMessage[]) {
  const shown = new Set(messages.filter((row) => row.role === "bot" && coachWording(row.metadata?.coach_wording))
    .map((row) => row.client_id));
  const linked = new Set<string>();
  for (const message of messages) {
    const reply = message.metadata?.wording_reply_id;
    if (message.role === "system" && message.metadata?.coach_wording_saved === true &&
        typeof reply === "string" && shown.has(reply)) linked.add(reply);
  }
  return linked;
}

export default function CoachWordingCard({ message, project, recordingDock, savedReply = false, onSaved }: {
  message: Pick<LoungeMessage, "client_id" | "metadata">;
  project?: string;
  recordingDock?: HTMLDivElement | null;
  savedReply?: boolean;
  onSaved?: () => void;
}) {
  const copy = COPY[useUiLocale()];
  const wording = coachWording(message.metadata?.coach_wording);
  if (!wording || (project && wording.arc_id !== project)) return null;
  const saved = savedReply || message.metadata?.coach_wording_saved === true;
  return <div data-coach-wording className="mr-auto w-full max-w-[440px] space-y-1.5 border-l border-border pl-3 text-[15px]">
    {saved ? <p className="text-sm text-muted-foreground">{copy.saved}</p> : null}
    <blockquote className="whitespace-pre-wrap break-words font-medium">{wording.words}</blockquote>
    {wording.delivery ? <p className="text-sm text-muted-foreground">{wording.delivery}</p> : null}
    <div className="flex flex-wrap items-center gap-2">
      {recordingDock ? <PhrasePractise dock={recordingDock} /> : null}
      {wording.arc_id && !saved ? <SaveWording arc={wording.arc_id} replyId={message.client_id} onSaved={onSaved} /> : null}
    </div>
  </div>;
}

"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { FileUp } from "lucide-react";
import { ACCEPTED_DECK_ACCEPT } from "./presentation";
import { VoiceMark } from "./LoadingState";
import SymmetricPair from "./SymmetricPair";
import WalkToast from "./walk/WalkToast";
import { useUserId } from "./useUserId";
import { UPDATE_SLIDES_COPY } from "@/lib/willab/deckUpdateCopy";
import { uploadNewSlides } from "@/lib/willab/deckUpdate";
import { readExploreArc } from "@/lib/willab/exploreArc";

/* -------------------------------------------------------------------------- */
/*  Update slides (founder 2026-10-29, backend N257; prototype                */
/*  https://claude.ai/artifact/8heRv4BC6fGg7EzuzuTo4A).                       */
/*                                                                            */
/*  Two doors, one upload. On the Ideal Text page the ⋯ menu's "Add slides"   */
/*  or "Update slides" opens a sheet with the signed sentence, "Upload PDF"   */
/*  and "Cancel"; once saved, the toast "New slides ready for Take N." In     */
/*  the chat, Will's answer to a new deck puts a grey card in place of the    */
/*  message box, as the WhatsApp ask does, then Cancel | Upload PDF; once     */
/*  saved, Will says the same line in the thread and the message box comes   */
/*  back. The text itself changes only when the next Take is said.            */
/*                                                                            */
/*  While the PDF goes up the button keeps its label and is held, with the    */
/*  app's voice mark: there is no signed busy word for it.                    */
/* -------------------------------------------------------------------------- */

type SlidesUpload = {
  pick: () => void;
  busy: boolean;
  file: File | null;
  error: string | null;
  input: ReactNode;
};

/** The file picker (PDF only) and the upload behind it. */
function useSlidesUpload(projectId: string, onReady: (nextTake: number | null) => void): SlidesUpload {
  const ownerId = useUserId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (chosen: File) => {
    setFile(chosen);
    setBusy(true);
    setError(null);
    const result = await uploadNewSlides(chosen, { projectId, ownerId });
    setBusy(false);
    if (result.status === "ok") onReady(result.nextTake);
    else setError(result.message);
  };
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_DECK_ACCEPT}
      className="hidden"
      data-testid="update-slides-file"
      onChange={(e) => {
        const chosen = e.target.files?.[0];
        e.target.value = "";
        if (chosen) void send(chosen);
      }}
    />
  );
  return {
    pick: () => {
      if (!busy) inputRef.current?.click();
    },
    busy,
    file,
    error,
    input,
  };
}

/** The chosen PDF, shown while it goes up (the prototype's picker row). */
function PickedFile({ file }: { file: File | null }) {
  if (!file) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-border bg-background p-3">
      <FileUp className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 break-words text-[13px] font-medium text-foreground">{file.name}</span>
    </div>
  );
}

function UploadError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-[13px] text-destructive">
      {error}
    </p>
  );
}

/** The next Take's number when the server did not say it: the device's
 *  cached next Take for this project, else the one after `takeCount`. */
function nextTakeOr(nextTake: number | null, fallback: number): number {
  return nextTake ?? fallback;
}

/* ------------------------------ Ideal Text ------------------------------ */

/** The bottom sheet the ⋯ item opens. */
export function UpdateSlidesSheet({
  title,
  projectId,
  onReady,
  onCancel,
}: {
  title: string;
  projectId: string;
  onReady: (nextTake: number | null) => void;
  onCancel: () => void;
}) {
  const upload = useSlidesUpload(projectId, onReady);
  const close = () => {
    if (!upload.busy) onCancel();
  };
  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-foreground/30"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={close}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <div
        className="flex w-full max-w-lg flex-col gap-3 rounded-t-3xl bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-1" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-foreground/20" />
        </div>
        <h2 className="text-[18px] font-semibold text-foreground">{title}</h2>
        <p className="text-[14px] text-muted-foreground">{UPDATE_SLIDES_COPY.body}</p>
        <PickedFile file={upload.busy ? upload.file : null} />
        <UploadError error={upload.error} />
        {upload.input}
        <button
          type="button"
          onClick={upload.pick}
          disabled={upload.busy}
          aria-busy={upload.busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background hover:bg-foreground/90 disabled:cursor-default"
        >
          {upload.busy ? <VoiceMark size={16} /> : null}
          {UPDATE_SLIDES_COPY.upload}
        </button>
        <button
          type="button"
          onClick={close}
          disabled={upload.busy}
          className="flex h-10 w-full items-center justify-center text-[15px] text-muted-foreground disabled:opacity-60"
        >
          {UPDATE_SLIDES_COPY.cancel}
        </button>
      </div>
    </div>
  );
}

/** The Ideal Text page's door: the ⋯ item ("Add slides" without a deck,
 *  "Update slides" with one), and the sheet and toast it brings. */
export function useUpdateSlides(
  arcId: string,
  sd: { hasDeck: boolean; takeCount: number | null } | null,
): { item: { label: string; onOpen: () => void } | null; layer: ReactNode } {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState<number | null>(null);
  if (!sd) return { item: null, layer: null };
  const label = sd.hasDeck ? UPDATE_SLIDES_COPY.update : UPDATE_SLIDES_COPY.add;
  const layer = (
    <>
      {open ? (
        <UpdateSlidesSheet
          title={label}
          projectId={arcId}
          onCancel={() => setOpen(false)}
          onReady={(nextTake) => {
            setOpen(false);
            setReady(nextTakeOr(nextTake, (sd.takeCount ?? 0) + 1));
          }}
        />
      ) : null}
      {ready !== null ? (
        <WalkToast message={UPDATE_SLIDES_COPY.ready(ready)} onDone={() => setReady(null)} />
      ) : null}
    </>
  );
  return { item: { label, onOpen: () => setOpen(true) }, layer };
}

/* --------------------------------- Chat --------------------------------- */

/** The chat's ask: open while Will's answer offered `update_slides`, for
 *  the project the chat is on. */
export type SlidesAsk = {
  projectId: string | null;
  /** Open the card for the chat's current project; nothing without one. */
  open: () => void;
  close: () => void;
};

export function useSlidesAsk(): SlidesAsk {
  const ownerId = useUserId();
  const [projectId, setProjectId] = useState<string | null>(null);
  const open = useCallback(() => {
    setProjectId(readExploreArc(ownerId)?.arcId ?? null);
  }, [ownerId]);
  const close = useCallback(() => setProjectId(null), []);
  return { projectId, open, close };
}

/** Will's answer carries the `update_slides` action (N257). It is never a
 *  chip: the card takes the message box's place instead. */
export function offersUpdateSlides(raw: unknown): boolean {
  return Array.isArray(raw) && raw.includes("update_slides");
}

/** The grey card and Cancel | Upload PDF, in place of the message box. */
function SlidesAskCard({
  projectId,
  onReady,
  onCancel,
}: {
  projectId: string;
  onReady: (nextTake: number | null) => void;
  onCancel: () => void;
}) {
  const upload = useSlidesUpload(projectId, onReady);
  return (
    <div className="flex flex-col gap-3" data-testid="slides-ask">
      <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
        <p className="text-[13px] font-medium text-foreground">{UPDATE_SLIDES_COPY.update}</p>
        <p className="text-[13px] text-muted-foreground">{UPDATE_SLIDES_COPY.body}</p>
        <PickedFile file={upload.busy ? upload.file : null} />
        <UploadError error={upload.error} />
        {upload.input}
      </div>
      <SymmetricPair
        closeLabel={UPDATE_SLIDES_COPY.cancel}
        onClose={() => {
          if (!upload.busy) onCancel();
        }}
        actionLabel={UPDATE_SLIDES_COPY.upload}
        onAction={upload.pick}
      />
    </div>
  );
}

/** The footer slot: the card while the ask is open, else what is there. */
export function SlidesAskSlot({
  ask,
  onReady,
  children,
}: {
  ask: SlidesAsk;
  /** Will's line in the thread, "New slides ready for Take N." */
  onReady: (line: string) => void;
  children?: ReactNode;
}) {
  const ownerId = useUserId();
  if (!ask.projectId) return <>{children}</>;
  const projectId = ask.projectId;
  return (
    <SlidesAskCard
      projectId={projectId}
      onCancel={ask.close}
      onReady={(nextTake) => {
        const cached = readExploreArc(ownerId);
        const fallback = cached?.arcId === projectId ? cached.nextTakeIndex : 2;
        onReady(UPDATE_SLIDES_COPY.ready(nextTakeOr(nextTake, fallback)));
        ask.close();
      }}
    />
  );
}

/** The message box, gone while the card stands in its place. */
export function SlidesAskComposer({ ask, children }: { ask: SlidesAsk; children?: ReactNode }) {
  if (ask.projectId) return null;
  return <>{children}</>;
}

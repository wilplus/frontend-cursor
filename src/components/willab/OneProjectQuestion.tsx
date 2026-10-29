"use client";

import { useRef, useState, type ReactNode } from "react";
import SymmetricPair from "./SymmetricPair";
import { ONE_PROJECT_COPY } from "@/lib/willab/deckUpdateCopy";
import { PROJECT_ARCHIVE_COPY } from "@/lib/willab/projectArchiveCopy";
import { currentProjectOf } from "@/lib/willab/oneProject";
import { archiveProject, unarchiveProject } from "@/services/api/projectArchive";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";

/* -------------------------------------------------------------------------- */
/*  "One project at a time" (founder 2026-10-29, backend N254).               */
/*                                                                            */
/*  The question asked before the speaker leaves the current project (the    */
/*  one with the newest Take): starting a new project from the "+" or from   */
/*  Will's "Create new project" in the chat (N260), picking                  */
/*  another project there, or "Record Take N" on an archived project's Ideal */
/*  Text. Continue archives the current project and goes on; Cancel stays.   */
/*  The words are the signed ones; a failed archive says so with the words   */
/*  the archive already has, and nothing goes on.                            */
/* -------------------------------------------------------------------------- */

export function OneProjectSheet({
  current,
  busy,
  failed,
  onContinue,
  onCancel,
}: {
  /** The current project's title. */
  current: string;
  busy: boolean;
  failed: boolean;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const cancel = () => {
    if (!busy) onCancel();
  };
  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-foreground/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="one-project-title"
      onClick={cancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") cancel();
      }}
    >
      <div
        className="flex w-full max-w-lg flex-col gap-3 rounded-t-3xl bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-1" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-foreground/20" />
        </div>
        <h2 id="one-project-title" className="text-[18px] font-semibold text-foreground">
          {ONE_PROJECT_COPY.title}
        </h2>
        <p className="text-[14px] text-muted-foreground">{ONE_PROJECT_COPY.body(current)}</p>
        {failed ? (
          <p role="alert" className="text-[13px] text-destructive">
            {PROJECT_ARCHIVE_COPY.archiveFailed}
          </p>
        ) : null}
        <div className="pt-1">
          <SymmetricPair
            closeLabel={ONE_PROJECT_COPY.cancel}
            onClose={cancel}
            actionLabel={ONE_PROJECT_COPY.continue}
            onAction={() => {
              if (!busy) onContinue();
            }}
          />
        </div>
      </div>
    </div>
  );
}

type Pending = {
  current: string;
  /** The server's part of Continue; false = it did not happen. */
  commit: () => Promise<boolean>;
  then: () => void;
};

/** One question at a time: `ask` opens it, `sheet` draws it. Continue runs
 *  the archive (`commit`) and only then goes on (`then`). */
export function useOneProjectQuestion(): {
  ask: (pending: Pending) => void;
  sheet: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const ask = (next: Pending) => {
    setFailed(false);
    setPending(next);
  };
  const sheet = pending ? (
    <OneProjectSheet
      current={pending.current}
      busy={busy}
      failed={failed}
      onCancel={() => setPending(null)}
      onContinue={() => {
        setBusy(true);
        setFailed(false);
        void pending.commit().then((ok) => {
          setBusy(false);
          if (!ok) {
            setFailed(true);
            return;
          }
          setPending(null);
          pending.then();
        });
      }}
    />
  ) : null;
  return { ask, sheet };
}

/** "Record Take N" on an archived project's Ideal Text (N254 item 2): ask
 *  first, then bring this project back, archive the current one, and record
 *  as today. A project that is not archived records at once (Never 3). */
export function useArchivedReturn(
  arcId: string,
  sd: { projectArchived: boolean } | null,
): { confirmFirst: ((go: () => void) => void) | null; layer: ReactNode } {
  const question = useOneProjectQuestion();
  const asking = useRef(false);
  if (!sd?.projectArchived) return { confirmFirst: null, layer: null };
  const confirmFirst = (go: () => void) => {
    if (asking.current) return;
    asking.current = true;
    void fetchTrainings().then(async (list) => {
      asking.current = false;
      const current = currentProjectOf(list ?? [], arcId);
      if (!current) {
        // Nothing else is current: bring this one back and record.
        await unarchiveProject(arcId);
        go();
        return;
      }
      question.ask({
        current: current.topic,
        commit: async () => (await unarchiveProject(arcId)) && (await archiveProject(current.arcId)),
        then: go,
      });
    });
  };
  return { confirmFirst, layer: question.sheet };
}

/** Will's "Create new project" in the chat (N260): with a current project,
 *  the question takes the message box's place, as the WhatsApp ask and the
 *  slides upload do; Continue archives it and starts the new project.
 *  With none, the new project starts at once, as before. */
export type NewProjectAsk = { current: TrainingArc | null; begin: (start: () => void) => void; close: () => void };

export function useNewProjectAsk(): NewProjectAsk & { start: (() => void) | null } {
  const [asked, setAsked] = useState<{ current: TrainingArc; start: () => void } | null>(null);
  const reading = useRef(false);
  const begin = (start: () => void) => {
    if (reading.current) return;
    reading.current = true;
    void fetchTrainings().then((list) => {
      reading.current = false;
      const current = currentProjectOf(list ?? []);
      if (current) setAsked({ current, start });
      else start();
    });
  };
  return { current: asked?.current ?? null, start: asked?.start ?? null, begin, close: () => setAsked(null) };
}

/** The question's card in place of the message box, then Cancel | Continue. */
export function NewProjectAskSlot({ ask, children }: { ask: ReturnType<typeof useNewProjectAsk>; children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { current, start } = ask;
  if (!current || !start) return <>{children}</>;
  return (
    <div className="flex flex-col gap-3" data-testid="new-project-ask">
      <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
        <p className="text-[13px] font-medium text-foreground">{ONE_PROJECT_COPY.title}</p>
        <p className="text-[13px] text-foreground">{ONE_PROJECT_COPY.body(current.topic)}</p>
        {failed ? (
          <p role="alert" className="text-[13px] text-destructive">
            {PROJECT_ARCHIVE_COPY.archiveFailed}
          </p>
        ) : null}
      </div>
      <SymmetricPair
        closeLabel={ONE_PROJECT_COPY.cancel}
        onClose={() => {
          if (busy) return;
          setFailed(false);
          ask.close();
        }}
        actionLabel={ONE_PROJECT_COPY.continue}
        onAction={() => {
          if (busy) return;
          setBusy(true);
          setFailed(false);
          void archiveProject(current.arcId).then((ok) => {
            setBusy(false);
            if (!ok) {
              setFailed(true);
              return;
            }
            ask.close();
            start();
          });
        }}
      />
    </div>
  );
}

/** The message box, gone while the question stands in its place. */
export function NewProjectAskComposer({ ask, children }: { ask: NewProjectAsk; children?: ReactNode }) {
  if (ask.current) return null;
  return <>{children}</>;
}

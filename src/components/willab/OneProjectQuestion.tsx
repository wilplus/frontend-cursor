"use client";

import { useRef, type ReactNode } from "react";
import { unarchiveProject } from "@/services/api/projectArchive";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";

/* -------------------------------------------------------------------------- */
/*  Project concurrency                                                        */
/*                                                                            */
/*  The old one-project question has been retired. Projects stay active       */
/*  together: creating, opening or practising one never archives another.    */
/*  These small compatibility hooks keep the existing recording and Ideal     */
/*  Text call sites on the same project-scoped path while removing that old    */
/*  archive side effect.                                                       */
/* -------------------------------------------------------------------------- */

/** An archived project is restored before recording; another active project
 *  remains active. */
export function useArchivedReturn(
  arcId: string,
  state: { projectArchived: boolean } | null,
): { confirmFirst: ((go: () => void) => void) | null; layer: ReactNode } {
  const asking = useRef(false);
  if (!state?.projectArchived) return { confirmFirst: null, layer: null };
  const confirmFirst = (go: () => void) => {
    if (asking.current) return;
    asking.current = true;
    void fetchTrainings().then(async () => {
      asking.current = false;
      if (await unarchiveProject(arcId)) go();
    });
  };
  return { confirmFirst, layer: null };
}

export type NewProjectAsk = {
  current: TrainingArc | null;
  begin: (start: () => void) => void;
  close: () => void;
};

/** Preserve the call-site contract for the speaking-coach composer. Starting
 *  a project is immediate and never opens an archive confirmation. */
export function useNewProjectAsk(): NewProjectAsk & { start: (() => void) | null } {
  const reading = useRef(false);
  const begin = (start: () => void) => {
    if (reading.current) return;
    reading.current = true;
    reading.current = false;
    start();
  };
  return { current: null, start: null, begin, close: () => undefined };
}

export function NewProjectAskSlot({
  ask,
  children,
}: {
  ask: ReturnType<typeof useNewProjectAsk>;
  children?: ReactNode;
}) {
  void ask;
  return <>{children}</>;
}

export function NewProjectAskComposer({
  ask,
  children,
}: {
  ask: NewProjectAsk;
  children?: ReactNode;
}) {
  void ask;
  return <>{children}</>;
}

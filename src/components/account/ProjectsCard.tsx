"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionLoadingState } from "@/components/willab/LoadingState";
import { ConfirmDelete } from "@/components/willab/ProjectRowMenu";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";
import { unarchiveProject } from "@/services/api/projectArchive";
import {
  cancelProjectDeletion,
  requestProjectDeletion,
} from "@/services/api/projectDeletion";
import {
  PROJECT_DELETE_ENABLED,
  PROJECT_DELETION_COPY,
} from "@/lib/willab/projectDeletionCopy";
import { PROJECT_ARCHIVE_COPY } from "@/lib/willab/projectArchiveCopy";
import { fetchTrainingConsent } from "@/services/api/trainingConsent";
import {
  LEAVING_COPY,
  PROJECT_DELETION_WINDOW_ENABLED,
  deletionDate,
  withTrainingLine,
} from "@/lib/legal/leavingCopy";

/* -------------------------------------------------------------------------- */
/*  Your projects, in Data & consent (founder 2026-09-26, N14).               */
/*                                                                            */
/*  One button opens the list of the person's projects, archived ones         */
/*  included. An archived project says so and can be unarchived. Deleting a   */
/*  project happens here, never on the project picker: Delete asks first with */
/*  the signed words (N8) and sends nothing until "Request deletion"; a       */
/*  pending request can be cancelled; a confirmed one cannot. Delete stays    */
/*  off (PROJECT_DELETE_ENABLED) until a deletion can finish.                 */
/*                                                                            */
/*  For a person with an active training yes the confirm ends with the        */
/*  signed "A model already trained stays." (W5 A, N50; it retired N10's      */
/*  sentence, TC-7b). Since N48.4 Q17 A the backend says whether a request    */
/*  can still be cancelled; the 7-day window's words are signed (W4 A) and go */
/*  on with Delete itself (PROJECT_DELETION_WINDOW_ENABLED, leavingCopy.ts).  */
/* -------------------------------------------------------------------------- */

const ARCHIVE = PROJECT_ARCHIVE_COPY;
const DELETION = PROJECT_DELETION_COPY;

/** The settings prototype's outline buttons (.ob/.obs) hover grey, not the
 *  outline variant's orange, and keep their text colour (D-CS-6). */
export const QUIET_HOVER = "hover:bg-muted hover:text-foreground";

/** The confirm's body: N8's, or with the window on its first sentence and
 *  the window's words; an active training yes adds W5's line at the end. */
export function projectConfirmBody(
  trainingYes: boolean,
  windowEnabled: boolean = PROJECT_DELETION_WINDOW_ENABLED,
): string {
  const body = windowEnabled
    ? `${DELETION.bodyFirstSentence} ${LEAVING_COPY.projectWindow}`
    : DELETION.body;
  return withTrainingLine(body, trainingYes);
}

/** A pending row's label: the day it completes once the window's words are
 *  signed and the day is still ahead, "Deletion pending" otherwise. */
export function pendingLabel(
  dueAt: string | null,
  windowEnabled: boolean = PROJECT_DELETION_WINDOW_ENABLED,
): string {
  const date = windowEnabled ? deletionDate(dueAt) : null;
  return date ? LEAVING_COPY.projectDeletedOn(date) : DELETION.pending;
}

export default function ProjectsCard() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<TrainingArc[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<TrainingArc | null>(null);
  const [rowFailed, setRowFailed] = useState<string | null>(null);
  // An active training yes, read with the list. Unknown reads as no: the
  // body without W5's line, which is what everyone saw before training.
  const [trainingYes, setTrainingYes] = useState(false);

  async function load() {
    setOpen(true);
    setFailed(false);
    const [list, training] = await Promise.all([
      fetchTrainings({ includeArchived: true }),
      PROJECT_DELETE_ENABLED ? fetchTrainingConsent() : Promise.resolve(null),
    ]);
    setTrainingYes(training?.active === true);
    if (list === null) {
      setFailed(true);
      return;
    }
    setProjects(list.filter((p) => p.topic.trim().length > 0));
  }

  function update(arcId: string, change: Partial<TrainingArc>) {
    setProjects((list) =>
      (list ?? []).map((p) => (p.arcId === arcId ? { ...p, ...change } : p)),
    );
  }

  async function run(arcId: string, action: () => Promise<boolean>) {
    setRowFailed(null);
    const ok = await action().catch(() => false);
    if (!ok) setRowFailed(arcId);
  }

  async function requestDelete(project: TrainingArc): Promise<boolean> {
    const result = await requestProjectDeletion(project.arcId);
    if (result.ok) {
      update(project.arcId, {
        deletion: result.deletion ?? {
          state: "pending",
          dueAt: null,
          cancellable: true,
        },
      });
      setConfirming(null);
    }
    return result.ok;
  }

  return (
    <section className="mt-6 rounded-2xl border border-border p-5" aria-label={ARCHIVE.listTitle}>
      {!open ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => void load()}
          className={`rounded-full ${QUIET_HOVER}`}
        >
          {PROJECT_DELETE_ENABLED ? ARCHIVE.deleteButton : ARCHIVE.listTitle}
        </Button>
      ) : (
        <>
          <h2 className="text-base font-semibold">{ARCHIVE.listTitle}</h2>
          {failed ? (
            <p role="alert" className="mt-3 text-sm text-muted-foreground">
              Couldn&apos;t load your projects.{" "}
              <button
                type="button"
                onClick={() => void load()}
                className="underline underline-offset-2"
              >
                Try again
              </button>
            </p>
          ) : projects === null ? (
            // Still loading: the voice mark, never a blank card that reads
            // as "no projects" (founder 2026-10-07: "your projects is
            // empty, and I do have projects!").
            <SectionLoadingState />
          ) : projects.length === 0 ? (
            // The signed empty state (Q-B15 A, D-CS-8): the h2, then the
            // line where the list would be.
            <p className="mt-3 text-sm text-muted-foreground">{ARCHIVE.empty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {projects.map((project) => (
                <li
                  key={project.arcId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span className="min-w-0 break-words text-[15px]">
                    {project.topic}
                    {project.archived ? (
                      <span className="ml-2 text-[13px] text-muted-foreground">
                        {ARCHIVE.archived}
                      </span>
                    ) : null}
                    {project.deletion ? (
                      <span className="ml-2 text-[13px] text-muted-foreground">
                        {pendingLabel(project.deletion.dueAt)}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    {project.archived ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`rounded-full ${QUIET_HOVER}`}
                        onClick={() =>
                          void run(project.arcId, async () => {
                            const ok = await unarchiveProject(project.arcId);
                            if (ok) update(project.arcId, { archived: false });
                            return ok;
                          })
                        }
                      >
                        {ARCHIVE.unarchive}
                      </Button>
                    ) : null}
                    {PROJECT_DELETE_ENABLED &&
                    project.deletion?.cancellable ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() =>
                          void run(project.arcId, async () => {
                            const result = await cancelProjectDeletion(
                              project.arcId,
                            );
                            if (result.ok) update(project.arcId, { deletion: null });
                            return result.ok;
                          })
                        }
                      >
                        {DELETION.cancel}
                      </Button>
                    ) : null}
                    {PROJECT_DELETE_ENABLED && !project.deletion ? (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full bg-record text-record-foreground hover:bg-record/90"
                        onClick={() => setConfirming(project)}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </span>
                  {rowFailed === project.arcId ? (
                    <p role="alert" className="w-full text-[12px] text-record">
                      Couldn&apos;t save that. Try again.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {confirming ? (
        <ConfirmDelete
          copy={{
            title: DELETION.title(confirming.topic),
            body: projectConfirmBody(trainingYes),
            confirmLabel: DELETION.confirm,
          }}
          onCancel={() => setConfirming(null)}
          onDelete={() => requestDelete(confirming)}
        />
      ) : null}
    </section>
  );
}

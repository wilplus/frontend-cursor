"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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

/* -------------------------------------------------------------------------- */
/*  Your projects, in Data & consent (founder 2026-09-26, N14).               */
/*                                                                            */
/*  One button opens the list of the person's projects, archived ones         */
/*  included. An archived project says so and can be unarchived. Deleting a   */
/*  project happens here, never on the project picker: Delete asks first with */
/*  the signed words (N8) and sends nothing until "Request deletion"; a       */
/*  pending request can be cancelled; a confirmed one cannot. Delete stays    */
/*  off (PROJECT_DELETE_ENABLED) until a deletion can finish.                 */
/* -------------------------------------------------------------------------- */

const ARCHIVE = PROJECT_ARCHIVE_COPY;
const DELETION = PROJECT_DELETION_COPY;

export default function ProjectsCard() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<TrainingArc[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<TrainingArc | null>(null);
  const [rowFailed, setRowFailed] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    setFailed(false);
    const list = await fetchTrainings({ includeArchived: true });
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
        deletion: result.deletion ?? { state: "pending", dueAt: null },
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
          className="rounded-full"
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
          ) : projects === null ? null : (
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
                        {DELETION.pending}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    {project.archived ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
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
                    project.deletion?.state === "pending" ? (
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
            body: DELETION.body,
            confirmLabel: DELETION.confirm,
          }}
          onCancel={() => setConfirming(null)}
          onDelete={() => requestDelete(confirming)}
        />
      ) : null}
    </section>
  );
}

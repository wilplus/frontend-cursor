"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "./OverlayCloseButton";
import { VoiceMark } from "./LoadingState";
import { useBackDismiss } from "./useBackDismiss";
import ProjectRowMenu from "./ProjectRowMenu";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";
import { archiveProject } from "@/services/api/projectArchive";
import { PROJECT_DELETION_COPY } from "@/lib/willab/projectDeletionCopy";
import { PROJECT_ARCHIVE_COPY } from "@/lib/willab/projectArchiveCopy";
import {
  deleteSetupDraft,
  listSetupDrafts,
  type SetupDraft,
} from "@/lib/willab/setupDraft";

/* -------------------------------------------------------------------------- */
/*  ProjectPicker — context-aware recording setup, Scenario A (founder         */
/*  2026-07-22).                                                              */
/*                                                                            */
/*  Recording from the dashboard asks ONE question first: is this a new topic  */
/*  or another take of something you already have? Deliberately plain — the    */
/*  titles are a list of words, no cards, no thumbnails, no take counts, no    */
/*  dates. `cover_ref` / `take_count` / `created_at` are all ignored even      */
/*  though the payload carries them.                                          */
/*                                                                            */
/*  "Start a new project" is a BUTTON above the list, never a list item, so    */
/*  starting fresh can never be mistaken for continuing something.            */
/*                                                                            */
/*  2026-09-25 — an interrupted new-project setup is listed first as a Draft   */
/*  that resumes where it stopped (this device only); its ⋯ menu deletes it.   */
/*  2026-09-26 (N14) — a project's ⋯ menu offers Archive: the project leaves  */
/*  this list and nothing is deleted; Data & consent lists it and brings it   */
/*  back. Deleting a project lives in Data & consent, never here. A project   */
/*  with an open deletion request says "Deletion pending" and cannot be       */
/*  opened.                                                                   */
/*                                                                            */
/*  One row identifies one immutable project and its Ideal Text. Picking it    */
/*  continues exactly that project; visible names are never identity.          */
/*                                                                            */
/*  FE-4 (2026-07-27) — NO DEFAULTS, EVER. There is no last-used project, no   */
/*  auto-select when the list holds exactly one entry, and no "continue where  */
/*  you left off". Every entry into recording asks. This is not a UX           */
/*  preference: a take must carry the explicitly selected Project ID.          */
/*  Guessing from a title or deck would be a data-isolation defect.             */
/*                                                                            */
/*  With NO projects there is nothing to choose between, so the screen is a    */
/*  single centred "Start your first project" — one thing, nothing competing.  */
/* -------------------------------------------------------------------------- */

export default function ProjectPicker({
  ownerId,
  onNewTopic,
  onResumeDraft,
  onContinue,
  onSkip,
  onClose,
}: {
  /** The account whose drafts are listed. */
  ownerId: string | null;
  /** Today's blank setup flow, unchanged. CLEARS the arc seed. */
  onNewTopic: () => void;
  /** Resume an interrupted new-project setup with its answers restored. */
  onResumeDraft: (draft: SetupDraft) => void;
  /** Continue this project — the caller seeds the arc and opens setup. */
  onContinue: (arc: TrainingArc) => void;
  /** There is nothing to choose between: go straight on WITHOUT clearing the
   *  seed. Never route this to onNewTopic — a seeded in-project entry would
   *  lose its arc (review R-pp7/R-pp8). */
  onSkip: () => void;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  const [arcs, setArcs] = useState<TrainingArc[]>([]);
  // Three-way, so "still loading" and "couldn't load" are never mistaken for
  // "you have no projects" — that mistake steers the student into starting a
  // new topic when they meant to continue one (review R-pp3/R-pp6).
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [attempt, setAttempt] = useState(0);
  // Drafts are local and synchronous — read after mount (hydration-safe).
  const [drafts, setDrafts] = useState<SetupDraft[]>([]);
  useEffect(() => {
    setDrafts(listSetupDrafts(ownerId));
  }, [ownerId]);

  async function archive(arc: TrainingArc): Promise<boolean> {
    const ok = await archiveProject(arc.arcId);
    if (ok) setArcs((list) => list.filter((a) => a.arcId !== arc.arcId));
    return ok;
  }

  async function deleteDraft(draft: SetupDraft): Promise<boolean> {
    deleteSetupDraft(ownerId, draft.id);
    setDrafts(listSetupDrafts(ownerId));
    return true;
  }

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void fetchTrainings().then((r) => {
      if (!active) return;
      if (r === null) {
        setStatus("error");
        return;
      }
      setArcs(r);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  // Only projects with a real title are offerable — an untitled arc cannot be
  // told apart from another in a list of words.
  const titled = arcs.filter((a) => a.topic.trim().length > 0);

  // Arcs exist but none carry a title: there is nothing to put in a list of
  // words, so skip the question rather than leave "Start a new project" as the
  // only answer — that would WIPE a seeded arc and mint a duplicate project
  // (review R-pp7). Deliberately onSkip, not onNewTopic: this must not clear
  // the seed. The error state is NOT this case; it keeps its retry below.
  // A draft IS something to choose, so its presence keeps the question.
  const untitledOnly =
    status === "ready" &&
    arcs.length > 0 &&
    titled.length === 0 &&
    drafts.length === 0;
  useEffect(() => {
    if (untitledOnly) onSkip();
  }, [untitledOnly, onSkip]);
  if (untitledOnly) return null;

  // FE-4 — a genuinely first-time user: GET /v2/user/trainings came back
  // {trainings: []}. Gated on `arcs`, not `titled`, so an untitled-project
  // account never lands here and loses its seed to the new-topic path.
  // A draft is also something to come back to, so it keeps the list.
  const firstProject =
    status === "ready" && arcs.length === 0 && drafts.length === 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Game-style header row (the design reference): title left, close
          right, one row — the old "New recording" eyebrow is gone (founder,
          item 6c). */}
      <div className="flex shrink-0 items-center justify-between px-5 pt-4">
        <h2 className="text-[17px] font-semibold text-foreground">
          What are you recording?
        </h2>
        <OverlayCloseButton onClick={onClose} />
      </div>

      {firstProject ? (
        // One button, centred, and nothing else on the screen with it.
        <div className="flex flex-1 items-center justify-center px-5 pb-16">
          <Button
            type="button"
            onClick={onNewTopic}
            className="h-12 w-full max-w-xs rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
          >
            Start your first project
          </Button>
        </div>
      ) : (
      <div className="scrollbar-none flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6">
          <Button
            type="button"
            onClick={onNewTopic}
            className="h-12 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Start a new project
          </Button>

          {status === "loading" ? (
            <div className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
              <VoiceMark size={20} />
              Looking for your projects…
            </div>
          ) : status === "error" ? (
            // Unreachable is NOT "you have no projects" — offer the retry
            // rather than steer someone into starting a duplicate project
            // (review R-pp3/R-pp6).
            <div className="flex flex-col items-start gap-2 px-1">
              <p className="text-[13px] text-muted-foreground">
                Couldn&apos;t load your projects.
              </p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="text-[13px] text-foreground underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : null}
          {/* The list only exists once there is something to continue. Drafts
              are local, so they list even while projects load or fail. */}
          {drafts.length > 0 ||
          (status === "ready" && titled.length > 0) ? (
            <div className="flex flex-col gap-1">
              <p className="px-1 pb-1 text-[13px] text-muted-foreground">
                Or another take of:
              </p>
              {drafts.map((d) => (
                <PickerRow
                  key={`draft:${d.id}`}
                  label={d.topic.trim() || "Untitled draft"}
                  draft
                  onOpen={() => onResumeDraft(d)}
                  onDelete={() => deleteDraft(d)}
                />
              ))}
              {status === "ready"
                ? titled.map((a) => (
                    <ProjectRow
                      key={a.arcId}
                      arc={a}
                      onOpen={() => onContinue(a)}
                      onArchive={() => archive(a)}
                    />
                  ))
                : null}
            </div>
          ) : null}
        </div>
      </div>
      )}
    </div>
  );
}

/** One row: the title (tap = open it). A draft says so beside its title — it
 *  is not a project yet — and carries the ⋯ menu that deletes it. */
function PickerRow({
  label,
  draft = false,
  onOpen,
  onDelete,
}: {
  label: string;
  draft?: boolean;
  onOpen: () => void;
  onDelete?: () => Promise<boolean>;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl transition-colors hover:bg-muted">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-baseline gap-2 px-3 py-3 text-left text-[16px] leading-snug text-foreground"
      >
        <span className="min-w-0 break-words">{label}</span>
        {draft ? (
          <span className="shrink-0 text-[13px] text-muted-foreground">
            Draft
          </span>
        ) : null}
      </button>
      {onDelete ? <ProjectRowMenu label={label} onDelete={onDelete} /> : null}
    </div>
  );
}

/** A project row: tap to open, ⋯ to archive (N14). While a deletion is
 *  pending or confirmed it is locked (not openable) and has no menu; the
 *  request is managed in Data & consent. */
function ProjectRow({
  arc,
  onOpen,
  onArchive,
}: {
  arc: TrainingArc;
  onOpen: () => void;
  onArchive: () => Promise<boolean>;
}) {
  if (arc.deletion) {
    return (
      <div className="flex items-center gap-1 rounded-xl">
        <div
          aria-disabled="true"
          className="flex min-w-0 flex-1 items-baseline gap-2 px-3 py-3 text-left text-[16px] leading-snug text-muted-foreground"
        >
          <span className="min-w-0 break-words">{arc.topic}</span>
          <span className="shrink-0 text-[13px]">
            {PROJECT_DELETION_COPY.pending}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-xl transition-colors hover:bg-muted">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-baseline gap-2 px-3 py-3 text-left text-[16px] leading-snug text-foreground"
      >
        <span className="min-w-0 break-words">{arc.topic}</span>
      </button>
      <ProjectRowMenu
        label={arc.topic}
        actionLabel={PROJECT_ARCHIVE_COPY.archive}
        confirm={null}
        failedLabel={PROJECT_ARCHIVE_COPY.archiveFailed}
        onDelete={onArchive}
      />
    </div>
  );
}

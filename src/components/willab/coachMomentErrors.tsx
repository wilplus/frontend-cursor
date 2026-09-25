"use client";

/* -------------------------------------------------------------------------- */
/*  Naming the error on a moment, and what attaching taught the library.      */
/*                                                                            */
/*  FOUNDER 2026-09-25:                                                       */
/*    "Naming a new error tags the clip, stored as coach provenance."         */
/*    "Attach = both": giving the speaker an exercise also teaches the        */
/*    library that it fixes this moment's error, one tap, tells you, undo.    */
/*                                                                            */
/*  COACH ONLY. Nothing here reaches the speaker: the backend's speaker       */
/*  payload carries neither the names nor the teachings. The coach's naming   */
/*  is a judgement about ONE recording (L3); it never joins the machine's     */
/*  reading and is never a training label.                                    */
/*                                                                            */
/*  IN A FILE OF ITS OWN because CoachConfidencePracticeReview is             */
/*  grandfathered at the complexity ratchet and may only shrink.              */
/* -------------------------------------------------------------------------- */

import { useState } from "react";
import {
  nameMomentError,
  undoLibraryTeaching,
  type CoachConfidencePractice,
  type CoachLibraryTeaching,
  type CoachNamedError,
} from "@/services/api/coachConfidencePractice";
import { DATA_CONSENT_COPY } from "@/lib/legal/dataConsentCopy";
import {
  draftProblem,
  listSpeakingErrors,
  saveSpeakingError,
  suggestErrorId,
  type SpeakingError,
} from "@/services/api/speakingErrors";

/** Every NEW sentence this surface shows, in one place for founder sign-off.
 *  The form's field labels and its validation sentences are the Errors
 *  page's own, already live, and are reused rather than rewritten. */
export const MOMENT_ERRORS_COPY = {
  heading: "Errors on this moment",
  nameOne: "Name an error",
  nameNew: "Name a new error",
  remove: (label: string) => `Remove ${label}`,
  failed: "Couldn’t save that. Try again.",
  taught: (exercise: string, error: string) =>
    `The library now lists “${exercise}” as fixing ${error}.`,
  undo: "Undo",
  undoFailed: "Couldn’t undo that. Try again.",
} as const;

type OnPractice = (practice: CoachConfidencePractice) => void;

const CHIP =
  "rounded-full border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground";
const FIELD =
  "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-primary";

/* ── naming ─────────────────────────────────────────────────────────────── */

export function MomentErrors({
  sessionId,
  snippetId,
  named,
  onPractice,
}: {
  sessionId: string;
  snippetId: string;
  named: CoachNamedError[];
  onPractice: OnPractice;
}) {
  const [open, setOpen] = useState<"pick" | "new" | null>(null);
  const [library, setLibrary] = useState<SpeakingError[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const setNamed = async (errorId: string, next: boolean): Promise<boolean> => {
    setBusy(true);
    setProblem(null);
    const updated = await nameMomentError(sessionId, snippetId, errorId, next);
    setBusy(false);
    if (!updated) {
      setProblem(MOMENT_ERRORS_COPY.failed);
      return false;
    }
    onPractice(updated);
    return true;
  };

  const loadLibrary = async (): Promise<SpeakingError[]> => {
    if (library) return library;
    const result = await listSpeakingErrors();
    const rows = result.ok ? result.data : [];
    setLibrary(rows);
    return rows;
  };

  const openPanel = (which: "pick" | "new") => {
    setProblem(null);
    setOpen((current) => (current === which ? null : which));
    void loadLibrary();
  };

  return (
    <section className="flex flex-col gap-2" aria-label={MOMENT_ERRORS_COPY.heading}>
      <p className="text-[13px] font-medium text-foreground">
        {MOMENT_ERRORS_COPY.heading}
      </p>
      <NamedChips named={named} busy={busy} onRemove={(id) => void setNamed(id, false)} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={CHIP} onClick={() => openPanel("pick")}>
          {MOMENT_ERRORS_COPY.nameOne}
        </button>
        <button type="button" className={CHIP} onClick={() => openPanel("new")}>
          {MOMENT_ERRORS_COPY.nameNew}
        </button>
      </div>
      {open === "pick" ? (
        <ErrorPicker
          library={library}
          named={named}
          busy={busy}
          onPick={async (id) => {
            if (await setNamed(id, true)) setOpen(null);
          }}
        />
      ) : null}
      {open === "new" ? (
        <NewErrorForm
          busy={busy}
          loadLibrary={loadLibrary}
          onProblem={setProblem}
          onReady={async (id) => {
            setLibrary(null);
            if (await setNamed(id, true)) setOpen(null);
          }}
          onCancel={() => setOpen(null)}
        />
      ) : null}
      {problem ? (
        <p role="alert" className="text-[12.5px] leading-snug text-destructive">
          {problem}
        </p>
      ) : null}
    </section>
  );
}

function NamedChips({
  named,
  busy,
  onRemove,
}: {
  named: CoachNamedError[];
  busy: boolean;
  onRemove: (errorId: string) => void;
}) {
  if (named.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {named.map((item) => (
        <li
          key={item.errorId}
          className="flex items-center gap-1.5 rounded-full border border-primary bg-primary/5 py-1 pl-3 pr-1.5 text-[13px] font-medium text-foreground"
        >
          {item.label}
          <button
            type="button"
            disabled={busy}
            aria-label={MOMENT_ERRORS_COPY.remove(item.label)}
            onClick={() => onRemove(item.errorId)}
            className="grid h-5 w-5 place-items-center rounded-full text-[12px] text-muted-foreground"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The library's live entries not yet named here. Retired ones are left out:
 *  a retired name can be withdrawn from a moment, never newly given. */
export function namableErrors(
  library: SpeakingError[],
  named: CoachNamedError[],
): SpeakingError[] {
  const taken = new Set(named.map((item) => item.errorId));
  return library.filter((entry) => entry.active && !taken.has(entry.errorId));
}

function ErrorPicker({
  library,
  named,
  busy,
  onPick,
}: {
  library: SpeakingError[] | null;
  named: CoachNamedError[];
  busy: boolean;
  onPick: (errorId: string) => void;
}) {
  if (!library) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {namableErrors(library, named).map((entry) => (
        <button
          key={entry.errorId}
          type="button"
          disabled={busy}
          title={entry.definition}
          className={CHIP}
          onClick={() => onPick(entry.errorId)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

/** The Errors page's own form, in the panel. A name that is already in the
 *  library is NAMED, never re-filed: filing it again would overwrite the
 *  entry someone else wrote (the upsert has no "already exists"). */
export async function fileOrReuse(
  draft: { label: string; definition: string; asks: string },
  library: SpeakingError[],
): Promise<{ ok: true; errorId: string } | { ok: false; message: string }> {
  const full = { ...draft, errorId: suggestErrorId(draft.label) };
  const existing = library.find((entry) => entry.errorId === full.errorId);
  if (existing) return { ok: true, errorId: existing.errorId };
  const invalid = draftProblem(full);
  if (invalid) return { ok: false, message: invalid };
  const saved = await saveSpeakingError(full);
  if (!saved.ok) return { ok: false, message: saved.message };
  return { ok: true, errorId: saved.data?.errorId ?? full.errorId };
}

function NewErrorForm({
  busy,
  loadLibrary,
  onProblem,
  onReady,
  onCancel,
}: {
  busy: boolean;
  loadLibrary: () => Promise<SpeakingError[]>;
  onProblem: (message: string | null) => void;
  onReady: (errorId: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [definition, setDefinition] = useState("");
  const [asks, setAsks] = useState("");
  const [filing, setFiling] = useState(false);

  const file = async () => {
    setFiling(true);
    onProblem(null);
    const result = await fileOrReuse({ label, definition, asks }, await loadLibrary());
    setFiling(false);
    if (result.ok) onReady(result.errorId);
    else onProblem(result.message);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
      <label className="text-[13px] font-medium text-foreground">
        Name
        <input
          value={label}
          maxLength={120}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Trailing mumble"
          className={FIELD}
        />
      </label>
      <label className="text-[13px] font-medium text-foreground">
        What is measured
        <textarea
          rows={3}
          value={definition}
          onChange={(event) => setDefinition(event.target.value)}
          placeholder="The last words of a sentence lose volume and articulation while the pace stays even."
          className={FIELD}
        />
      </label>
      <label className="text-[13px] font-medium text-foreground">
        The one question it asks
        <input
          value={asks}
          onChange={(event) => setAsks(event.target.value)}
          placeholder="Did the speaker carry the end of the sentence?"
          className={FIELD}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || filing}
          onClick={() => void file()}
          className="rounded-full border border-primary bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"
        >
          File it
        </button>
        <button type="button" className={CHIP} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── what attaching taught ──────────────────────────────────────────────── */

/** The exercise's name as the coach knows it; its id only if it has gone. */
export function exerciseTitle(
  practice: Pick<CoachConfidencePractice, "availableExercises" | "exercise">,
  exerciseId: string,
): string {
  const found = [practice.exercise, ...practice.availableExercises].find(
    (item) => item.exerciseId === exerciseId,
  );
  return found?.title ?? exerciseId;
}

export function LibraryTeachings({
  sessionId,
  snippetId,
  practice,
  onPractice,
}: {
  sessionId: string;
  snippetId: string;
  practice: CoachConfidencePractice;
  onPractice: OnPractice;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const undo = async (teaching: CoachLibraryTeaching) => {
    setBusy(teaching.teachingId);
    setProblem(null);
    const updated = await undoLibraryTeaching(sessionId, snippetId, teaching.teachingId);
    setBusy(null);
    if (updated) onPractice(updated);
    else setProblem(MOMENT_ERRORS_COPY.undoFailed);
  };

  if (practice.libraryTeachings.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {practice.libraryTeachings.map((teaching) => (
        <p
          key={teaching.teachingId}
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-[12.5px] leading-snug text-muted-foreground"
        >
          <span>
            {MOMENT_ERRORS_COPY.taught(
              exerciseTitle(practice, teaching.exerciseId),
              teaching.errorLabel,
            )}
          </span>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void undo(teaching)}
            className="flex-none text-[12.5px] font-medium text-foreground underline"
          >
            {MOMENT_ERRORS_COPY.undo}
          </button>
        </p>
      ))}
      {problem ? (
        <p role="alert" className="text-[12.5px] leading-snug text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/* ── a speaker who turned practice off ──────────────────────────────────── */

/** E3 (founder 2026-09-25): a coach cannot send an exercise to someone who
 *  turned practice off, and is told so rather than shown nothing. */
export function SpeakerPracticeOffNote({
  enabled,
  speakerOff,
}: {
  enabled: boolean;
  speakerOff: boolean;
}) {
  if (!enabled || !speakerOff) return null;
  return (
    <p role="status" className="text-[12.5px] leading-snug text-muted-foreground">
      {DATA_CONSENT_COPY.coachSpeakerOff}
    </p>
  );
}

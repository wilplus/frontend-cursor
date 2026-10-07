"use client";

/* -------------------------------------------------------------------------- */
/*  /admin/library — the founder's Library page (coach panel lock, CP3 A;     */
/*  design locked 2026-10-07, N57; build plan D-CP-21), drawn to the          */
/*  prototype's screens:                                                      */
/*                                                                            */
/*    library    "‹ Lounge", Your library: every exercise (what it treats,     */
/*               transcribed / transcribing… / retired) and the praise lines  */
/*               by cue; the pinned pill "New"                                */
/*    libitem    one exercise: its video, its instruction as a speaker sees   */
/*               it (the pencil edits it), "Retire it" / "Bring it back"      */
/*               (PUT /admin/exercises/:id/active, founder only)              */
/*    libpraise  the praise lines filed under one cue                         */
/*    libkind    New: "What kind of error is it?", every active error         */
/*    libwords   New: Your instruction, with the pencil                       */
/*    libvideo   New: Your video; Record, Stop, Save, Record again            */
/*                                                                            */
/*  Every word is COACH_PANEL_COPY's. A clearer version never goes to the     */
/*  library (Q-B13 A), so no rewrite moves are listed. The exercise's name,   */
/*  which the catalogue needs and the prototype does not ask for, is its      */
/*  instruction's first words. Founder only (page.tsx); the backend gates     */
/*  every endpoint again.                                                     */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useUserProfile } from "@/components/willab/useUserProfile";
import LoadingState from "@/components/willab/LoadingState";
import CoachVideo from "@/components/willab/CoachVideo";
import CoachWords from "@/components/willab/coachpanel/CoachWords";
import CoachVideoBox from "@/components/willab/coachpanel/CoachVideoBox";
import WalkStage from "@/components/willab/walk/WalkStage";
import WalkOverlay from "@/components/willab/walk/WalkOverlay";
import WalkChoices, { type WalkChoice } from "@/components/willab/walk/WalkChoices";
import WalkFooter, { WalkPill } from "@/components/willab/walk/WalkFooter";
import WalkToast from "@/components/willab/walk/WalkToast";
import { useCoachVideoRecorder } from "@/hooks/useCoachVideoRecorder";
import {
  draftFrom, listCoachExercises, saveCoachExercise, saveCoachExerciseWithVideo, setExerciseActive,
  type CoachExercise, type CoachExerciseDraft,
} from "@/services/api/coachExercises";
import { listCatalogue, type CatalogueLine } from "@/services/api/coachWalk";
import type { SpeakingError } from "@/services/api/speakingErrors";
import { slugFor } from "@/lib/willab/coachAnswer";
import type { WalkDir, WalkScreen } from "@/lib/willab/walkMotion";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

/* ── the pure parts ──────────────────────────────────────────────────── */

export type LibraryScreen =
  | { key: "library" }
  | { key: "libitem"; id: string }
  | { key: "libpraise"; cue: string }
  | { key: "libkind" }
  | { key: "libwords" }
  | { key: "libvideo" };

export function mainTargetOf(exercise: CoachExercise): string {
  const primary = exercise.matchingCriteria?.primary_problem_tag;
  return typeof primary === "string" && primary ? primary : exercise.acousticProblemTags[0] ?? "";
}

function transcriptWord(exercise: CoachExercise): string | null {
  const status = exercise.latestVersion?.transcriptStatus;
  if (status === "done") return COPY.transcribed;
  if (status === "pending") return COPY.transcribing;
  return null;
}

/** An exercise's row: its title; what it treats, its transcript, retired. */
export function exerciseChoice(exercise: CoachExercise, labels: Map<string, string>): WalkChoice {
  const target = mainTargetOf(exercise);
  const bits = [labels.get(target) ?? target, transcriptWord(exercise), exercise.active ? null : COPY.retired]
    .filter((b): b is string => Boolean(b));
  return { value: `e:${exercise.exerciseId}`, label: exercise.title, subtitle: bits.join(" · ") };
}

/** The praise lines by cue, as the library files them. */
export function praiseByCue(lines: readonly CatalogueLine[]): [string, CatalogueLine[]][] {
  const out = new Map<string, CatalogueLine[]>();
  for (const l of lines) {
    if (l.lane !== "praise" || !l.active) continue;
    out.set(l.patternKey, [...(out.get(l.patternKey) ?? []), l]);
  }
  return [...out.entries()];
}

export function cueWord(key: string): string {
  return COPY.cue[key] ?? key;
}

/** The exercise's caption: Treats: {error} · transcribed · retired. */
export function itemCaption(exercise: CoachExercise, labels: Map<string, string>): string {
  const target = mainTargetOf(exercise);
  return [COPY.treats(labels.get(target) ?? target), transcriptWord(exercise), exercise.active ? null : COPY.retired]
    .filter((b): b is string => Boolean(b)).join(" · ");
}

/** The library's own past final for an error, so the New flow's words open
 *  with it, never with a speaker's words. */
export function pastFinalFor(errorId: string, exercises: readonly CoachExercise[]): string {
  return exercises.find((e) => e.active && mainTargetOf(e) === errorId && e.instruction.trim())?.instruction ?? "";
}

/** A new exercise, born through the New flow: named by its instruction's
 *  first words (the catalogue needs a name; the prototype asks for none). */
export function newExerciseDraft(errorId: string, instruction: string): CoachExerciseDraft {
  const words = instruction.trim().split(/\s+/).filter(Boolean);
  const title = words.slice(0, 6).join(" ").replace(/[.,;:!?]+$/, "");
  return {
    exerciseId: `${slugFor(title)}-${Date.now().toString(36)}`.slice(0, 63),
    title,
    instruction: instruction.trim(),
    introductionCopy: "",
    acousticProblemTags: [errorId],
    mainTarget: errorId,
    matchingCriteria: null,
    explanationVideoUrl: "",
    active: true,
    aiDraftText: null,
    aiDraftModelVersion: null,
  };
}

function walkScreenOf(screen: LibraryScreen): WalkScreen {
  if (screen.key === "library") return { key: "library", overlay: false };
  const kind = "id" in screen ? screen.id : "cue" in screen ? screen.cue : undefined;
  return { key: screen.key, kind };
}

/* ── the page ────────────────────────────────────────────────────────── */

type Stage = WalkScreen & { lib: LibraryScreen };

export default function LibraryClient() {
  const { isCoach, loading: profileLoading } = useUserProfile();
  const [exercises, setExercises] = useState<CoachExercise[]>([]);
  const [errors, setErrors] = useState<SpeakingError[]>([]);
  const [lines, setLines] = useState<CatalogueLine[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [screen, setScreen] = useState<LibraryScreen>({ key: "library" });
  const [history, setHistory] = useState<LibraryScreen[]>([]);
  const [dir, setDir] = useState<WalkDir | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newKind, setNewKind] = useState<string | null>(null);
  const [newWords, setNewWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const recorder = useCoachVideoRecorder();

  const refresh = useCallback(async () => {
    setLoadError(null);
    const [library, catalogue] = await Promise.all([listCoachExercises(), listCatalogue()]);
    if (!library.ok) setLoadError(library.message);
    else {
      setExercises(library.data.exercises);
      setErrors(library.data.speakingErrors);
    }
    setLines(catalogue);
  }, []);

  useEffect(() => {
    if (isCoach) void refresh();
  }, [isCoach, refresh]);

  const go = useCallback((next: LibraryScreen, d: WalkDir = "forward") => {
    setHistory((h) => [...h, screen]);
    setScreen(next);
    setDir(d);
    setEditing(false);
    setFail(null);
  }, [screen]);

  function back(): void {
    const h = [...history];
    const previous = h.pop() ?? { key: "library" as const };
    setHistory(h);
    setScreen(previous);
    setDir("back");
    setEditing(false);
    setFail(null);
  }

  function close(): void {
    setHistory([]);
    setScreen({ key: "library" });
    setDir(undefined);
    setEditing(false);
    setFail(null);
    recorder.reset();
  }

  const say = (text: string) => setToast((t) => ({ id: (t?.id ?? 0) + 1, text }));

  // ?new=1 opens the New flow; ?item=<id> opens one exercise (from the
  // Speaking errors page).
  useEffect(() => {
    if (!isCoach) return;
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("new") === "1") setScreen({ key: "libkind" });
      const item = q.get("item");
      if (item) setScreen({ key: "libitem", id: item });
    } catch { /* no address to read */ }
  }, [isCoach]);

  const labels = useMemo(() => new Map(errors.map((e) => [e.errorId, e.label])), [errors]);
  const stage: Stage = useMemo(() => ({ ...walkScreenOf(screen), lib: screen }), [screen]);

  async function done(exercise: CoachExercise): Promise<void> {
    const text = edits[exercise.exerciseId];
    if (text !== undefined && text.trim() && text.trim() !== exercise.instruction.trim()) {
      setBusy(true);
      const saved = await saveCoachExercise({ ...draftFrom(exercise), instruction: text.trim() });
      setBusy(false);
      if (!saved.ok) { setFail(saved.message); return; }
      void refresh();
    }
    close();
  }

  async function setActive(exercise: CoachExercise, active: boolean): Promise<void> {
    setBusy(true);
    setFail(null);
    const result = await setExerciseActive(exercise.exerciseId, active);
    setBusy(false);
    if (!result.ok) { setFail(result.message); return; }
    say(active ? COPY.toastBackInTheLibrary : COPY.toastRetired);
    setExercises((all) => all.map((e) => (e.exerciseId === exercise.exerciseId ? { ...e, active } : e)));
  }

  async function saveNew(): Promise<void> {
    if (!newKind || recorder.state.status !== "stopped") return;
    setBusy(true);
    setFail(null);
    const saved = await saveCoachExerciseWithVideo(newExerciseDraft(newKind, newWords), recorder.state.file);
    setBusy(false);
    if (!saved.ok) { setFail(saved.message); return; }
    say(COPY.toastLibraryOnly);
    setNewKind(null);
    setNewWords("");
    close();
    void refresh();
  }

  function render(s: Stage) {
    const lib = s.lib;
    const live = lib === screen;
    if (lib.key === "libitem") {
      const exercise = exercises.find((e) => e.exerciseId === lib.id);
      if (!exercise) return <WalkOverlay onBack={back} backLabel={COPY.library} onClose={close} testId="library-item" />;
      const text = edits[exercise.exerciseId] ?? exercise.instruction;
      const retired = !exercise.active;
      const footer = (
        <WalkFooter
          pill={retired
            ? { label: COPY.bringItBack, onClick: () => void setActive(exercise, true), disabled: editing || busy, testId: "library-bring-back" }
            : { label: COPY.done, onClick: () => void done(exercise), disabled: editing || busy, testId: "library-done" }}
          links={retired ? [] : [{ label: COPY.retireIt, onClick: () => void setActive(exercise, false), disabled: busy, testId: "library-retire" }]}
        >
          {live && fail ? <p role="alert" className="m-0 pb-2 text-center text-[14px] text-destructive">{fail}</p> : null}
        </WalkFooter>
      );
      return (
        <WalkOverlay onBack={back} backLabel={COPY.library} onClose={close} title={exercise.title}
          caption={itemCaption(exercise, labels)} footer={footer} testId="library-item">
          {exercise.explanationVideoUrl ? <CoachVideo src={exercise.explanationVideoUrl} className="w-full" /> : null}
          <CoachWords text={text} editing={live && editing}
            onChange={(v) => setEdits((all) => ({ ...all, [exercise.exerciseId]: v }))}
            onToggle={() => setEditing((e) => !e)} />
        </WalkOverlay>
      );
    }
    if (lib.key === "libpraise") {
      const filed = lines.filter((l) => l.lane === "praise" && l.active && l.patternKey === lib.cue);
      return (
        <WalkOverlay onBack={back} backLabel={COPY.library} onClose={close} title={cueWord(lib.cue)}
          caption={COPY.praiseLinesCaption} testId="library-praise"
          footer={<WalkFooter pill={{ label: COPY.done, onClick: close }} />}>
          <WalkChoices label={cueWord(lib.cue)} choices={filed.map((l) => ({ value: l.id, label: l.text, done: true }))} />
        </WalkOverlay>
      );
    }
    if (lib.key === "libkind") {
      const options = errors.filter((e) => e.active);
      return (
        <WalkOverlay onBack={back} backLabel={COPY.newNav} onClose={close} title={COPY.whatKindOfError}
          caption={`${COPY.oneError} · ${COPY.libraryOffersIt}`} testId="library-kind"
          footer={<WalkFooter pill={{ label: COPY.next, disabled: !newKind, testId: "library-kind-next",
            onClick: () => { setNewWords((w) => w || pastFinalFor(newKind ?? "", exercises)); go({ key: "libwords" }); } }} />}>
          <WalkChoices label={COPY.whatKindOfError}
            choices={options.map((e) => ({ value: e.errorId, label: e.label, selected: newKind === e.errorId, mark: "none" as const }))}
            onPick={(v) => setNewKind(v)} />
        </WalkOverlay>
      );
    }
    if (lib.key === "libwords") {
      return (
        <WalkOverlay onBack={back} backLabel={COPY.newNav} onClose={close} title={COPY.wordsTitle.error}
          caption={`${COPY.asASpeakerWillSeeIt} · ${COPY.pencilEditsEveryWord}`} testId="library-words"
          footer={<WalkFooter pill={{ label: COPY.next, disabled: editing || !newWords.trim(), testId: "library-words-next",
            onClick: () => go({ key: "libvideo" }) }} />}>
          <CoachWords text={newWords} editing={live && editing} onChange={setNewWords} onToggle={() => setEditing((e) => !e)} />
        </WalkOverlay>
      );
    }
    if (lib.key === "libvideo") {
      const v = recorder.state.status;
      const pill = v === "recording"
        ? { label: COPY.stop, onClick: () => void recorder.stop() }
        : v === "stopped"
          ? { label: COPY.save, onClick: () => void saveNew(), disabled: busy, testId: "library-save" }
          : { label: COPY.record, onClick: () => void recorder.start(), testId: "library-record" };
      const links = v === "stopped" ? [{ label: COPY.recordAgain, onClick: () => { recorder.reset(); } }] : [];
      return (
        <WalkOverlay onBack={back} backLabel={COPY.newNav} onClose={close} title={COPY.videoTitle}
          caption={COPY.anExerciseNeedsItsVideo} testId="library-video"
          footer={<WalkFooter pill={pill} dot={v === "idle" || v === "error"} links={links}>
            {live && fail ? <p role="alert" className="m-0 pb-2 text-center text-[14px] text-destructive">{fail}</p> : null}
          </WalkFooter>}>
          <CoachVideoBox recorder={recorder} tall />
        </WalkOverlay>
      );
    }
    return null;
  }

  if (profileLoading) return <LoadingState placement="viewport" />;
  // Founder only (page.tsx); a non-coach session draws nothing at all.
  if (!isCoach) return null;

  const choices: WalkChoice[] = [
    ...exercises.map((e) => exerciseChoice(e, labels)),
    ...praiseByCue(lines).map(([cue, filed]) => ({ value: `p:${cue}`, label: cueWord(cue), subtitle: COPY.praiseLines(filed.length) })),
  ];

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-background text-foreground" data-testid="admin-library">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-[16px] font-semibold">
        <Link href="/chat" className="flex items-center gap-0.5 text-[15px] font-normal text-muted-foreground" data-testid="library-lounge">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {COPY.lounge}
        </Link>
        <span />
      </div>
      <div className="flex flex-1 flex-col gap-3 px-5 pb-[120px] pt-3.5">
        <h1 className="m-0 text-[24px] font-bold tracking-[-0.01em]">{COPY.libraryTitle}</h1>
        {loadError ? <p role="alert" className="m-0 text-[13px] text-destructive">{loadError}</p> : null}
        <WalkChoices label={COPY.libraryTitle} choices={choices}
          onPick={(v) => {
            if (v.startsWith("e:")) go({ key: "libitem", id: v.slice(2) });
            else go({ key: "libpraise", cue: v.slice(2) });
          }} />
      </div>
      <div className="fixed inset-x-0 bottom-[30px] mx-auto max-w-lg px-5">
        <WalkPill action={{ label: COPY.newPill, onClick: () => { setNewKind(null); setNewWords(""); go({ key: "libkind" }); }, testId: "library-new" }} />
      </div>
      <WalkStage screen={stage} dir={dir} render={render} />
      {toast ? <WalkToast key={toast.id} message={toast.text} onDone={() => setToast(null)} /> : null}
    </main>
  );
}

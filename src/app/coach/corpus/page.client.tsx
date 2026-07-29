"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Upload } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import { useUserProfile } from "@/components/willab/useUserProfile";
import {
  buildLabelBody,
  fetchConfidenceQueue,
  fetchTrainingImports,
  exceedsProxyLimit,
  IMPORT_LANGUAGES,
  languageLabel,
  SPEAKER_SEXES,
  importTrainingAudio,
  INTENSITY_MAX,
  INTENSITY_MIN,
  OPTIONAL_STAGES,
  saveConfidenceLabel,
  STAGE_COST,
  type ConfidenceQueue,
  type ImportOutcome,
  type OptionalStage,
  type QueuePiece,
  type TrainingImport,
} from "@/services/api/trainingCorpus";

/* -------------------------------------------------------------------------- */
/*  /coach/corpus — the training corpus workbench (2026-07-28)                 */
/*                                                                            */
/*  Import real human speech from outside the app, then label each piece it    */
/*  was cut into: confident yes/no, and how strongly. That corpus is what the  */
/*  confident-snippet recogniser trains on.                                    */
/*                                                                            */
/*  COACH ONLY (N4). Gated three ways, deliberately: this route is not linked  */
/*  from any user surface, its menu row renders for coaches only, and this     */
/*  component renders NOTHING for a non-coach even if the URL is typed. The BE */
/*  role-gates every endpoint independently — the FE gate is for the person    */
/*  who guesses the URL, not for security.                                     */
/*                                                                            */
/*  N1 / BLIND COACH — the labelling screen shows the piece and nothing else:  */
/*  no machine read, no band, no score, no colour that could stand in for one. */
/*  The composite chooses WHO gets asked; the coach decides the answer. Any     */
/*  hint would make each label a confirmation of the machine and the corpus     */
/*  circular. N2 — the queue renders in payload order, never re-sorted: the    */
/*  order is band-shuffled precisely so position is not a tell.                */
/*                                                                            */
/*  N3 — "confident" is required. There is no default, no pre-selection: the   */
/*  1–5 row does not exist until Yes or No is picked, and the body builder     */
/*  refuses to construct an intensity-only save.                               */
/*                                                                            */
/*  Copy on this screen is coach-facing and flagged for founder sign-off.      */
/* -------------------------------------------------------------------------- */

export default function CorpusPageClient() {
  const router = useRouter();
  const { isCoach, loading } = useUserProfile();
  const [openSession, setOpenSession] = useState<TrainingImport | null>(null);
  const [imports, setImports] = useState<TrainingImport[] | null>(null);
  const [indexFailed, setIndexFailed] = useState(false);

  const refresh = useCallback(() => {
    void fetchTrainingImports().then((r) => {
      setImports(r);
      setIndexFailed(r === null);
    });
  }, []);
  useEffect(() => {
    if (isCoach) refresh();
  }, [isCoach, refresh]);

  if (loading) {
    return (
      <main className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }
  // N4 — nothing for a non-coach, even by direct URL. No hint that a corpus
  // exists; the BE would refuse them anyway.
  if (!isCoach) {
    return (
      <main className="flex h-full items-center justify-center bg-background px-6">
        <p className="text-center text-[15px] text-muted-foreground">
          Nothing here.
        </p>
      </main>
    );
  }

  if (openSession) {
    return (
      <LabelScreen
        item={openSession}
        onClose={() => {
          setOpenSession(null);
          refresh();
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-2xl flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">
            Training corpus
          </span>
          <span className="shrink-0 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
            Coach only · training
          </span>
        </span>
        <OverlayCloseButton
          onClick={() => router.push("/chat")}
          ariaLabel="Close training corpus"
        />
      </div>

      <div className="scrollbar-none flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
        <ImportPanel onImported={refresh} onOpen={setOpenSession} />
        <IndexPanel
          imports={imports}
          failed={indexFailed}
          onOpen={setOpenSession}
        />
      </div>
    </main>
  );
}

/* ------------------------------ FE-1: import ------------------------------ */

interface FileState {
  file: File;
  /** Five outcomes, because the BE distinguishes five things:
   *  - `done`      pieces were cut and are waiting to be labelled
   *  - `duplicate` the idempotency key matched; the ORIGINAL was returned and
   *                no work was done. A success that must not read as new work.
   *  - `empty`     the file was READ but nothing was cut (NO_SPEECH_DETECTED /
   *                NO_CANDIDATES). Amber: nothing is wrong with the upload.
   *  - `failed`    a real rejection or a transport failure. Red.
   *  - `running`   uploading, or the server is still analysing. */
  status: "queued" | "running" | "done" | "duplicate" | "empty" | "failed";
  /** One-line summary, right-aligned on the row. */
  detail: string;
  /** The BE's own sentence, wrapped under the row. Empty when there is none. */
  hint: string;
  /** The session this import produced, when it produced one. Kept because the
   *  POST response is currently the ONLY way to reach the queue: the corpus
   *  index is coming back empty (a BE-side bug), so without this a coach can
   *  import 45 pieces and have no route to any of them. */
  sessionId: string;
  /** Pieces waiting, so the row can say what is behind it. */
  queueCount: number;
}

/** Outcomes a second press of Import must NOT re-run. `failed` is absent on
 *  purpose — a rejection or a dropped connection is exactly what a retry is
 *  for, and the idempotency key makes re-sending safe. */
const TERMINAL = new Set(["done", "duplicate", "empty"]);

/** Compact and approximate on purpose: this is "did the BE read my file",
 *  not a measurement anyone acts on to the second. */
function formatLength(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function ImportPanel({
  onImported,
  onOpen,
}: {
  onImported: () => void;
  onOpen: (i: TrainingImport) => void;
}) {
  const [topic, setTopic] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [note, setNote] = useState("");
  // `null` = the coach has not chosen yet, which is NOT the same as choosing
  // auto-detect (""). Import stays disabled until they pick.
  //
  // Why this is not a default any more: it shipped defaulting to auto-detect,
  // a coach imported a Polish talk without touching it, and Whisper — primed
  // with an English prompt — TRANSLATED the speech instead of transcribing
  // it. The audio was fine, the words were English, and nothing on screen
  // said so. A silent failure mode is exactly the thing a default should not
  // sit in front of, so the choice is now recorded rather than assumed.
  const [language, setLanguage] = useState<string | null>(null);
  const [speakerSex, setSpeakerSex] = useState("");
  const [stages, setStages] = useState<OptionalStage[]>([]);
  const [files, setFiles] = useState<FileState[]>([]);
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /** The one-line summary, and the BE's own sentence when there is one worth
   *  wrapping underneath. The two are separate because the reason a zero-piece
   *  import happened ("if this audio is not in English, re-import it with a
   *  language code") is a sentence, not a status. */
  const describe = (r: ImportOutcome): { detail: string; hint: string } => {
    if (r.ok) {
      const len = r.durationSec ? ` · ${formatLength(r.durationSec)}` : "";
      // What it ACTUALLY ran as, echoed by the BE — not what the picker said.
      // "which language did this run as" is the first question anyone asks
      // about a transcript that reads oddly, and `language: null` (auto-detect)
      // is itself the answer when the words come back in the wrong one.
      const lang = r.language ? `${languageLabel(r.language)} · ` : "Auto-detected · ";
      // A duplicate is a success that did NO work: the BE matched the
      // idempotency key and handed back the original. Saying "42 pieces" here
      // would tell a coach re-running a folder that thirty files were just
      // processed when nothing was.
      if (r.duplicate) {
        return {
          detail: `Already imported · ${r.queueCount} to label`,
          hint: "",
        };
      }
      // Kept even though the BE now reports zero pieces as a failure: an older
      // deploy still answers ok with snippet_count 0, and that must not read
      // as success just because the two sides are out of step.
      if (r.snippetCount === 0) {
        return {
          detail: r.durationSec
            ? `Read ${formatLength(r.durationSec)} — but 0 pieces, nothing to label`
            : "No audio read — 0 pieces, nothing to label",
          hint: "",
        };
      }
      return {
        detail: `${lang}${r.snippetCount} pieces · ${r.queueCount} queued to label${len}`,
        hint: "",
      };
    }
    // NEVER the raw reason: `NO_SPEECH_DETECTED` is a value for a switch
    // statement, not something to put in front of a person. The BE's `detail`
    // is a real sentence that names the fix, so it is shown verbatim, and the
    // summary line carries the duration that says whether the file was read.
    const hint = r.error ?? "";
    if (r.empty) {
      return {
        detail: r.durationSec
          ? `Read ${formatLength(r.durationSec)} — but 0 pieces, nothing to label`
          : "No audio read — 0 pieces, nothing to label",
        hint,
      };
    }
    return {
      detail: hint ? "Import failed" : "Import failed. Try again.",
      hint,
    };
  };

  async function run() {
    if (running || files.length === 0 || !topic.trim() || language === null) return;
    setRunning(true);
    // SEQUENTIAL on purpose: the analysis is CPU-heavy server-side, and firing
    // a folder in parallel mostly produces timeouts rather than speed.
    for (let i = 0; i < files.length; i++) {
      if (TERMINAL.has(files[i].status)) continue;
      setFiles((f) =>
        f.map((x, j) =>
          j === i ? { ...x, status: "running", detail: "", hint: "" } : x
        )
      );
      const r = await importTrainingAudio({
        file: files[i].file,
        topic: topic.trim(),
        speakerLabel: speaker.trim() || null,
        note: note.trim() || null,
        language,
        speakerSex,
        optionalStages: stages,
        // The POST returns as soon as the upload lands; the analysis runs on.
        // Saying so beats a row that reads "Analysing…" identically whether
        // the file is still uploading or the BE is minutes into Whisper.
        onAccepted: () =>
          setFiles((f) =>
            f.map((x, j) =>
              j === i ? { ...x, detail: "Analysing on the server…" } : x
            )
          ),
      });
      const outcome: FileState["status"] = !r.ok
        ? r.empty
          ? "empty"
          : "failed"
        : r.duplicate
          ? "duplicate"
          : r.snippetCount === 0
            ? "empty"
            : "done";
      const { detail, hint } = describe(r);
      setFiles((f) =>
        f.map((x, j) =>
          j === i
            ? {
                ...x,
                status: outcome,
                detail,
                hint,
                sessionId: r.ok ? r.sessionId : (r.sessionId ?? ""),
                queueCount: r.ok ? r.queueCount : 0,
              }
            : x
        )
      );
      // Refreshed on a zero-piece result too: the BE writes the session row
      // either way, so the failed attempt is inspectable in the list rather
      // than living only in a line the coach is about to scroll past.
      if (r.ok || r.sessionId) onImported();
    }
    setRunning(false);
  }

  // Terminal either way — an empty import is finished, just not fruitful.
  const done = files.filter((f) => TERMINAL.has(f.status)).length;
  const oversized = files.filter((f) => exceedsProxyLimit(f.file.size));

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-[13px] font-semibold text-foreground">Import audio</p>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-muted-foreground">
          What the talk is about
        </span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="The topic"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-muted-foreground">
          Whose voice this is
        </span>
        <input
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          placeholder="Speaker name"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
        />
        {/* Optional to the API, but it is the ONLY grouping key a per-speaker
            model will ever have — a corpus without it cannot tell whose voice
            a piece is. Worth saying out loud rather than leaving blank. */}
        <span className="text-[11px] text-muted-foreground">
          Optional, but it is the only way the corpus can tell whose voice a
          piece is. Worth filling in per batch.
        </span>
      </label>

      {/* Sits directly under the speaker on purpose: both describe the AUDIO,
          not the filing. Auto-detect is the default and sends nothing, so a
          coach who ignores this gets exactly the request that shipped before
          it existed. The nudge is deliberately concrete about the failure it
          prevents — a talk transcribed as the wrong language yields zero
          pieces and reads like a broken import, which is what happened on the
          first real one. */}
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-muted-foreground">
          What language it is in
        </span>
        <select
          value={language ?? "__unset"}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
        >
          <option value="__unset" disabled>
            Choose…
          </option>
          {IMPORT_LANGUAGES.map((l) => (
            <option key={l.code || "auto"} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="text-[11px] leading-snug text-muted-foreground">
          Required — auto-detect is a choice, not a default. Whisper is primed
          with an English prompt, so a talk left on auto-detect can come back
          <em> translated</em> into English rather than transcribed: the audio is
          right, the words are not, and nothing says so.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-muted-foreground">
          Speaker&apos;s sex
        </span>
        <select
          value={speakerSex}
          onChange={(e) => setSpeakerSex(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
        >
          {SPEAKER_SEXES.map((x) => (
            <option key={x.value || "unset"} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        {/* Not a demographic tag on the corpus: one confidence cue's DIRECTION
            is routed on it. An import is someone else's voice filed under the
            coach's account, so leaving it blank is safe (the server falls back
            to an acoustic route) but stating it is better. */}
        <span className="text-[11px] text-muted-foreground">
          Optional. One voice cue reads differently by sex, so this is about
          the analysis rather than about the person.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-muted-foreground">
          Where it came from
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="2019 conference, YouTube"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
        />
      </label>

      {/* N5 — the stage ticks are coach-only and never appear on the normal
          record/upload flow. `confidence` renders CHECKED and DISABLED rather
          than hidden: the coach should see that it is always on and why, not
          discover it by its absence. */}
      <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          What to run
        </legend>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked disabled className="mt-1" />
          <span className="text-[13px] text-foreground">
            Confidence
            <span className="block text-[11px] text-muted-foreground">
              Always on — this is what produces the pieces and the label queue,
              i.e. the corpus itself.
            </span>
          </span>
        </label>
        {OPTIONAL_STAGES.map((s) => (
          <label key={s} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={stages.includes(s)}
              onChange={(e) =>
                setStages((prev) =>
                  e.target.checked
                    ? [...prev, s]
                    : prev.filter((x) => x !== s)
                )
              }
              className="mt-1"
            />
            <span className="text-[13px] text-foreground">
              {s === "analytics" ? "Analytics" : "Ideal text"}
              <span className="block text-[11px] text-muted-foreground">
                {STAGE_COST[s]}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*,video/mp4"
        multiple
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          setFiles(
            picked.map((file) => ({
              file,
              status: "queued" as const,
              detail: "",
              hint: "",
              sessionId: "",
              queueCount: 0,
            }))
          );
        }}
        className="hidden"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={running}
          className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Upload className="h-4 w-4" aria-hidden />
          Choose files
        </button>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || files.length === 0 || !topic.trim() || language === null}
          className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {running ? `Importing ${done + 1} of ${files.length}…` : "Import"}
        </button>
        {files.length > 0 && !running ? (
          <span className="text-[12px] text-muted-foreground">
            {files.length} file{files.length === 1 ? "" : "s"} ready
          </span>
        ) : null}
      </div>

      {/* Said BEFORE the upload, not after a 413. The same-origin hop caps a
          request body at ~4.5 MB on Vercel, and a talk of any length is far
          bigger — so the file has to reach the backend directly. The FE tries
          that first; this warns that if the direct route is not open, these
          files cannot get through at all. Retrying does not move a platform
          limit, and a coach should not learn that from a failed 40 MB
          upload. */}
      {oversized.length > 0 && !running ? (
        <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-500">
          {oversized.length === 1 ? "This file is" : `${oversized.length} of these are`}{" "}
          larger than the app can upload on its own (~4.5 MB). It will be sent
          straight to the server instead — if that route is not open yet, the
          import will say so rather than retrying.
        </p>
      ) : null}

      {files.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li key={`${f.file.name}-${i}`} className="flex flex-col gap-0.5 text-[12px]">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {f.file.name}
                </span>
                <span
                  className={
                    f.status === "failed"
                      ? "shrink-0 text-destructive"
                      : f.status === "empty"
                        ? "shrink-0 text-amber-600 dark:text-amber-500"
                        : "shrink-0 text-muted-foreground"
                  }
                >
                  {f.status === "queued"
                    ? "Waiting"
                    : f.status === "running"
                      ? f.detail || "Uploading…"
                      : f.detail}
                </span>
              </span>
              {/* The BE's own sentence, WRAPPED rather than truncated on the
                  status line: it is the one that names the fix ("re-import it
                  with a language code"), and a truncated fix is no fix. */}
              {f.hint ? (
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {f.hint}
                </span>
              ) : null}
              {/* The route to the pieces. The corpus index is the intended
                  door, but it is coming back empty from the BE — so without
                  this a coach can import 45 pieces and have no way to reach
                  one of them. The POST already told us the session id; using
                  it costs nothing and does not depend on the list being
                  fixed. */}
              {f.sessionId && f.queueCount > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    onOpen({
                      sessionId: f.sessionId,
                      arcId: null,
                      topic: topic.trim() || f.file.name,
                      speakerLabel: speaker.trim() || null,
                      createdAt: null,
                      state: "done",
                      queueCount: f.queueCount,
                      detail: null,
                      language: language || null,
                    })
                  }
                  className="mt-1 flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2 text-left transition-colors hover:border-primary/60"
                >
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
                    Label the {f.queueCount} piece{f.queueCount === 1 ? "" : "s"} from{" "}
                    {f.file.name}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* ------------------------------- FE-2: index ------------------------------ */

function IndexPanel({
  imports,
  failed,
  onOpen,
}: {
  imports: TrainingImport[] | null;
  failed: boolean;
  onOpen: (i: TrainingImport) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        Imported
      </p>
      {imports === null ? (
        failed ? (
          <p className="text-[14px] text-muted-foreground">
            Couldn&apos;t load the corpus just now. Reload to try again.
          </p>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )
      ) : imports.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">
          Nothing imported yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {/* A failed import stays in the list rather than being filtered out.
              It is the evidence: the BE writes the row precisely so a coach can
              see WHY a file produced nothing, instead of the attempt existing
              only in a response they already scrolled past. It is not openable
              — there is no queue behind it — so it renders as a plain row. */}
          {imports.map((i) => {
            const openable = i.state === "done";
            const status =
              i.state === "running"
                ? "Analysing…"
                : i.state === "failed"
                  ? "Nothing to label"
                  : i.queueCount !== null
                    ? `${i.queueCount} to label`
                    : "";
            const inner = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-foreground">
                    {i.topic || "Untitled"}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {i.speakerLabel ?? "No speaker label"}
                    {i.language ? ` · ${languageLabel(i.language)}` : ""}
                  </span>
                  {i.state === "failed" && i.detail ? (
                    <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                      {i.detail}
                    </span>
                  ) : null}
                </span>
                {status ? (
                  <span
                    className={
                      i.state === "failed"
                        ? "shrink-0 text-[11px] text-amber-600 dark:text-amber-500"
                        : "shrink-0 text-[11px] text-muted-foreground"
                    }
                  >
                    {status}
                  </span>
                ) : null}
                {openable ? (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                ) : null}
              </>
            );
            return (
              <li key={i.sessionId}>
                {openable ? (
                  <button
                    type="button"
                    onClick={() => onOpen(i)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
                  >
                    {inner}
                  </button>
                ) : (
                  <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left opacity-70">
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------- FE-3: the labelling -------------------------- */

function LabelScreen({
  item,
  onClose,
}: {
  item: TrainingImport;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState<ConfidenceQueue | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [at, setAt] = useState(0);
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const inFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    void fetchConfidenceQueue(item.sessionId).then((r) => {
      if (!active) return;
      setQueue(r);
      setStatus(r ? "ready" : "error");
      // Open on the first UNLABELLED piece, without re-ordering anything (N2).
      const first = r?.queue.findIndex((p) => p.label === null) ?? -1;
      setAt(first >= 0 ? first : 0);
    });
    return () => {
      active = false;
    };
  }, [item.sessionId]);

  const pieces = queue?.queue ?? [];
  const labelled = pieces.filter((p) => p.label !== null).length;
  const piece: QueuePiece | undefined = pieces[at];

  // The note belongs to the PIECE, not the screen: moving on must never carry
  // one coach's aside about a piece onto the next one, and stepping back must
  // show the note that was saved rather than an empty box.
  const pieceId = piece?.snippetId;
  useEffect(() => {
    setNote(pieces.find((p) => p.snippetId === pieceId)?.label?.note ?? "");
    // Re-reading the label here would fight the local write after a save, so
    // this deliberately keys on the piece only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceId]);

  // The answer the screen is currently showing for this piece: what the coach
  // just picked, else their saved call. Never a default (N3).
  const answered = pending ?? piece?.label?.confident ?? null;

  async function save(
    confident: boolean,
    intensity?: number,
    /** Whether to move on. Defaults to "yes, if this was a grade" — a grade
     *  finishes a piece. A note saved on blur must NOT advance, or the coach
     *  would be thrown to the next piece by clicking away from a text box. */
    opts?: { advance?: boolean }
  ) {
    if (!piece || inFlightRef.current) return;
    const trimmed = note.trim();
    const body = buildLabelBody(confident, intensity, trimmed);
    // Unconstructable = no real boolean; the UI cannot reach here without one,
    // so this is a guard, not a flow (N3).
    if (!body) return;
    inFlightRef.current = true;
    setError(null);
    const res = await saveConfidenceLabel(piece.snippetId, body);
    inFlightRef.current = false;
    if (!res.ok) {
      // The BE's 400 is verbatim-safe and its 500 names the migration.
      setError(res.error ?? "Couldn't save that label. Try again.");
      return;
    }
    const saved = {
      confident,
      intensity: intensity ?? null,
      note: trimmed || null,
    };
    setQueue((q) =>
      q
        ? {
            ...q,
            queue: q.queue.map((p) =>
              p.snippetId === piece.snippetId ? { ...p, label: saved } : p
            ),
          }
        : q
    );
    if (opts?.advance ?? intensity !== undefined) {
      // Graded — this piece is done; move on to the next unlabelled one.
      setPending(null);
      const next = pieces.findIndex(
        (p, i) => i > at && p.label === null && p.snippetId !== piece.snippetId
      );
      setAt(next >= 0 ? next : Math.min(at + 1, pieces.length - 1));
    } else {
      // Yes/No is saved on its own — intensity is optional, so the coach can
      // stop here — and the 1–5 row opens for an optional grade.
      setPending(confident);
    }
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-2xl flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">
            {item.topic || "Untitled"}
          </span>
          {item.speakerLabel ? (
            <span className="shrink-0 text-[12px] text-muted-foreground">
              · {item.speakerLabel}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {status === "ready" && pieces.length > 0 ? (
            // Progress, never a score (AC-9): how much is done, not how well.
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {labelled} / {pieces.length} labelled
            </span>
          ) : null}
          <OverlayCloseButton onClick={onClose} ariaLabel="Back to the corpus" />
        </span>
      </div>

      <div className="scrollbar-none flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : status === "error" || !queue ? (
          <p className="text-[15px] text-muted-foreground">
            Couldn&apos;t load the queue just now. Close and reopen to try
            again.
          </p>
        ) : pieces.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">
            Nothing queued to label on this import.
          </p>
        ) : piece ? (
          <>
            {/* The piece: play it, read it. NOTHING else — no read, no band,
                no ordering cue (N1/N2). */}
            {piece.audioRef && piece.durationMs > 0 ? (
              <MediaPlayer
                src={piece.audioRef}
                startOffsetMs={piece.startOffsetMs}
                durationMs={piece.durationMs}
              />
            ) : null}
            <div className="rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
              <p className="text-[15px] leading-relaxed text-foreground">
                {piece.transcript}
              </p>
            </div>

            <p className="text-[13px] font-medium text-foreground">
              Confident?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={answered === true}
                onClick={() => void save(true)}
                className={`flex-1 rounded-full border px-4 py-2.5 text-[14px] font-medium transition-colors ${
                  answered === true
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/50"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                aria-pressed={answered === false}
                onClick={() => void save(false)}
                className={`flex-1 rounded-full border px-4 py-2.5 text-[14px] font-medium transition-colors ${
                  answered === false
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/50"
                }`}
              >
                No
              </button>
            </div>

            {/* The 1–5 row exists ONLY once an answer is picked: it grades an
                answer, and offering it first would invite a grade with no
                answer behind it (N3). Bare numbers, no band words on the
                buttons — the wording would become what the coach calibrates
                to, and the scale is anchored to published research. */}
            {answered !== null ? (
              <div className="flex flex-col gap-1.5">
                <p
                  className="text-[12px] text-muted-foreground"
                  title="1 = barely, 5 = unmistakably"
                >
                  How strongly? Optional — 1 = barely, 5 = unmistakably.
                </p>
                <div className="flex gap-2">
                  {Array.from(
                    { length: INTENSITY_MAX - INTENSITY_MIN + 1 },
                    (_, i) => INTENSITY_MIN + i
                  ).map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={piece.label?.intensity === n}
                      onClick={() => void save(answered, n)}
                      className={`h-10 flex-1 rounded-full border text-[14px] font-medium tabular-nums transition-colors ${
                        piece.label?.intensity === n
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:border-primary/50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Gated behind an answer for the same reason as the 1–5 row: a
                note annotates a call, and the body builder refuses to write
                one without a real boolean anyway (N3). It is the provenance
                that explains an outlier label months later — "hard to call",
                "background noise" — so it saves on its own, without needing a
                grade the coach may not want to give. */}
            {answered !== null ? (
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-muted-foreground">
                  Anything worth remembering? Optional.
                </span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => {
                    const t = note.trim();
                    // Only when it actually changed: clicking through the
                    // screen must not fire a PUT per piece.
                    if (t !== (piece.label?.note ?? "")) {
                      void save(answered, piece.label?.intensity ?? undefined, {
                        advance: false,
                      });
                    }
                  }}
                  placeholder="hard to call · background noise · not really a talk"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
                />
              </label>
            ) : null}

            {error ? (
              <p className="text-[12px] text-destructive">{error}</p>
            ) : null}

            {/* Every piece in the session, clickable. Two reasons it is worth
                the space: the one-at-a-time queue gave no way back to a
                specific piece, and no sense of how much is left.

                What these bubbles may NEVER encode is a machine read (N1).
                They are in PAYLOAD ORDER (N2) — the queue is band-shuffled
                server-side precisely so position is not a tell, and sorting
                them would undo that. Fill means only "you have answered this
                one", which is the coach's own work, never the model's. */}
            <div className="flex flex-col gap-1.5 pt-1">
              <p className="text-[11px] text-muted-foreground">
                Every piece from this import. Tap one to hear it.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pieces.map((p, i) => {
                  const answered = p.label !== null;
                  const current = i === at;
                  return (
                    <button
                      key={p.snippetId}
                      type="button"
                      aria-label={`Piece ${i + 1}${answered ? ", answered" : ""}`}
                      aria-current={current ? "true" : undefined}
                      onClick={() => {
                        setPending(null);
                        setError(null);
                        setAt(i);
                      }}
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                        current ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : ""
                      }`}
                    >
                      {/* A DOT, not a number. The 1-5 grade row sits a few
                          pixels above; numbering these too would put two rows
                          of digits on one screen meaning entirely different
                          things. The hit area stays 24px — only the mark is
                          small. */}
                      <span
                        className={`block h-2.5 w-2.5 rounded-full border ${
                          answered
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/50 bg-transparent"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setError(null);
                  setAt((n) => Math.max(0, n - 1));
                }}
                disabled={at === 0}
                className="rounded-full border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setError(null);
                  setAt((n) => Math.min(pieces.length - 1, n + 1));
                }}
                disabled={at >= pieces.length - 1}
                className="rounded-full border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                Skip
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

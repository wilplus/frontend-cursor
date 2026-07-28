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
        <ImportPanel onImported={refresh} />
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
  status: "queued" | "running" | "done" | "failed";
  detail: string;
}

function ImportPanel({ onImported }: { onImported: () => void }) {
  const [topic, setTopic] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [note, setNote] = useState("");
  const [stages, setStages] = useState<OptionalStage[]>([]);
  const [files, setFiles] = useState<FileState[]>([]);
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const describe = (r: ImportOutcome): string => {
    if (r.ok) {
      return `${r.snippetCount} pieces · ${r.queueCount} queued to label`;
    }
    // The BE's reason is worth showing verbatim: it names WHICH content gate
    // rejected the file (silence, corrupt, too short), which is what tells the
    // coach whether to re-cut it or drop it.
    return r.error ?? r.reason ?? "Import failed. Try again.";
  };

  async function run() {
    if (running || files.length === 0 || !topic.trim()) return;
    setRunning(true);
    // SEQUENTIAL on purpose: the analysis is CPU-heavy server-side, and firing
    // a folder in parallel mostly produces timeouts rather than speed.
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "done") continue;
      setFiles((f) =>
        f.map((x, j) => (j === i ? { ...x, status: "running", detail: "" } : x))
      );
      const r = await importTrainingAudio({
        file: files[i].file,
        topic: topic.trim(),
        speakerLabel: speaker.trim() || null,
        note: note.trim() || null,
        optionalStages: stages,
      });
      setFiles((f) =>
        f.map((x, j) =>
          j === i
            ? { ...x, status: r.ok ? "done" : "failed", detail: describe(r) }
            : x
        )
      );
      if (r.ok) onImported();
    }
    setRunning(false);
  }

  const done = files.filter((f) => f.status === "done").length;

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
            picked.map((file) => ({ file, status: "queued", detail: "" }))
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
          disabled={running || files.length === 0 || !topic.trim()}
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

      {files.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li
              key={`${f.file.name}-${i}`}
              className="flex items-baseline justify-between gap-3 text-[12px]"
            >
              <span className="min-w-0 flex-1 truncate text-foreground">
                {f.file.name}
              </span>
              <span
                className={
                  f.status === "failed"
                    ? "shrink-0 text-destructive"
                    : "shrink-0 text-muted-foreground"
                }
              >
                {f.status === "queued"
                  ? "Waiting"
                  : f.status === "running"
                    ? "Analysing…"
                    : f.detail}
              </span>
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
          {imports.map((i) => (
            <li key={i.sessionId}>
              <button
                type="button"
                onClick={() => onOpen(i)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-foreground">
                    {i.topic || "Untitled"}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {i.speakerLabel ?? "No speaker label"}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </button>
            </li>
          ))}
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

  // The answer the screen is currently showing for this piece: what the coach
  // just picked, else their saved call. Never a default (N3).
  const answered = pending ?? piece?.label?.confident ?? null;

  async function save(confident: boolean, intensity?: number) {
    if (!piece || inFlightRef.current) return;
    const body = buildLabelBody(confident, intensity);
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
    const saved = { confident, intensity: intensity ?? null };
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
    if (intensity !== undefined) {
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

            {error ? (
              <p className="text-[12px] text-destructive">{error}</p>
            ) : null}

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

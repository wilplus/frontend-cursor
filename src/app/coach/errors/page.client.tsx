"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock, Plus } from "lucide-react";
import LoadingState from "@/components/willab/LoadingState";
import { founderLearning } from "@/services/api/founderLearning";
import type { PaceRow } from "@/lib/founder/pace";
import { useUserProfile } from "@/components/willab/useUserProfile";
import {
  draftProblem,
  listSpeakingErrors,
  saveSpeakingError,
  suggestErrorId,
  type SpeakingError,
  type SpeakingErrorDraft,
} from "@/services/api/speakingErrors";

/* -------------------------------------------------------------------------- */
/*  /coach/errors — THE SPEAKING ERROR LIBRARY (founder 2026-09-16)            */
/*                                                                            */
/*  "that is our goal to have the library of the errors so we can recognise    */
/*  them and we have the exercise matching algorithm and they should go hand   */
/*  in hand."                                                                  */
/*                                                                            */
/*  The screen is built around ONE distinction, because everything else about  */
/*  this library follows from it:                                              */
/*                                                                            */
/*    DETECTED — code can find this in audio. These route exercises. A coach   */
/*               cannot create, edit or retire one from here; saving over one  */
/*               would demote it to observed and silently stop it routing.     */
/*    OBSERVED — a human named it and wrote down what it is. Nothing can find  */
/*               it yet. This is the engineering backlog, and it is the only   */
/*               thing this screen writes.                                     */
/*                                                                            */
/*  So the two groups are drawn differently and the detected ones are locked   */
/*  on sight. An author who cannot tell them apart will eventually save over   */
/*  one, and the failure is silent — no exception, no log, exercises just      */
/*  stop routing.                                                             */
/*                                                                            */
/*  L3 — a row is a NAME and a DEFINITION. It is never evidence that the       */
/*  pattern occurred in a recording, so there is no clip, no take and no       */
/*  student anywhere on this screen. Naming is a hypothesis; a detector firing */
/*  on a take is a detector verdict. Those stay different things.              */
/*                                                                            */
/*  AC-9 — the definitions carry thresholds (`pause_ratio < 0.08`) because a   */
/*  definition that does not describe what the code measures is decoration.    */
/*  Those are read by an author about a DETECTOR, never shown to a speaker     */
/*  about their delivery.                                                      */
/*                                                                            */
/*  COACH ONLY (N4): renders nothing for a non-coach even by direct URL; the   */
/*  BE role-gates both endpoints independently.                                */
/* -------------------------------------------------------------------------- */

const BLANK: SpeakingErrorDraft = {
  errorId: "",
  label: "",
  definition: "",
  asks: "",
};

const INPUT =
  "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30";

/** A detector under silent test (backend 2026-09-28, D3). Locked like a
 *  detected one: the backend refuses to edit it (409 ALREADY_IN_SHADOW). */
const BEING_TESTED_NOTE =
  "Being tested silently. It routes nothing yet, and can’t be edited here.";

function EntryBadge({ status }: { status: SpeakingError["status"] }) {
  if (status === "observed") {
    return (
      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        Observed
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-background">
      <Lock className="h-2.5 w-2.5" />
      {status === "detected" ? "Detected" : "Being tested"}
    </span>
  );
}

function EntryNote({ entry }: { entry: SpeakingError }) {
  if (entry.status === "detected") {
    return (
      <p className="mt-2.5 text-[11px] text-muted-foreground">
        Routes exercises. Detected by{" "}
        <code className="text-foreground/70">{entry.detectorRef}</code>
      </p>
    );
  }
  return (
    <p className="mt-2.5 text-[11px] text-muted-foreground">
      {entry.status === "shadow"
        ? BEING_TESTED_NOTE
        : "Named, not yet detectable — it routes nothing until a detector is written for it."}
    </p>
  );
}

function EntryCard({ entry, founderLine = null }: { entry: SpeakingError; founderLine?: string | null }) {
  const locked = entry.status !== "observed";
  return (
    <li
      className={`rounded-xl border p-4 ${
        locked
          ? "border-foreground/15 bg-muted/30"
          : "border-dashed border-border bg-background"
      } ${entry.active ? "" : "opacity-55"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {entry.label}
          </h3>
          <code className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {entry.errorId}
          </code>
        </div>
        <EntryBadge status={entry.status} />
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
        {entry.definition}
      </p>
      <p className="mt-2 text-xs font-medium italic text-foreground/80">
        {entry.asks}
      </p>

      <EntryNote entry={entry} />
      {founderLine ? (
        <p className="mt-1.5 text-[11px] text-foreground/80" data-testid="founder-readiness">
          {founderLine}
        </p>
      ) : null}
      {entry.active ? null : (
        <p className="mt-1 text-[11px] text-muted-foreground">Retired.</p>
      )}
    </li>
  );
}

/** The founder's readiness line under a pattern being tested (founder
 *  2026-09-30, P2-15): how many moments a coach named it on against the
 *  bar, and how many of those the detector caught. Read from the founder's
 *  ledger; a coach never sees it (AC-9), and the backend refuses the read
 *  to anyone but the founder. Nothing here promotes a pattern. */
export function readinessLine(row: PaceRow | undefined): string {
  if (!row) return "No readiness read yet.";
  const named = row.current === null ? "—" : String(row.current);
  const caught = row.caughtRate === null ? "not measured" : `${Math.round(row.caughtRate * 100)}%`;
  const caughtBar = row.caughtBar === null ? "" : ` of ${Math.round(row.caughtBar * 100)}% needed`;
  // Signed by the founder 2026-10-06 (Navigation Panel P51b A; backend
  // decisions log N53): "Coaches heard it on {n} of {bar} checked moments."
  return `${row.ready ? "READY to propose · " : ""}Coaches heard it on ${named} of ${row.bar} checked moments. · caught ${caught}${caughtBar}`;
}

/** The cue id a shadow entry's detector names, e.g. verbal_cues:hedging → hedging. */
export function cueOf(entry: SpeakingError): string | null {
  const ref = entry.detectorRef ?? "";
  const i = ref.indexOf(":");
  return i > 0 ? ref.slice(i + 1) : ref || null;
}

/** The silent-test group, drawn only when there is one. */
function BeingTested({ entries, pace }: { entries: SpeakingError[]; pace: PaceRow[] | null }) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-9">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Being tested · routes nothing yet
      </h2>
      <ul className="mt-3 grid gap-3">
        {entries.map((entry) => (
          <EntryCard
            key={entry.errorId}
            entry={entry}
            founderLine={pace ? readinessLine(pace.find((r) => r.jar === `shadow_cues.${cueOf(entry)}`)) : null}
          />
        ))}
      </ul>
    </section>
  );
}

export default function SpeakingErrorLibraryClient({ founder = false }: { founder?: boolean }) {
  const { isCoach, loading: profileLoading } = useUserProfile();
  const [pace, setPace] = useState<PaceRow[] | null>(null);
  const [entries, setEntries] = useState<SpeakingError[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SpeakingErrorDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const result = await listSpeakingErrors();
    if (!result.ok) {
      setLoadError(result.message);
      setEntries([]);
      return;
    }
    setEntries(result.data);
  }, []);

  useEffect(() => {
    if (!founder) return;
    let live = true;
    void founderLearning.ledger().then((r) => {
      if (live && r.ok) setPace(r.value.pace);
    });
    return () => {
      live = false;
    };
  }, [founder]);

  useEffect(() => {
    if (isCoach) void refresh();
  }, [isCoach, refresh]);

  async function save() {
    if (!draft || saving) return;
    const problem = draftProblem(draft);
    if (problem) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await saveSpeakingError(draft);
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    setSaved(draft.label.trim());
    setDraft(null);
    await refresh();
  }

  if (profileLoading) return <LoadingState placement="viewport" />;
  // N4 — nothing for a non-coach, even by direct URL.
  if (!isCoach) {
    return (
      <main className="flex h-full items-center justify-center bg-background px-6">
        <p className="text-center text-[15px] text-muted-foreground">
          Nothing here.
        </p>
      </main>
    );
  }

  const detected = (entries ?? []).filter((e) => e.status === "detected");
  const observed = (entries ?? []).filter((e) => e.status === "observed");
  const beingTested = (entries ?? []).filter((e) => e.status === "shadow");

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10">
      <header>
        <h1 className="text-lg font-semibold text-foreground">
          Speaking errors
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          The patterns we can name, and the smaller set we can actually find in
          audio. Naming one here does not make it detectable — it files it so a
          detector can be written for it.
        </p>
      </header>

      {entries === null ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {loadError ? (
            <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {loadError}
            </p>
          ) : null}

          <section className="mt-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Detected in audio · routes exercises
            </h2>
            {detected.length ? (
              <ul className="mt-3 grid gap-3">
                {detected.map((entry) => (
                  <EntryCard key={entry.errorId} entry={entry} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Nothing detectable yet.
              </p>
            )}
          </section>

          <BeingTested entries={beingTested} pace={founder ? pace : null} />

          <section className="mt-9">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Named only · waiting on a detector
            </h2>
            {observed.length ? (
              <ul className="mt-3 grid gap-3">
                {observed.map((entry) => (
                  <EntryCard key={entry.errorId} entry={entry} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Nothing named yet. When you notice a pattern, add it here — it
                does not need to be detectable to be worth writing down.
              </p>
            )}
          </section>
        </>
      )}

      {saved ? (
        <p className="mt-6 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          “{saved}” is filed. It routes nothing until a detector is written for
          it.
        </p>
      ) : null}

      {draft ? (
        <section className="mt-6 rounded-xl border border-border bg-muted/20 p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Name a pattern
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Write what is <em>measured</em>, not how to fix it, and one question
            it answers. A name with no definition is the exact defect the
            construct fence exists to prevent.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="text-xs font-medium text-foreground">
              Name
              <input
                value={draft.label}
                onChange={(event) =>
                  setDraft((prev) => {
                    if (!prev) return prev;
                    const label = event.target.value;
                    // Follow the label until the author edits the id himself,
                    // so the common case never has to think about shape.
                    const tracking =
                      prev.errorId === suggestErrorId(prev.label);
                    return {
                      ...prev,
                      label,
                      errorId: tracking ? suggestErrorId(label) : prev.errorId,
                    };
                  })
                }
                placeholder="Trailing mumble"
                className={INPUT}
              />
            </label>
            <label className="text-xs font-medium text-foreground">
              Id
              <input
                value={draft.errorId}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev ? { ...prev, errorId: event.target.value } : prev,
                  )
                }
                placeholder="trailing_mumble"
                className={`${INPUT} font-mono`}
              />
              <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                Lower-case, underscores. Exercises claim these strings exactly.
              </span>
            </label>
            <label className="text-xs font-medium text-foreground">
              What is measured
              <textarea
                rows={4}
                value={draft.definition}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev ? { ...prev, definition: event.target.value } : prev,
                  )
                }
                placeholder="The last words of a sentence lose volume and articulation while the pace stays even."
                className={`${INPUT} resize-y`}
              />
            </label>
            <label className="text-xs font-medium text-foreground">
              The one question it asks
              <input
                value={draft.asks}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev ? { ...prev, asks: event.target.value } : prev,
                  )
                }
                placeholder="Did the speaker carry the end of the sentence?"
                className={INPUT}
              />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              File it
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setSaveError(null);
              }}
              className="text-xs text-muted-foreground underline underline-offset-4"
            >
              Cancel
            </button>
          </div>
          {saveError ? (
            <p className="mt-3 text-xs leading-relaxed text-destructive">
              {saveError}
            </p>
          ) : null}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft({ ...BLANK });
            setSaved(null);
          }}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
        >
          <Plus className="h-3.5 w-3.5" />
          Name a pattern
        </button>
      )}
    </main>
  );
}

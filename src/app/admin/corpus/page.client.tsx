"use client";

/* -------------------------------------------------------------------------- */
/*  /admin/corpus — the founder tidies the training corpus (Q-B15 A). Every   */
/*  import, archived ones included; "Hide" ARCHIVES (the backend's DELETE:    */
/*  the row leaves the coach's list, the pieces, the labels and the audio     */
/*  stay) and "Restore" undoes it. Nothing here destroys corpus: the backend  */
/*  has no destructive delete, and this page does not pretend to one.        */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import LoadingState from "@/components/willab/LoadingState";
import { useUserProfile } from "@/components/willab/useUserProfile";
import {
  archiveTrainingImport, fetchTrainingImports, restoreTrainingImport, languageLabel, type TrainingImport,
} from "@/services/api/trainingCorpus";
import { ADMIN_CORPUS_COPY as COPY, requestFailedLine } from "@/lib/willab/adminCorpusCopy";

const BUTTON = "rounded-full border border-border px-3 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40";

export default function AdminCorpusClient() {
  const { isCoach, loading } = useUserProfile();
  const [imports, setImports] = useState<TrainingImport[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void fetchTrainingImports(null, { includeArchived: true }).then((r) => {
      setImports(r);
      setFailed(r === null);
    });
  }, []);
  useEffect(() => {
    if (isCoach) refresh();
  }, [isCoach, refresh]);

  async function act(im: TrainingImport, archive: boolean): Promise<void> {
    if (busy) return;
    setBusy(im.sessionId);
    setError(null);
    const result = archive ? await archiveTrainingImport(im.sessionId) : await restoreTrainingImport(im.sessionId);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? requestFailedLine(result.status));
      return;
    }
    refresh();
  }

  if (loading) return <LoadingState placement="viewport" />;
  if (!isCoach) return null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10" data-testid="admin-corpus">
      <header>
        <h1 className="text-lg font-semibold text-foreground">{COPY.title}</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {COPY.intro}
        </p>
      </header>
      {error ? <p role="alert" className="mt-4 text-xs text-destructive">{error}</p> : null}
      {imports === null ? (
        failed ? <p className="mt-6 text-sm text-muted-foreground">{COPY.loadFailed}</p> : null
      ) : imports.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{COPY.empty}</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {imports.map((im) => (
            <li key={im.sessionId} data-testid="admin-corpus-row"
              className={`flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 ${im.archivedAt ? "opacity-60" : ""}`}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{im.topic || COPY.untitled}</span>
                <span className="block text-[12px] text-muted-foreground">
                  {[im.speakerLabel ?? COPY.noSpeakerLabel, im.language ? languageLabel(im.language) : COPY.autoDetected,
                    im.setupComplete ? null : COPY.setupNotFinished, im.archivedAt ? COPY.hidden : null]
                    .filter(Boolean).join(" · ")}
                </span>
              </span>
              {im.archivedAt ? (
                <button type="button" className={BUTTON} disabled={busy !== null} onClick={() => void act(im, false)}>{COPY.restore}</button>
              ) : (
                <button type="button" className={BUTTON} disabled={busy !== null} onClick={() => void act(im, true)}>{COPY.hide}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

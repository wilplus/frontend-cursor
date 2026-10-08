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
      setError(result.error ?? `Request failed (HTTP ${result.status}).`);
      return;
    }
    refresh();
  }

  if (loading) return <LoadingState placement="viewport" />;
  if (!isCoach) return null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10" data-testid="admin-corpus">
      <header>
        <h1 className="text-lg font-semibold text-foreground">Training corpus</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Every import, hidden ones included. Hiding takes an import out of the coaches&apos; list; its moments, labels and audio stay.
        </p>
      </header>
      {error ? <p role="alert" className="mt-4 text-xs text-destructive">{error}</p> : null}
      {imports === null ? (
        failed ? <p className="mt-6 text-sm text-muted-foreground">Couldn&apos;t load the corpus just now. Reload to try again.</p> : null
      ) : imports.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing imported yet.</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {imports.map((im) => (
            <li key={im.sessionId} data-testid="admin-corpus-row"
              className={`flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 ${im.archivedAt ? "opacity-60" : ""}`}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{im.topic || "Untitled"}</span>
                <span className="block text-[12px] text-muted-foreground">
                  {[im.speakerLabel ?? "No speaker label", im.language ? languageLabel(im.language) : "Auto-detected",
                    im.setupComplete ? null : "set-up not finished", im.archivedAt ? "hidden" : null]
                    .filter(Boolean).join(" · ")}
                </span>
              </span>
              {im.archivedAt ? (
                <button type="button" className={BUTTON} disabled={busy !== null} onClick={() => void act(im, false)}>Restore</button>
              ) : (
                <button type="button" className={BUTTON} disabled={busy !== null} onClick={() => void act(im, true)}>Hide</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

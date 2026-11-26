"use client";

import { useRef, useState, type FormEvent } from "react";
import { COACH_PANEL_COPY as copy } from "@/lib/willab/coachPanelCopy";
import { IMPORT_LANGUAGES, OPTIONAL_STAGES, type OptionalStage } from "@/services/api/trainingCorpus";
import { batchFailLine, importBatch, inNameOrder, MAX_BATCH_FILES } from "../../coachpanel/corpusBatch";
import { Bubble, choiceBubble } from "./ui";
import { patternInput } from "./speakingPatterns";

export default function CalibrationCorpusUpload({ onBack, onComplete }: {
  onBack: () => void;
  onComplete: (notice: string, failure: string | null) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [stages, setStages] = useState<OptionalStage[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [failure, setFailure] = useState("");
  const pending = useRef(false);
  const ready = files.length > 0 && progress === null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending.current) return;
    const fields = new FormData(event.currentTarget);
    const topic = String(fields.get("topic") ?? "").trim();
    const language = String(fields.get("language") ?? "-");
    if (!topic || language === "-") {
      setFailure("Add a topic and choose the spoken language.");
      return;
    }
    pending.current = true;
    setFailure("");
    setProgress("Starting import…");
    try {
      const result = await importBatch(files, {
        topic, language: language === "auto" ? "" : language, optionalStages: stages,
        speakerLabel: String(fields.get("speaker") ?? "").trim() || null,
        note: String(fields.get("source") ?? "").trim() || null,
      }, {
        onFile(index) { setProgress(`${files[index].name} · ${copy.fileOf(index + 1, files.length)}`); },
        onAccepted() {},
      });
      const error = batchFailLine(result, files.length > 1, "Couldn’t import the recording.");
      if (result.imported > 0) {
        onComplete(`${copy.imported} ${result.imported} of ${files.length} · ${copy.moments(result.moments)}`, error);
      } else {
        setFailure(error ?? "Couldn’t import the recording.");
      }
    } catch {
      setFailure("Couldn’t finish the import. You can retry the same files.");
    } finally {
      pending.current = false;
      setProgress(null);
    }
  }

  return <>
    <button type="button" className={choiceBubble(false)} disabled={progress !== null} onClick={onBack}>Back to Training Corpus</button>
    <Bubble>Choose files to import. Each file becomes a recording with clips you can review here.</Bubble>
    <form className="flex w-full max-w-2xl flex-col gap-3" onSubmit={submit}>
      <fieldset disabled={progress !== null} className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">Import audio</legend>
        <label className="flex flex-col gap-1">{copy.chooseAFile}
          <input className={patternInput} type="file" multiple accept="audio/*,video/mp4" onChange={event => {
            const picked = inNameOrder(Array.from(event.target.files ?? []));
            if (picked.length > MAX_BATCH_FILES) {
              event.target.value = "";
              setFiles([]);
              setFailure(copy.upToFiles(MAX_BATCH_FILES));
              return;
            }
            setFiles(picked); setFailure("");
          }} />
        </label>
        <label className="flex flex-col gap-1">{copy.whatTheTalkIsAbout}
          <input className={patternInput} required name="topic" placeholder={copy.topicPlaceholder} />
        </label>
        <label className="flex flex-col gap-1">{copy.whatLanguageItIsIn}
          <select className={patternInput} defaultValue="-" name="language" required>
            <option value="-" disabled>{copy.chooseLanguage}</option>
            {IMPORT_LANGUAGES.map(language => <option key={language.code || "auto"} value={language.code || "auto"}>{language.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">{copy.whoseVoiceThisIs}
          <input className={patternInput} name="speaker" placeholder={copy.speakerPlaceholder} />
          <span className="text-sm text-muted-foreground">{copy.speakerHint}</span>
        </label>
        <label className="flex flex-col gap-1">{copy.whereItCameFrom}
          <input className={patternInput} name="source" placeholder={copy.sourcePlaceholder} />
        </label>
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer">{copy.whatToRun}</summary>
          <p className="mt-2">{copy.runConfidenceHint}</p>
          <div className="mt-2 flex flex-col gap-2">
            {OPTIONAL_STAGES.map((stage, index) => <label key={stage} className="flex items-center gap-2">
              <input type="checkbox" checked={stages.includes(stage)} onChange={event => {
                setStages(previous => event.target.checked ? [...previous, stage] : previous.filter(value => value !== stage));
              }} />
              {index === 0 ? copy.runAnalytics : copy.runIdealText}
            </label>)}
          </div>
        </details>
        <button type="submit" className={choiceBubble(true)} disabled={!ready}>{copy.importPill}</button>
      </fieldset>
    </form>
    {progress && <Bubble role="status">{progress}</Bubble>}
    {failure && <Bubble role="alert">{failure}</Bubble>}
  </>;
}

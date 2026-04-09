"use client";

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import SectionCard from "@/components/admin/SectionCard";
import { type AdminApiError, adminApi } from "@/lib/api/admin-client";

type Props = {
  onUploaded?: (recordingId: string) => void;
};

export default function ExternalRecordingUploadCard({ onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [sourceKind, setSourceKind] = useState<"internet" | "coach_upload" | "manual_import">(
    "coach_upload"
  );
  const [overallQuality, setOverallQuality] = useState<"good" | "bad" | "unclear">("good");
  const [confidenceScore, setConfidenceScore] = useState<number>(8);
  const [coachStyleScore, setCoachStyleScore] = useState<number>(8);
  const [rubricVersion, setRubricVersion] = useState("v1");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [speakerLabel, setSpeakerLabel] = useState("");
  const [languageCode, setLanguageCode] = useState("en");
  const [transcriptText, setTranscriptText] = useState("");
  const [importNotes, setImportNotes] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const scoresValid = useMemo(
    () =>
      Number.isInteger(confidenceScore) &&
      confidenceScore >= 1 &&
      confidenceScore <= 10 &&
      Number.isInteger(coachStyleScore) &&
      coachStyleScore >= 1 &&
      coachStyleScore <= 10,
    [coachStyleScore, confidenceScore]
  );

  const canSubmit = !!file && !busy && scoresValid && rubricVersion.trim().length > 0;

  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  function getErrorMessage(error: unknown): string {
    const apiError = error as AdminApiError | undefined;
    if (apiError?.status === 401) return "Unauthorized. Please sign in again.";
    if (apiError?.status === 403) return "Forbidden. Admin access is required.";
    return apiError?.message ?? "Upload failed";
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      toast.error("Choose an audio file first.");
      return;
    }
    if (!scoresValid) {
      toast.error("Confidence and coach style scores must be integers 1-10.");
      return;
    }
    if (!rubricVersion.trim()) {
      toast.error("Rubric version is required.");
      return;
    }

    const formData = new FormData();
    formData.set("audio_file", file);
    formData.set("source_kind", sourceKind);
    formData.set("overall_quality", overallQuality);
    formData.set("confidence_score", String(confidenceScore));
    formData.set("coach_style_score", String(coachStyleScore));
    formData.set("rubric_version", rubricVersion.trim());

    if (sourceUrl.trim()) formData.set("source_url", sourceUrl.trim());
    if (sourceTitle.trim()) formData.set("source_title", sourceTitle.trim());
    if (speakerLabel.trim()) formData.set("speaker_label", speakerLabel.trim());
    if (languageCode.trim()) formData.set("language_code", languageCode.trim());
    if (transcriptText.trim()) formData.set("transcript_text", transcriptText.trim());
    if (importNotes.trim()) formData.set("import_notes", importNotes.trim());
    if (reviewNotes.trim()) formData.set("review_notes", reviewNotes.trim());

    setBusy(true);
    try {
      const response = await adminApi.uploadExternalRecording(formData);
      const generatedCount = Number(response.generated_snippets_count ?? 0);
      const generatedPart =
        generatedCount > 0 ? ` · ${generatedCount} stress snippet${generatedCount === 1 ? "" : "s"} generated` : "";
      toast.success(`Uploaded recording ${response.recording_id}${generatedPart}`);
      onUploaded?.(response.recording_id);

      setFile(null);
      setFileInputKey((value) => value + 1);
      setSourceUrl("");
      setSourceTitle("");
      setSpeakerLabel("");
      setTranscriptText("");
      setImportNotes("");
      setReviewNotes("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Upload External Recording">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Audio file</span>
            <input
              key={fileInputKey}
              type="file"
              accept="audio/*"
              onChange={onPickFile}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Source kind</span>
            <select
              value={sourceKind}
              onChange={(event) =>
                setSourceKind(event.target.value as "internet" | "coach_upload" | "manual_import")
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="coach_upload">Coach upload</option>
              <option value="internet">Internet</option>
              <option value="manual_import">Manual import</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Overall quality</span>
            <select
              value={overallQuality}
              onChange={(event) => setOverallQuality(event.target.value as "good" | "bad" | "unclear")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="good">Good</option>
              <option value="bad">Bad</option>
              <option value="unclear">Unclear</option>
            </select>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Confidence (1-10)</span>
              <input
                type="number"
                min={1}
                max={10}
                value={confidenceScore}
                onChange={(event) => setConfidenceScore(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Coach style (1-10)</span>
              <input
                type="number"
                min={1}
                max={10}
                value={coachStyleScore}
                onChange={(event) => setCoachStyleScore(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Rubric version</span>
              <input
                value={rubricVersion}
                onChange={(event) => setRubricVersion(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
          </div>

          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Source URL</span>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://..."
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Source title</span>
            <input
              value={sourceTitle}
              onChange={(event) => setSourceTitle(event.target.value)}
              placeholder="Clip title"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Speaker label</span>
            <input
              value={speakerLabel}
              onChange={(event) => setSpeakerLabel(event.target.value)}
              placeholder="Speaker"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Language code</span>
            <input
              value={languageCode}
              onChange={(event) => setLanguageCode(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Transcript text (optional)</span>
          <textarea
            rows={3}
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Import notes (optional)</span>
          <textarea
            rows={2}
            value={importNotes}
            onChange={(event) => setImportNotes(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Review notes (optional)</span>
          <textarea
            rows={2}
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Upload creates recording + initial review. Scores must be integers 1-10.
          </p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            <UploadCloud className="h-4 w-4" />
            {busy ? "Uploading..." : "Upload recording"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

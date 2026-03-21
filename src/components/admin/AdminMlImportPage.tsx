"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminApi,
  type AdminImportedRecording,
  type AdminRecordingImportResponse,
  type RecordingReview,
} from "@/lib/api/admin-client";

const QUALITY_OPTIONS = [
  { value: "good", label: "Good" },
  { value: "bad", label: "Bad" },
  { value: "unclear", label: "Unclear" },
] as const;

const DEFAULT_LIMIT = 10;
const DEFAULT_RUBRIC_VERSION = "v1";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatBytes(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function formatDurationMs(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getRecordingTitle(recording: AdminImportedRecording): string {
  return (
    recording.source_metadata.source_title ||
    recording.original_filename ||
    recording.source_metadata.speaker_label ||
    recording.recording_id
  );
}

function getQualityBadgeClasses(value: RecordingReview["overall_quality"] | null | undefined): string {
  switch (value) {
    case "good":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "bad":
      return "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200";
    default:
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  }
}

export default function AdminMlImportPage() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioInputKey, setAudioInputKey] = useState(0);
  const [sourceKind, setSourceKind] = useState("internet");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [speakerLabel, setSpeakerLabel] = useState("");
  const [languageCode, setLanguageCode] = useState("en");
  const [transcriptText, setTranscriptText] = useState("");
  const [importNotes, setImportNotes] = useState("");
  const [overallQuality, setOverallQuality] =
    useState<(typeof QUALITY_OPTIONS)[number]["value"]>("unclear");
  const [confidenceScore, setConfidenceScore] = useState("5");
  const [coachStyleScore, setCoachStyleScore] = useState("5");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AdminRecordingImportResponse | null>(null);

  const [imports, setImports] = useState<AdminImportedRecording[]>([]);
  const [totalImports, setTotalImports] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [importsLoading, setImportsLoading] = useState(false);
  const [importsError, setImportsError] = useState<string | null>(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<AdminImportedRecording | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [detailOverallQuality, setDetailOverallQuality] =
    useState<(typeof QUALITY_OPTIONS)[number]["value"]>("unclear");
  const [detailConfidenceScore, setDetailConfidenceScore] = useState("5");
  const [detailCoachStyleScore, setDetailCoachStyleScore] = useState("5");
  const [detailReviewNotes, setDetailReviewNotes] = useState("");
  const [detailRubricVersion, setDetailRubricVersion] = useState(DEFAULT_RUBRIC_VERSION);
  const [savingReview, setSavingReview] = useState(false);

  const importsLoadIdRef = useRef(0);
  const detailLoadIdRef = useRef(0);

  const uploadScoresValid = useMemo(() => {
    if (!audioFile) return false;
    const confidence = Number(confidenceScore);
    const coachStyle = Number(coachStyleScore);
    return (
      Number.isInteger(confidence) &&
      confidence >= 1 &&
      confidence <= 10 &&
      Number.isInteger(coachStyle) &&
      coachStyle >= 1 &&
      coachStyle <= 10
    );
  }, [audioFile, coachStyleScore, confidenceScore]);

  const detailScoresValid = useMemo(() => {
    const confidence = Number(detailConfidenceScore);
    const coachStyle = Number(detailCoachStyleScore);
    return (
      !!selectedRecordingId &&
      detailRubricVersion.trim().length > 0 &&
      Number.isInteger(confidence) &&
      confidence >= 1 &&
      confidence <= 10 &&
      Number.isInteger(coachStyle) &&
      coachStyle >= 1 &&
      coachStyle <= 10
    );
  }, [detailCoachStyleScore, detailConfidenceScore, detailRubricVersion, selectedRecordingId]);

  const totalPages = Math.max(1, Math.ceil(totalImports / DEFAULT_LIMIT));

  useEffect(() => {
    const loadId = ++importsLoadIdRef.current;
    setImportsLoading(true);
    setImportsError(null);

    adminApi
      .getRecordingImports({
        limit: DEFAULT_LIMIT,
        offset: currentPage * DEFAULT_LIMIT,
      })
      .then((response) => {
        if (loadId !== importsLoadIdRef.current) return;
        setImports(response.recordings);
        setTotalImports(response.total);
        setSelectedRecordingId((previous) => {
          const preferredId = pendingSelectionId;
          if (preferredId && response.recordings.some((item) => item.recording_id === preferredId)) {
            return preferredId;
          }
          if (previous && response.recordings.some((item) => item.recording_id === previous)) {
            return previous;
          }
          return response.recordings[0]?.recording_id ?? null;
        });
        if (pendingSelectionId) {
          setPendingSelectionId(null);
        }
      })
      .catch((error) => {
        if (loadId !== importsLoadIdRef.current) return;
        setImports([]);
        setTotalImports(0);
        setImportsError(error instanceof Error ? error.message : "Failed to load imports");
      })
      .finally(() => {
        if (loadId === importsLoadIdRef.current) {
          setImportsLoading(false);
        }
      });
  }, [currentPage, pendingSelectionId, reloadKey]);

  useEffect(() => {
    if (!selectedRecordingId) {
      setSelectedRecording(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    const loadId = ++detailLoadIdRef.current;
    setDetailLoading(true);
    setDetailError(null);

    adminApi
      .getRecordingImportDetail(selectedRecordingId)
      .then((recording) => {
        if (loadId !== detailLoadIdRef.current) return;
        setSelectedRecording(recording);
        setImports((previous) =>
          previous.map((item) =>
            item.recording_id === recording.recording_id ? { ...item, ...recording } : item
          )
        );
      })
      .catch((error) => {
        if (loadId !== detailLoadIdRef.current) return;
        setSelectedRecording(null);
        setDetailError(error instanceof Error ? error.message : "Failed to load recording");
      })
      .finally(() => {
        if (loadId === detailLoadIdRef.current) {
          setDetailLoading(false);
        }
      });
  }, [reloadKey, selectedRecordingId]);

  useEffect(() => {
    const review = selectedRecording?.latest_review;
    if (!selectedRecording) {
      setDetailOverallQuality("unclear");
      setDetailConfidenceScore("5");
      setDetailCoachStyleScore("5");
      setDetailReviewNotes("");
      setDetailRubricVersion(DEFAULT_RUBRIC_VERSION);
      return;
    }

    setDetailOverallQuality(review?.overall_quality ?? "unclear");
    setDetailConfidenceScore(String(review?.confidence_score ?? 5));
    setDetailCoachStyleScore(String(review?.coach_style_score ?? 5));
    setDetailReviewNotes(review?.notes ?? "");
    setDetailRubricVersion(review?.rubric_version || DEFAULT_RUBRIC_VERSION);
  }, [selectedRecording]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAudioFile(event.target.files?.[0] ?? null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!audioFile) {
      toast.error("Choose an audio file before importing.");
      return;
    }
    if (!uploadScoresValid) {
      toast.error("Confidence score and coach-style score must both be integers between 1 and 10.");
      return;
    }

    const formData = new FormData();
    formData.set("audio_file", audioFile);
    formData.set("source_kind", sourceKind);
    formData.set("overall_quality", overallQuality);
    formData.set("confidence_score", String(Number(confidenceScore)));
    formData.set("coach_style_score", String(Number(coachStyleScore)));
    formData.set("rubric_version", DEFAULT_RUBRIC_VERSION);

    if (sourceUrl.trim()) formData.set("source_url", sourceUrl.trim());
    if (sourceTitle.trim()) formData.set("source_title", sourceTitle.trim());
    if (speakerLabel.trim()) formData.set("speaker_label", speakerLabel.trim());
    if (languageCode.trim()) formData.set("language_code", languageCode.trim());
    if (transcriptText.trim()) formData.set("transcript_text", transcriptText.trim());
    if (importNotes.trim()) formData.set("import_notes", importNotes.trim());
    if (reviewNotes.trim()) formData.set("review_notes", reviewNotes.trim());

    setSubmitting(true);
    setResult(null);
    try {
      const response = await adminApi.importRecording(formData);
      setResult(response);
      setAudioFile(null);
      setAudioInputKey((value) => value + 1);
      setSourceUrl("");
      setSourceTitle("");
      setSpeakerLabel("");
      setTranscriptText("");
      setImportNotes("");
      setReviewNotes("");
      setPendingSelectionId(response.recording_id);
      if (currentPage !== 0) {
        setCurrentPage(0);
      }
      toast.success("Recording imported and labeled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import recording");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveReview = async () => {
    if (!selectedRecordingId) {
      toast.error("Choose a recording before saving labels.");
      return;
    }
    if (!detailScoresValid) {
      toast.error("Review scores must be integers between 1 and 10, and rubric version is required.");
      return;
    }

    setSavingReview(true);
    setDetailError(null);
    try {
      const response = await adminApi.patchRecordingReview(selectedRecordingId, {
        overall_quality: detailOverallQuality,
        confidence_score: Number(detailConfidenceScore),
        coach_style_score: Number(detailCoachStyleScore),
        notes: detailReviewNotes.trim() || null,
        rubric_version: detailRubricVersion.trim(),
      });

      setSelectedRecording((previous) =>
        previous && previous.recording_id === selectedRecordingId
          ? { ...previous, latest_review: response.review }
          : previous
      );
      setImports((previous) =>
        previous.map((item) =>
          item.recording_id === selectedRecordingId
            ? { ...item, latest_review: response.review }
            : item
        )
      );
      toast.success("Recording review saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save review";
      setDetailError(message);
      toast.error(message);
    } finally {
      setSavingReview(false);
    }
  };

  const selectedReview = selectedRecording?.latest_review;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/students">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Students
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">ML Imports</h1>
            <p className="mt-1 text-muted-foreground">
              Upload external recordings, review imported items, and edit the latest labeling pass in one place.
            </p>
          </div>
        </div>
      </div>

      <Card className="border border-border bg-muted/20 p-5">
        <p className="text-sm font-medium text-foreground">What this page is for</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use this for internet, coach, or manually collected recordings that should enter the same ML labeling
          pipeline as app-generated recordings. Imports now stay editable after upload, with a paginated list, detail
          pane, and direct review PATCH flow.
        </p>
      </Card>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Recording Source</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Audio file</label>
              <input
                key={audioInputKey}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Accepts common audio formats like `mp3`, `wav`, `m4a`, `webm`, or `mp4`.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Source kind</label>
              <select
                value={sourceKind}
                onChange={(event) => setSourceKind(event.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="internet">Internet</option>
                <option value="coach_upload">Coach upload</option>
                <option value="manual_import">Manual import</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Source URL</label>
              <Input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://example.com/original-source"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Source title</label>
              <Input
                value={sourceTitle}
                onChange={(event) => setSourceTitle(event.target.value)}
                placeholder="Podcast clip, YouTube talk, internal sample..."
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Speaker label</label>
              <Input
                value={speakerLabel}
                onChange={(event) => setSpeakerLabel(event.target.value)}
                placeholder="Optional speaker name or alias"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Language code</label>
              <Input
                value={languageCode}
                onChange={(event) => setLanguageCode(event.target.value)}
                placeholder="en"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium text-foreground">Transcript text</label>
            <textarea
              value={transcriptText}
              onChange={(event) => setTranscriptText(event.target.value)}
              rows={6}
              placeholder="Optional transcript if you already have one."
              className="min-h-[140px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium text-foreground">Import notes</label>
            <textarea
              value={importNotes}
              onChange={(event) => setImportNotes(event.target.value)}
              rows={4}
              placeholder="Where this came from, consent/licensing notes, why it matters, etc."
              className="min-h-[110px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Initial ML Label</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Overall quality</label>
              <select
                value={overallQuality}
                onChange={(event) =>
                  setOverallQuality(event.target.value as (typeof QUALITY_OPTIONS)[number]["value"])
                }
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {QUALITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Confidence score</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={confidenceScore}
                onChange={(event) => setConfidenceScore(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Coach-style score</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={coachStyleScore}
                onChange={(event) => setCoachStyleScore(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium text-foreground">Review notes</label>
            <textarea
              value={reviewNotes}
              onChange={(event) => setReviewNotes(event.target.value)}
              rows={5}
              placeholder="Optional first-pass label notes for later ML export."
              className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!uploadScoresValid || submitting} className="rounded-xl px-5">
            <Upload className="mr-2 h-4 w-4" />
            {submitting ? "Importing…" : "Import Recording"}
          </Button>
          <p className="text-sm text-muted-foreground">
            The backend creates the `recording_id`, saves the first review, and makes the import available in the list
            below.
          </p>
        </div>
      </form>

      {result ? (
        <Card className="border border-emerald-200 bg-emerald-50/60 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Import complete</h2>
              <p className="text-sm text-muted-foreground">
                Recording <span className="font-mono text-foreground">{result.recording_id}</span> was created.
                {result.review_id ? (
                  <>
                    {" "}
                    Initial review <span className="font-mono text-foreground">{result.review_id}</span> was saved too.
                  </>
                ) : null}
              </p>
              {result.message ? <p className="text-sm text-foreground">{result.message}</p> : null}
              {result.playback_url ? (
                <a
                  href={result.playback_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline"
                >
                  Open playback URL
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Imported recordings</h2>
              <p className="text-sm text-muted-foreground">
                {totalImports > 0
                  ? `${totalImports} imported recording${totalImports === 1 ? "" : "s"}`
                  : "No imported recordings yet"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={importsLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4${importsLoading ? " animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {importsError ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-200">
              {importsError}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {importsLoading ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading imported recordings…
              </div>
            ) : imports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Import a recording to start building the admin ML dataset list.
              </div>
            ) : (
              imports.map((recording) => {
                const isSelected = recording.recording_id === selectedRecordingId;
                const latestReview = recording.latest_review;
                return (
                  <button
                    key={recording.recording_id}
                    type="button"
                    onClick={() => setSelectedRecordingId(recording.recording_id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{getRecordingTitle(recording)}</p>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {recording.recording_id}
                        </p>
                      </div>
                      {latestReview ? (
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getQualityBadgeClasses(
                            latestReview.overall_quality
                          )}`}
                        >
                          {latestReview.overall_quality}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                          No review
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{recording.source_metadata.source_kind || "unknown source"}</span>
                      <span>{formatDateTime(recording.created_at)}</span>
                      {recording.playback_url ? <span>playback ready</span> : <span>no playback URL</span>}
                    </div>

                    {latestReview ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Confidence {latestReview.confidence_score}/10 · Coach style {latestReview.coach_style_score}/10
                      </p>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {totalImports > DEFAULT_LIMIT ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Page {currentPage + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                  disabled={currentPage === 0 || importsLoading}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
                  disabled={currentPage >= totalPages - 1 || importsLoading}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Recording detail</h2>
              <p className="text-sm text-muted-foreground">
                Playback, metadata, transcript, and the latest review for the selected import.
              </p>
            </div>
            {selectedRecording?.playback_url ? (
              <a
                href={selectedRecording.playback_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline"
              >
                Open playback URL
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>

          {detailLoading ? (
            <div className="flex min-h-60 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading recording detail…
            </div>
          ) : detailError ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-200">
              {detailError}
            </div>
          ) : !selectedRecording ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Select an imported recording from the list to inspect and relabel it.
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{getRecordingTitle(selectedRecording)}</h3>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedRecording.recording_id}</p>
                  </div>
                  {selectedReview ? (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getQualityBadgeClasses(
                        selectedReview.overall_quality
                      )}`}
                    >
                      Latest review: {selectedReview.overall_quality}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      No review yet
                    </span>
                  )}
                </div>

                <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Imported at</p>
                    <p className="mt-1 font-medium">{formatDateTime(selectedRecording.created_at)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Processing status</p>
                    <p className="mt-1 font-medium">{selectedRecording.processing_status || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Source kind</p>
                    <p className="mt-1 font-medium">{selectedRecording.source_metadata.source_kind || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Original file</p>
                    <p className="mt-1 font-medium">{selectedRecording.original_filename || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
                    <p className="mt-1 font-medium">{formatDurationMs(selectedRecording.duration_ms)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">File size</p>
                    <p className="mt-1 font-medium">{formatBytes(selectedRecording.file_size_bytes)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold">Playback</h3>
                {selectedRecording.playback_url ? (
                  <audio controls src={selectedRecording.playback_url} className="w-full" preload="none" />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No signed playback URL is available for this recording yet.
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Source title</label>
                  <Input value={selectedRecording.source_metadata.source_title || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Speaker label</label>
                  <Input value={selectedRecording.source_metadata.speaker_label || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Language code</label>
                  <Input value={selectedRecording.source_metadata.language_code || ""} readOnly />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Source URL</label>
                  <Input value={selectedRecording.source_metadata.source_url || ""} readOnly />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Transcript</label>
                <textarea
                  readOnly
                  rows={6}
                  value={selectedRecording.source_metadata.transcript_text || ""}
                  className="min-h-[140px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Import notes</label>
                <textarea
                  readOnly
                  rows={4}
                  value={selectedRecording.source_metadata.import_notes || ""}
                  className="min-h-[110px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none"
                />
              </div>

              <div className="border-t border-border pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Latest review</h3>
                    <p className="text-sm text-muted-foreground">
                      Save label edits with the new recording-based review PATCH endpoint.
                    </p>
                  </div>
                  <Button type="button" onClick={handleSaveReview} disabled={!detailScoresValid || savingReview}>
                    {savingReview ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save review
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Overall quality</label>
                    <select
                      value={detailOverallQuality}
                      onChange={(event) =>
                        setDetailOverallQuality(event.target.value as (typeof QUALITY_OPTIONS)[number]["value"])
                      }
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      {QUALITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Confidence score</label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={detailConfidenceScore}
                      onChange={(event) => setDetailConfidenceScore(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Coach-style score</label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={detailCoachStyleScore}
                      onChange={(event) => setDetailCoachStyleScore(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Rubric version</label>
                    <Input
                      value={detailRubricVersion}
                      onChange={(event) => setDetailRubricVersion(event.target.value)}
                      placeholder={DEFAULT_RUBRIC_VERSION}
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-medium text-foreground">Review notes</label>
                  <textarea
                    value={detailReviewNotes}
                    onChange={(event) => setDetailReviewNotes(event.target.value)}
                    rows={5}
                    placeholder="Optional review notes for this imported recording."
                    className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  `overall_quality` stays categorical, both numeric scores stay `1-10`, and `rubric_version` is
                  included on every save so new review rows can be created when needed.
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

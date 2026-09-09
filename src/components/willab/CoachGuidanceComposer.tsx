"use client";

import { useRef, useState } from "react";
import { Loader2, Video } from "lucide-react";
import SpeechDataPanel from "./SpeechDataPanel";
import {
  submitCoachGuidance,
  type CoachGuidanceItem,
} from "@/services/api/coachGuidanceDelivery";

export default function CoachGuidanceComposer({
  item,
  enabled,
}: {
  item: CoachGuidanceItem;
  enabled: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [asExercise, setAsExercise] = useState(item.exerciseEligible);
  const [publishToCatalog, setPublishToCatalog] = useState(false);
  const [independentCleanMedia, setIndependentCleanMedia] = useState(false);
  const [exerciseKey, setExerciseKey] = useState("");
  const [exerciseInstruction, setExerciseInstruction] = useState("");
  const [subcategory, setSubcategory] = useState<"structure" | "delivery" | null>(
    null,
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  if (!enabled) return null;

  const submit = async () => {
    if (status === "saving" || (!note.trim() && !video)) return;
    setStatus("saving");
    setError("");
    const result = await submitCoachGuidance({
      item,
      writtenNote: note,
      video,
      attachmentClass:
        asExercise && item.exerciseEligible
          ? "mlc3_exercise"
          : "general_product_guidance",
      productSubcategory: asExercise ? null : subcategory,
      publishToCatalog: asExercise && publishToCatalog,
      independentCleanMedia: asExercise && independentCleanMedia,
      exerciseKey,
      exerciseInstruction,
      languageCode: "en",
    });
    if (!result.ok) {
      setStatus("idle");
      setError(result.error);
      return;
    }
    setStatus("saved");
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-muted/10 p-3">
      <SpeechDataPanel features={item.features} label="Speech data" />
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        Written note
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={2000}
          className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          placeholder="Add guidance for this exact moment"
        />
      </label>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={(event) => setVideo(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 self-start rounded-full border border-border px-3 py-2 text-[13px] text-foreground"
      >
        <Video className="h-4 w-4" aria-hidden />
        {video ? video.name : "Add coaching video"}
      </button>
      {item.exerciseEligible ? (
        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={asExercise}
              onChange={(event) => setAsExercise(event.target.checked)}
            />
            Attach as a voice exercise
          </label>
          {asExercise && video ? (
            <>
              <label className="flex items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  checked={independentCleanMedia}
                  onChange={(event) => {
                    setIndependentCleanMedia(event.target.checked);
                    if (!event.target.checked) setPublishToCatalog(false);
                  }}
                />
                This video contains no user audio, transcript, identity,
                project context, or unique user passage
              </label>
              <label className="flex items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  checked={publishToCatalog}
                  disabled={!independentCleanMedia}
                  onChange={(event) => setPublishToCatalog(event.target.checked)}
                />
                Publish a new reviewed version to the exercise catalogue
              </label>
              {publishToCatalog ? (
                <div className="grid gap-2">
                  <input
                    value={exerciseKey}
                    onChange={(event) => setExerciseKey(event.target.value)}
                    placeholder="Exercise key, e.g. rushed_ending_reset"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <textarea
                    value={exerciseInstruction}
                    onChange={(event) => setExerciseInstruction(event.target.value)}
                    placeholder="Reusable exercise instruction"
                    rows={2}
                    className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex gap-2">
          {(["structure", "delivery"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSubcategory(subcategory === value ? null : value)}
              className={`rounded-full border px-3 py-1.5 text-[12px] capitalize ${
                subcategory === value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={
          status === "saving" || (!note.trim() && !video) ||
          (publishToCatalog && (!exerciseKey.trim() || !exerciseInstruction.trim()))
        }
        onClick={() => void submit()}
        className="flex items-center justify-center rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-40"
      >
        {status === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {status === "saved" ? "Attached" : "Attach to feedback"}
      </button>
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </section>
  );
}

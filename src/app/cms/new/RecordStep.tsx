"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  isCoachVideoRecordingSupported,
  useCoachVideoRecorder,
} from "@/hooks/useCoachVideoRecorder";
import { adminPresign, uploadToStorage } from "@/services/api/journalAdmin";
import {
  contentTypeFor,
  oversizeMessage,
  unsupportedMessage,
} from "./laneMediaUpload";
import { LaneCta, LaneQuiet, LANE_INPUT } from "./LaneShell";

/* -------------------------------------------------------------------------- */
/*  Step 1 of the exercise lane: show the exercise.                            */
/*                                                                            */
/*  Recording is the default and the only thing on the screen — founder        */
/*  2026-09-16, "sort of like adding tiktoks". Uploading a file and pasting a  */
/*  link are real needs but rarer, so they live behind the ••• rather than     */
/*  competing with the record button.                                         */
/*                                                                            */
/*  The clip is uploaded the moment it is accepted, not at the end of the      */
/*  lane. A File cannot survive sessionStorage, so holding it to the last step */
/*  would mean a back-swipe on step 6 loses the recording — and an author who  */
/*  loses a recording does not make a second exercise.                        */
/* -------------------------------------------------------------------------- */

type Mode = "record" | "upload" | "link";

export function RecordStep({
  password,
  videoUrl,
  onVideo,
  onBusyChange,
}: {
  password: string;
  videoUrl: string;
  onVideo: (url: string, seconds: number) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const rec = useCoachVideoRecorder();
  const [mode, setMode] = useState<Mode>("record");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const videoEl = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const sent = useRef<File | null>(null);

  useEffect(() => {
    const el = videoEl.current;
    if (!el) return;
    el.srcObject = rec.previewStream;
    return () => { el.srcObject = null; };
  }, [rec.previewStream]);

  useEffect(() => { onBusyChange(uploading); }, [uploading, onBusyChange]);

  async function put(file: File) {
    // DELIBERATELY NOT the coach recorder's 4.3 MB ceiling. That one is the
    // COACH video BFF's — it buffers the body through a Vercel function. This
    // lane presigns and PUTs straight to R2 and never touches it, so the cap
    // here is the backend's (500 MB for video by default), served with the
    // presign. The old guard refused every clip filmed on a phone and blamed
    // its length.
    //
    // The constant is named in words rather than spelled, because
    // laneMediaUpload.test.ts asserts the identifier is absent from this file —
    // the guard that catches someone importing it back in.
    const contentType = contentTypeFor(file);
    const wrongType = unsupportedMessage(contentType, "video");
    if (wrongType) {
      setError(wrongType);
      return;
    }
    setUploading(true);
    setError(null);
    const presigned = await adminPresign(password, {
      filename: file.name,
      // The same value the PUT will send back: see uploadToStorage.
      contentType,
      kind: "video",
    });
    if (!presigned.ok || !presigned.data) {
      setUploading(false);
      setError(presigned.ok ? "Could not prepare the upload." : presigned.message);
      return;
    }
    // The only thing enforcing the cap: R2 would take the bytes regardless.
    const tooBig = oversizeMessage(file.size, presigned.data.maxBytes);
    if (tooBig) {
      setUploading(false);
      setError(tooBig);
      return;
    }
    const sentOk = await uploadToStorage(presigned.data, file);
    setUploading(false);
    if (!sentOk) {
      setError("The upload did not finish. Try again.");
      return;
    }
    const seconds = rec.state.status === "stopped" ? rec.state.durationSec : 0;
    onVideo(presigned.data.publicUrl, Math.round(seconds));
    rec.reset();
  }

  // Upload as soon as the clip is assembled. Guarded on the File itself so a
  // re-render cannot start a second upload of the same bytes.
  useEffect(() => {
    if (rec.state.status !== "stopped") return;
    if (sent.current === rec.state.file) return;
    sent.current = rec.state.file;
    void put(rec.state.file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.state]);

  const supported = isCoachVideoRecordingSupported();

  if (videoUrl) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={videoUrl} controls playsInline className="h-full w-full object-contain" />
        </div>
        <div className="pt-4">
          <LaneQuiet onClick={() => onVideo("", 0)}>Record again</LaneQuiet>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-start justify-end">
        <div className="relative">
          <button
            type="button"
            aria-label="More options"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-[3px] p-1.5 opacity-70"
          >
            <span className="block h-[3px] w-[3px] rounded-full bg-current" />
            <span className="block h-[3px] w-[3px] rounded-full bg-current" />
            <span className="block h-[3px] w-[3px] rounded-full bg-current" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-[10px] border border-white/15 bg-[#1c1c1c] shadow-lg">
              <button
                type="button"
                onClick={() => { setMode("upload"); setMenuOpen(false); fileInput.current?.click(); }}
                className="block w-full px-3.5 py-2.5 text-left text-[13px] text-white"
              >
                Upload a file
              </button>
              <button
                type="button"
                onClick={() => { setMode("link"); setMenuOpen(false); }}
                className="block w-full border-t border-white/10 px-3.5 py-2.5 text-left text-[13px] text-white"
              >
                Paste a link
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void put(file);
        }}
      />

      {mode === "link" ? (
        <div className="flex flex-1 flex-col gap-3">
          <input
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://…"
            className={LANE_INPUT}
          />
          <LaneCta onClick={() => onVideo(link.trim(), 0)} disabled={!link.trim()}>
            Use this
          </LaneCta>
          <LaneQuiet onClick={() => setMode("record")} dark>Record instead</LaneQuiet>
        </div>
      ) : (
        <>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-[#1c1c1c]">
            <video
              ref={videoEl}
              muted
              playsInline
              autoPlay
              className="h-full w-full object-cover"
            />
            {rec.state.status === "recording" ? (
              <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[13px] text-white">
                <span className="block h-2 w-2 rounded-full bg-[#e0483a]" />
                {String(Math.floor(rec.state.elapsedSec / 60))}:
                {String(rec.state.elapsedSec % 60).padStart(2, "0")}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-2 pt-5">
            {uploading ? (
              <span className="flex items-center gap-2 text-[14px] text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving
              </span>
            ) : !supported ? (
              <span className="text-[13px] text-white/60">
                This browser cannot record. Use the ••• menu.
              </span>
            ) : (
              <button
                type="button"
                aria-label={rec.state.status === "recording" ? "Stop" : "Record"}
                onClick={() => void (rec.state.status === "recording" ? rec.stop() : rec.start())}
                className="flex h-[74px] w-[74px] items-center justify-center rounded-full border-[3px] border-white"
              >
                <span
                  className={
                    rec.state.status === "recording"
                      ? "block h-[26px] w-[26px] rounded-[5px] bg-[#e0483a]"
                      : "block h-[56px] w-[56px] rounded-full bg-[#e0483a]"
                  }
                />
              </button>
            )}
            {rec.state.status === "error" ? (
              <span className="text-center text-[13px] text-[#e0908a]">{rec.state.message}</span>
            ) : null}
            {error ? (
              <span className="text-center text-[13px] text-[#e0908a]">{error}</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

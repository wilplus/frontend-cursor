"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  useCoachVideoRecorder — in-app camera+mic recording for the coach (FP-2)   */
/*                                                                            */
/*  The coach records a clip straight from the Mac's camera/mic instead of     */
/*  filming on a phone and uploading a file. Modeled on useDualCaptureMic:      */
/*  ONE getUserMedia({video,audio}), a MediaRecorder with timeslice chunks, a  */
/*  live muted preview stream, and the same teardown discipline (the track     */
/*  stop() is what clears the OS camera indicator). On stop() we assemble a     */
/*  File with a real extension (`coach-recording-<ts>.webm|.mp4`) — the BE      */
/*  rejects a bare "blob" with 415, so the name carries the container.          */
/*                                                                            */
/*  Caps: the binding limit is NOT the BE's storage ceiling — it's the coach-    */
/*  video BFF, which buffers the whole body via req.formData() on a Vercel       */
/*  serverless function whose request body caps at ~4.5 MB (the sibling audio    */
/*  path useDualCaptureMic caps its bitrate for the same reason). So we size the  */
/*  recording to land well under that (~464 kbps x 60 s ~= 3.5 MB), with a hard   */
/*  file-size guard for VBR spikes, and auto-stop at MAX_DURATION_SEC.           */
/* -------------------------------------------------------------------------- */

/** Hard stop so a forgotten recording can't blow past the upload budget. A
 *  short coach clip ("why this was the breakthrough") fits comfortably. */
export const MAX_DURATION_SEC = 60;
/** ~400 kbps video + ~64 kbps audio is ~3.5 MB over the 60 s cap — safely under
 *  the ~4.5 MB Vercel body limit the BFF buffers against. */
const VIDEO_BITS_PER_SECOND = 400_000;
const AUDIO_BITS_PER_SECOND = 64_000;
/** Refuse to submit a blob past this (a VBR overshoot) — the BFF 413s beyond
 *  ~4.5 MB, so we catch it before the upload rather than after. */
export const MAX_UPLOAD_BYTES = 4_300_000;

export type CoachVideoRecorderState =
  | { status: "idle" }
  | { status: "recording"; elapsedSec: number }
  | { status: "stopped"; file: File; url: string; durationSec: number }
  | {
      status: "error";
      message: string;
      code: "no_support" | "denied" | "stream_failed";
    };

export interface CoachVideoRecorder {
  state: CoachVideoRecorderState;
  /** The live stream to bind to a muted <video> preview while recording; null
   *  otherwise. Exposed (not attached here) so the component owns the element. */
  previewStream: MediaStream | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Discard the recorded clip (or an error) and return to idle — the "Retake". */
  reset: () => void;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** Pick the MediaRecorder mimeType for a camera clip. Prefer VP9/Opus in WebM,
 *  fall back to plain WebM, then MP4 (Safari, which exposes no WebM encoder).
 *  null when none are supported → the caller hides the Record affordance. */
export function pickCoachVideoMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

function captureUnavailable(): boolean {
  if (typeof navigator === "undefined") return true;
  return typeof navigator.mediaDevices?.getUserMedia !== "function";
}

/** True only when BOTH getUserMedia and a usable video mimeType exist — the
 *  Record button is hidden otherwise (the file input stays as the fallback). */
export function isCoachVideoRecordingSupported(): boolean {
  return !captureUnavailable() && pickCoachVideoMimeType() !== null;
}

/** ".webm" or ".mp4" from the negotiated mime (codecs suffix ignored). */
function extForMime(mime: string): "webm" | "mp4" {
  return mime.split(";")[0].includes("mp4") ? "mp4" : "webm";
}

export function useCoachVideoRecorder(): CoachVideoRecorder {
  const [state, setState] = useState<CoachVideoRecorderState>({ status: "idle" });
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("video/webm");
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The object URL of the last recorded clip — revoked on reset / re-record /
  // unmount so a string of retakes can't leak blob URLs.
  const objectUrlRef = useRef<string | null>(null);
  // Re-entrancy latch + generation token, mirroring useDualCaptureMic: one
  // in-flight start at a time, and a teardown during the getUserMedia gap
  // aborts the pending start so it can't leave a hot camera.
  const startingRef = useRef(false);
  const startGenRef = useRef(0);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const revokeUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // Single source of truth for releasing the camera + mic. The track stop() is
  // the line that clears the OS camera-in-use indicator; the recorder stop only
  // flushes the encoder.
  const teardown = useCallback(() => {
    startGenRef.current += 1;
    clearTick();
    const recorder = recorderRef.current;
    if (recorder) {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* ignore — already stopped */
      }
      recorderRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      streamRef.current = null;
    }
    setPreviewStream(null);
  }, [clearTick]);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      if (captureUnavailable()) {
        setState({
          status: "error",
          code: "no_support",
          message: isIos()
            ? "Recording isn't available here. Open WillpowerLab in Safari to record."
            : "Recording isn't supported in this browser.",
        });
        return;
      }
      const mime = pickCoachVideoMimeType();
      if (!mime) {
        setState({
          status: "error",
          code: "no_support",
          message: "Recording isn't supported in this browser.",
        });
        return;
      }

      // Fully release any prior session before opening a new one. Idempotent.
      teardown();
      revokeUrl();
      chunksRef.current = [];
      const gen = startGenRef.current;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (err) {
        const name =
          err instanceof Error ? `${err.name} ${err.message}` : String(err);
        const denied = /NotAllowed|Permission|denied/i.test(name);
        setState({
          status: "error",
          code: denied ? "denied" : "stream_failed",
          message: denied
            ? "Camera or microphone permission denied."
            : "Couldn't access the camera.",
        });
        return;
      }
      // Closed (reset / unmount) while the permission prompt was up: release the
      // just-granted stream and bail rather than start a recorder on a dead
      // instance. State was already reset by reset()/unmount.
      if (gen !== startGenRef.current) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        });
        return;
      }

      streamRef.current = stream;
      mimeRef.current = mime;
      setPreviewStream(stream);

      let recorder: MediaRecorder;
      try {
        try {
          recorder = new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
            audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
          });
        } catch {
          // Some browsers reject the bitrate hint with certain codecs; retry bare.
          recorder = new MediaRecorder(stream, { mimeType: mime });
        }
      } catch {
        // Even the bare constructor failed — release the just-opened camera/mic
        // (else the OS indicator stays lit) and surface an error instead of
        // leaving a hot stream behind the idle Record button.
        teardown();
        setState({
          status: "error",
          code: "stream_failed",
          message: "Couldn't start recording on this device.",
        });
        return;
      }
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;

      startedAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      // 1s timeslice so long recordings flush progressively (no one giant final
      // blob) and the chunk array survives a mid-recording stop.
      recorder.start(1000);
      setState({ status: "recording", elapsedSec: 0 });

      clearTick();
      tickRef.current = setInterval(() => {
        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const elapsed = Math.floor((now - startedAtRef.current) / 1000);
        if (elapsed >= MAX_DURATION_SEC) {
          // Auto-stop at the cap. stopRef holds the latest stop() so this stale
          // interval closure calls the current one.
          void stopRef.current();
          return;
        }
        setState({ status: "recording", elapsedSec: elapsed });
      }, 250);
    } finally {
      startingRef.current = false;
    }
  }, [teardown, revokeUrl, clearTick]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    clearTick();

    await new Promise<void>((resolve) => {
      const safety = setTimeout(resolve, 800);
      recorder.onstop = () => {
        clearTimeout(safety);
        resolve();
      };
      try {
        if (recorder.state !== "inactive") recorder.stop();
        else resolve();
      } catch {
        clearTimeout(safety);
        resolve();
      }
    });

    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const durationSec = Math.max(
      1,
      Math.round((now - startedAtRef.current) / 1000)
    );
    const baseType = mimeRef.current.split(";")[0];
    const blob = new Blob(chunksRef.current, { type: baseType });
    const ext = extForMime(mimeRef.current);
    const stamp =
      typeof Date !== "undefined" ? Date.now() : Math.round(startedAtRef.current);
    const file = new File([blob], `coach-recording-${stamp}.${ext}`, {
      type: baseType,
    });

    // Release the camera now that the blob is assembled (clears the OS
    // indicator); keep the object URL alive for the playback preview.
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    streamRef.current = null;
    recorderRef.current = null;
    setPreviewStream(null);

    revokeUrl();
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setState({ status: "stopped", file, url, durationSec });
  }, [clearTick, revokeUrl]);

  // stopRef lets the interval's stale closure reach the current stop().
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const reset = useCallback(() => {
    teardown();
    revokeUrl();
    chunksRef.current = [];
    setState({ status: "idle" });
  }, [teardown, revokeUrl]);

  // Unmount safety net — release the camera even if a parent forgot to reset().
  useEffect(() => {
    return () => {
      teardown();
      revokeUrl();
    };
  }, [teardown, revokeUrl]);

  return { state, previewStream, start, stop, reset };
}

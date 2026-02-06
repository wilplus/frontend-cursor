/**
 * PCM chunk pipeline: capture 250ms mono at context sample rate (e.g. 48k),
 * resample to 16 kHz, convert to PCM16LE, POST to BFF process-chunk.
 * Contract: 4000 samples @ 16 kHz = 8000 bytes per chunk.
 */

import type { ChunkMetricsResponse, RecordingSlot } from "./chunk-metrics-types";

const CHUNK_MS = 250;
const TARGET_SAMPLE_RATE = 16000;
const TARGET_SAMPLES = (CHUNK_MS / 1000) * TARGET_SAMPLE_RATE; // 4000
const BYTES_PER_CHUNK = TARGET_SAMPLES * 2; // 8000 (int16 LE)

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
  };
  if (typeof window !== "undefined") {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    } catch {
      // ignore
    }
  }
  return headers;
}

/**
 * Resample float32 at context rate to 16 kHz and convert to PCM16LE.
 * Context rate is typically 48000 -> 12000 samples per 250ms -> downsample by 3 -> 4000 samples.
 */
function resampleTo16k(
  float32: Float32Array,
  contextSampleRate: number
): ArrayBuffer {
  const ratio = contextSampleRate / TARGET_SAMPLE_RATE; // e.g. 3
  const out = new Int16Array(TARGET_SAMPLES);
  for (let i = 0; i < TARGET_SAMPLES; i++) {
    const srcIndex = i * ratio;
    const idx = Math.floor(srcIndex);
    const frac = srcIndex - idx;
    const next = idx + 1 < float32.length ? float32[idx + 1] : float32[idx];
    const sample = float32[idx] * (1 - frac) + next * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
  }
  return out.buffer;
}

export interface ChunkPipelineCallbacks {
  onResponse: (data: ChunkMetricsResponse) => void;
  onConnectionChange?: (status: "connecting" | "live" | "error") => void;
  getAbortSignal?: () => AbortSignal | undefined;
}

export interface ChunkPipelineHandle {
  stop: () => void;
}

/**
 * Start capturing PCM from the given stream, resampling to 16 kHz,
 * and POSTing each 250ms chunk to the BFF. Calls onResponse with backend JSON.
 * Returns a handle with stop() to tear down.
 */
export function startChunkPipeline(
  stream: MediaStream,
  sessionId: string,
  recordingSlot: RecordingSlot,
  callbacks: ChunkPipelineCallbacks
): ChunkPipelineHandle {
  let destroyed = false;
  let seq = 0;
  let processor: AudioWorkletNode | null = null;
  const { onResponse, onConnectionChange, getAbortSignal } = callbacks;

  onConnectionChange?.("connecting");

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const sampleRate = audioContext.sampleRate;

  // Many browsers start AudioContext suspended; resume so the worklet receives audio.
  audioContext.resume().catch(() => {});

  const workletPath = "/pcm-chunk-processor.js";

  async function run() {
    if (destroyed) return;
    try {
      await audioContext.audioWorklet.addModule(workletPath);
    } catch (err) {
      console.error("[PCM pipeline] Failed to load worklet:", err);
      onConnectionChange?.("error");
      return;
    }

    if (destroyed) return;
    processor = new AudioWorkletNode(audioContext, "pcm-chunk-processor", {
      processorOptions: { sampleRate },
    });
    source.connect(processor);

    processor.port.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
      if (destroyed) return;
      const float32 = new Float32Array(event.data);
      const pcm16 = resampleTo16k(float32, sampleRate);
      const chunkSeq = seq;
      const startMs = chunkSeq * CHUNK_MS;
      seq += 1;

      const headers = await getAuthHeaders();
      const reqHeaders = new Headers(headers);
      reqHeaders.set("X-Chunk-Seq", String(chunkSeq));
      reqHeaders.set("X-Chunk-Start-Ms", String(startMs));
      reqHeaders.set("X-Recording-Slot", recordingSlot);

      const url = `/api/homework/session/${sessionId}/process-chunk?recording_slot=${encodeURIComponent(recordingSlot)}`;
      const signal = getAbortSignal?.();

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: reqHeaders,
          body: pcm16,
          credentials: "include",
          signal,
        });

        if (destroyed) return;

        if (chunkSeq === 0) onConnectionChange?.("live");

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.warn("[PCM pipeline] Chunk error:", res.status, err);
          if (res.status >= 500 || res.status === 404) {
            onConnectionChange?.("error");
          }
          return;
        }

        const data = (await res.json()) as ChunkMetricsResponse;
        onResponse(data);
      } catch (err) {
        if (destroyed) return;
        if ((err as { name?: string }).name === "AbortError") return;
        console.warn("[PCM pipeline] Fetch error:", err);
        onConnectionChange?.("error");
      }
    };
  }

  run();

  return {
    stop() {
      destroyed = true;
      try {
        source.disconnect();
        if (processor) processor.disconnect();
        audioContext.close();
      } catch {
        // ignore
      }
    },
  };
}

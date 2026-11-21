import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/* -------------------------------------------------------------------------- */
/*  The iPhone app records a Take itself (backend N655, N661, N662).          */
/*                                                                            */
/*  The app's TakeRecorder plugin (ios/App/App/WillpowerLabBridge.swift, on   */
/*  the shared recording core with the dump screen) writes an m4a: AAC, mono, */
/*  48 kHz, 64 kbps, the phone-call processing off, the microphone the phone  */
/*  picks. iOS pauses it for a call or another app's audio and resumes it     */
/*  after. Everything else stays the web code: the recording screens, the     */
/*  slides and their times, the clock, the upload, the outbox and its resend. */
/*                                                                            */
/*  On only where the plugin exists (an app version without it, Safari and    */
/*  the home-screen app keep the web recorder) and the ring row `native_take` */
/*  is on (N662 item 4: the founder first).                                   */
/* -------------------------------------------------------------------------- */

export const NATIVE_TAKE_FEATURE = "native_take";

/** N662 item 2. */
export const NATIVE_TAKE_AUDIO = { bitrate: 64_000, sampleRate: 48_000 } as const;

/** The kind of microphone, never its name, which can hold a person's name
 *  ("Artur's AirPods"). */
export type NativeMicKind = "builtIn" | "bluetooth" | "wired" | "other";

export interface NativeTakeStarted {
  /** ms between the first sample written and this answer, measured on the
   *  phone: the audio's t=0 is this long before the promise resolved. */
  sinceFirstSampleMs: number;
  micKind: NativeMicKind;
}

export interface NativeTakeStopped {
  /** The m4a on the phone, read with `read` and let go with `release`. */
  path: string;
  /** Recorded time, paused time left out. */
  durationMs: number;
  bytes: number;
  mimeType: string;
}

export interface TakeRecorderPlugin {
  /** Rejects with code "DENIED" (no permission), "BUSY" (another recording
   *  holds the microphone) or "FAILED". */
  start(options: { bitrate: number; sampleRate: number }): Promise<NativeTakeStarted>;
  stop(): Promise<NativeTakeStopped>;
  /** Stops and deletes the recording; nothing is kept. */
  cancel(): Promise<void>;
  /** Base64 of `length` bytes from `offset`. */
  read(options: { path: string; offset: number; length: number }): Promise<{ data: string }>;
  release(options: { path: string }): Promise<void>;
  addListener(
    event: "paused" | "resumed",
    listener: () => void,
  ): Promise<PluginListenerHandle>;
}

export const TakeRecorder = registerPlugin<TakeRecorderPlugin>("TakeRecorder");

/** The app has the native recorder (app version 1.1 and later). */
export function nativeTakeAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("TakeRecorder");
  } catch {
    return false;
  }
}

const PIECE = 512 * 1024;

function base64Bytes(data: string): Uint8Array<ArrayBuffer> {
  const text = atob(data);
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}

/** The recording as one Blob, read across the bridge in pieces, then let go
 *  on the phone: from here the web outbox keeps it (N556), as a web Take. */
export async function takeNativeRecording(
  stopped: NativeTakeStopped,
  plugin: Pick<TakeRecorderPlugin, "read" | "release"> = TakeRecorder,
): Promise<Blob> {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  for (let offset = 0; offset < stopped.bytes; offset += PIECE) {
    const { data } = await plugin.read({ path: stopped.path, offset, length: PIECE });
    parts.push(base64Bytes(data));
  }
  const blob = new Blob(parts, { type: stopped.mimeType || "audio/mp4" });
  void plugin.release({ path: stopped.path }).catch(() => undefined);
  return blob;
}

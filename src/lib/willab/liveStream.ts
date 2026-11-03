/* -------------------------------------------------------------------------- */
/*  liveStream — the words of a voice note as it is said, streamed (backend   */
/*  N392; amends N199 item 2).                                                */
/*                                                                            */
/*  The backend gives a short-lived key, under the caller's processing        */
/*  authorization; with it the phone streams the voice to the transcription  */
/*  provider and the words come back as they are said, well under a second   */
/*  behind. A preview only: nothing here is kept. The whole recording, sent   */
/*  with the note, stays the kept text (N194 item 2).                         */
/*                                                                            */
/*  The voice goes as 16-bit mono PCM at the rate the key names. The provider */
/*  hears a phrase until it is committed: a phrase is committed at a pause,   */
/*  or at the latest every MAX_TURN_MS. A phrase                              */
/*  is "current" (lighter on screen) until its whole is heard.                */
/*                                                                            */
/*  Anything that fails (no key, no socket, no audio graph) returns null or   */
/*  goes quiet: the caller then hears the note in pieces, as before.          */
/* -------------------------------------------------------------------------- */

import { openLiveSession } from "@/services/api/voiceNotebook";

const URL_BASE = "wss://api.openai.com/v1/realtime?intent=transcription";
/** How long the socket may take to open before the pieces take over. */
const OPEN_TIMEOUT_MS = 5000;
/** Audio sent in frames of about this length. */
const SEND_EVERY_MS = 100;
/** A pause this long after this much speech ends a phrase. */
const PAUSE_MS = 600;
const MIN_TURN_MS = 1500;
const MAX_TURN_MS = 12_000;
/** Below this level (RMS, 0 to 1) a frame is quiet. */
const QUIET = 0.012;

export interface LiveStream {
  /** Ends the stream and frees the audio graph and the socket. */
  close: () => void;
  /** How long the voice was streamed, for the backend's cost table. */
  streamedMs: () => number;
}

type Words = (finished: string[], current: string) => void;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/** Float samples at ``from`` Hz to 16-bit PCM at ``to`` Hz (linear). */
export function toPcm16(samples: Float32Array, from: number, to: number): Int16Array {
  const ratio = from / to;
  const out = new Int16Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const at = i * ratio;
    const j = Math.floor(at);
    const next = samples[Math.min(j + 1, samples.length - 1)] ?? 0;
    const v = (samples[j] ?? 0) + ((next - (samples[j] ?? 0)) * (at - j));
    const c = Math.max(-1, Math.min(1, v));
    out[i] = c < 0 ? c * 0x8000 : c * 0x7fff;
  }
  return out;
}

/** The phrases in the order they were begun: those heard whole, then the
 *  ones still being heard. Pure, so its test reads the same rules. */
export class Phrases {
  private order: string[] = [];
  private text = new Map<string, string>();
  private done = new Set<string>();

  private see(id: string) {
    if (!this.text.has(id)) {
      this.order.push(id);
      this.text.set(id, "");
    }
  }

  delta(id: string, delta: string) {
    this.see(id);
    if (!this.done.has(id)) this.text.set(id, (this.text.get(id) ?? "") + delta);
  }

  completed(id: string, transcript: string) {
    this.see(id);
    this.text.set(id, transcript);
    this.done.add(id);
  }

  /** Every phrase up to the first not yet heard whole is finished; from it
   *  on, the words are current. */
  read(): { finished: string[]; current: string } {
    const finished: string[] = [];
    let i = 0;
    for (; i < this.order.length && this.done.has(this.order[i]!); i++) {
      finished.push((this.text.get(this.order[i]!) ?? "").trim());
    }
    const current = this.order
      .slice(i)
      .map((id) => (this.text.get(id) ?? "").trim())
      .filter(Boolean)
      .join(" ");
    return { finished: finished.filter(Boolean), current };
  }
}

export async function openLiveStream(stream: MediaStream, onWords: Words): Promise<LiveStream | null> {
  if (typeof WebSocket === "undefined" || typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;

  // The audio graph first, so the first words are not lost while the key
  // and the socket open: frames wait in `queue` until then.
  let ctx: AudioContext;
  let processor: ScriptProcessorNode;
  let source: MediaStreamAudioSourceNode;
  try {
    ctx = new Ctx();
    void ctx.resume().catch(() => undefined);
    source = ctx.createMediaStreamSource(stream);
    processor = ctx.createScriptProcessor(4096, 1, 1);
  } catch {
    return null;
  }
  let rate = 24_000;
  let socket: WebSocket | null = null;
  let closed = false;
  let streamed = 0;
  const queue: string[] = [];
  let pending: Float32Array[] = [];
  let pendingLen = 0;
  let turnMs = 0;
  let quietMs = 0;
  let spoke = false;
  const phrases = new Phrases();

  const send = (event: object) => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  };
  const commit = () => {
    if (!spoke) return;
    send({ type: "input_audio_buffer.commit" });
    spoke = false;
    turnMs = 0;
    quietMs = 0;
  };
  const flush = () => {
    if (!pendingLen) return;
    const all = new Float32Array(pendingLen);
    let at = 0;
    for (const p of pending) {
      all.set(p, at);
      at += p.length;
    }
    pending = [];
    pendingLen = 0;
    const pcm = toPcm16(all, ctx.sampleRate, rate);
    const audio = toBase64(new Uint8Array(pcm.buffer));
    if (socket && socket.readyState === WebSocket.OPEN) {
      while (queue.length) send({ type: "input_audio_buffer.append", audio: queue.shift() });
      send({ type: "input_audio_buffer.append", audio });
    } else if (queue.length < 100) {
      queue.push(audio); // about ten seconds held while the socket opens
    }
  };

  processor.onaudioprocess = (e) => {
    if (closed) return;
    const samples = new Float32Array(e.inputBuffer.getChannelData(0));
    const ms = (samples.length / ctx.sampleRate) * 1000;
    let sum = 0;
    for (const v of samples) sum += v * v;
    const loud = Math.sqrt(sum / samples.length) >= QUIET;
    pending.push(samples);
    pendingLen += samples.length;
    streamed += ms;
    turnMs += ms;
    quietMs = loud ? 0 : quietMs + ms;
    if (loud) spoke = true;
    if ((pendingLen / ctx.sampleRate) * 1000 >= SEND_EVERY_MS) flush();
    if (socket?.readyState === WebSocket.OPEN && spoke) {
      if ((turnMs >= MIN_TURN_MS && quietMs >= PAUSE_MS) || turnMs >= MAX_TURN_MS) commit();
    }
  };
  // A ScriptProcessor runs only while connected to the output; a gain of
  // zero keeps the phone from playing the voice back.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(processor);
  processor.connect(mute);
  mute.connect(ctx.destination);

  const teardown = () => {
    closed = true;
    try {
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
      mute.disconnect();
    } catch {
      /* already disconnected */
    }
    void ctx.close().catch(() => undefined);
  };

  const session = await openLiveSession();
  if (!session || closed) {
    teardown();
    return null;
  }
  rate = session.rate;

  const opened = await new Promise<boolean>((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(URL_BASE, ["realtime", `openai-insecure-api-key.${session.value}`]);
    } catch {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      ws.close();
      resolve(false);
    }, OPEN_TIMEOUT_MS);
    ws.onopen = () => {
      clearTimeout(timer);
      socket = ws;
      resolve(true);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
  });
  if (!opened || !socket) {
    teardown();
    return null;
  }
  const ws: WebSocket = socket;
  flush();

  ws.onmessage = (m) => {
    let event: { type?: string; item_id?: string; delta?: string; transcript?: string };
    try {
      event = JSON.parse(typeof m.data === "string" ? m.data : "");
    } catch {
      return;
    }
    const id = event.item_id;
    if (!id) return;
    if (event.type === "conversation.item.input_audio_transcription.delta" && event.delta) {
      phrases.delta(id, event.delta);
    } else if (event.type === "conversation.item.input_audio_transcription.completed") {
      phrases.completed(id, event.transcript ?? "");
    } else {
      return;
    }
    if (closed) return;
    const { finished, current } = phrases.read();
    onWords(finished, current);
  };
  ws.onclose = () => {
    socket = null;
  };

  return {
    close: () => {
      if (closed) return;
      teardown();
      // The note is sent whole from here; its live words are done.
      ws.close();
    },
    streamedMs: () => Math.round(streamed),
  };
}

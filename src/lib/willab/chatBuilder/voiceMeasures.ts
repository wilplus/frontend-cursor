/* Facts about a recording. No score and no emotion. The backend patch
   uses librosa for the same facts; this is the rule the tests pin. */

export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;
export const AUDIO_MAX_SECONDS = 5 * 60;
export const PAUSE_SECONDS = 1;

export type WordStamp = { word: string; start: number; end: number };
export type VoicePause = { at: number; seconds: number };
export type VoiceSegment = { start: number; end: number; wordsPerMinute: number };
export type VoiceSpan = "steady" | "moves" | "unknown";

export type VoiceMeasures = {
  seconds: number;
  segments: VoiceSegment[];
  pauses: VoicePause[];
  pitch: VoiceSpan;
  loudness: VoiceSpan;
};

export type WalkBeat = { key: "best" | "fix" | "words" | "ideal"; text: string; at: number | null };

export function audioTooBig(bytes: number): boolean {
  return bytes > AUDIO_MAX_BYTES;
}

export function audioTooLong(seconds: number): boolean {
  return seconds > AUDIO_MAX_SECONDS;
}

/** A clock time, such as 0:41. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function rms(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  const end = Math.min(samples.length, to);
  const start = Math.max(0, from);
  const n = Math.max(1, end - start);
  for (let i = start; i < end; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / n);
}

function spanOf(left: number, right: number): VoiceSpan {
  if (!left || !right) return "unknown";
  const ratio = left > right ? left / right : right / left;
  return ratio >= 1.4 ? "moves" : "steady";
}

/** A rough pitch, in Hz, or null when the sound has no clear tone. */
export function pitchHz(samples: Float32Array, sampleRate: number): number | null {
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.min(samples.length - 1, Math.floor(sampleRate / 80));
  if (maxLag <= minLag) return null;
  let best = 0;
  let lag = minLag;
  for (let i = minLag; i <= maxLag; i += 1) {
    let sum = 0;
    const n = samples.length - i;
    for (let j = 0; j < n; j += 8) sum += samples[j] * samples[j + i];
    if (sum > best) {
      best = sum;
      lag = i;
    }
  }
  return best > 0 ? Math.round(sampleRate / lag) : null;
}

function halfPitch(samples: Float32Array, sampleRate: number): VoiceSpan {
  const mid = Math.floor(samples.length / 2);
  const left = pitchHz(samples.subarray(0, mid), sampleRate);
  const right = pitchHz(samples.subarray(mid), sampleRate);
  if (left === null || right === null) return "unknown";
  return spanOf(left, right);
}

function pausesOf(words: WordStamp[]): VoicePause[] {
  const pauses: VoicePause[] = [];
  for (let i = 1; i < words.length; i += 1) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= PAUSE_SECONDS) pauses.push({ at: words[i - 1].end, seconds: Math.max(1, Math.round(gap)) });
  }
  return pauses;
}

function segmentsOf(words: WordStamp[], seconds: number): VoiceSegment[] {
  if (seconds <= 0) return [];
  const width = seconds <= 15 ? seconds : 10;
  const segments: VoiceSegment[] = [];
  for (let start = 0; start < seconds; start += width) {
    const end = Math.min(seconds, start + width);
    const count = words.filter((word) => word.start >= start && word.start < end).length;
    const minutes = (end - start) / 60;
    segments.push({ start, end, wordsPerMinute: minutes > 0 ? Math.round(count / minutes) : 0 });
  }
  return segments;
}

/** Measures from samples and word times. The samples may be empty. */
export function measureVoice(samples: Float32Array, sampleRate: number, words: WordStamp[]): VoiceMeasures {
  const seconds = sampleRate > 0 ? samples.length / sampleRate : 0;
  const mid = Math.floor(samples.length / 2);
  const loudness = samples.length ? spanOf(rms(samples, 0, mid), rms(samples, mid, samples.length)) : "unknown";
  return {
    seconds,
    segments: segmentsOf(words, seconds || words.at(-1)?.end || 0),
    pauses: pausesOf(words),
    pitch: samples.length ? halfPitch(samples, sampleRate) : "unknown",
    loudness,
  };
}

/** Plain sentences about the recording. No feeling is named. */
export function voiceFacts(measures: VoiceMeasures): string[] {
  const facts = measures.pauses.map((pause) => `You paused for ${pause.seconds} ${pause.seconds === 1 ? "second" : "seconds"} at ${clock(pause.at)}.`);
  const pace = measures.segments.find((segment) => segment.wordsPerMinute > 0);
  if (pace) facts.push(`From ${clock(pace.start)} to ${clock(pace.end)}, the words came at about ${pace.wordsPerMinute} a minute.`);
  if (measures.loudness === "steady") facts.push("The loudness stayed even.");
  if (measures.loudness === "moves") facts.push("The loudness changed from one part to the next.");
  if (measures.pitch === "steady") facts.push("The pitch stayed even.");
  if (measures.pitch === "moves") facts.push("The pitch moved from one part to the next.");
  return facts;
}

/** The walk a visitor can tap. Times point at the recording, not at a score. */
export function walkFromFacts(measures: VoiceMeasures, steps: string[], ideal: boolean): WalkBeat[] {
  const beats: WalkBeat[] = [];
  const pause = measures.pauses[0];
  const clear = measures.segments.find((segment) => segment.wordsPerMinute > 0) ?? measures.segments[0];
  if (steps.includes("best") && clear) {
    beats.push({ key: "best", text: `A clear stretch starts at ${clock(clear.start)}.`, at: clear.start });
  }
  if (steps.includes("fix")) {
    beats.push(pause
      ? { key: "fix", text: `You paused for ${pause.seconds} ${pause.seconds === 1 ? "second" : "seconds"} at ${clock(pause.at)}. You could say that part again.`, at: pause.at }
      : { key: "fix", text: "The words ran on without a pause. You could leave a breath in one place.", at: 0 });
  }
  if (steps.includes("words")) {
    beats.push({ key: "words", text: "Keep a few words you want to say the same way next time.", at: null });
  }
  if (ideal) beats.push({ key: "ideal", text: "Here is the text to keep.", at: null });
  return beats;
}

/** A mono 16-bit wav. Used by the test fixture and by a wav the browser can read. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (at: number, text: string) => { for (let i = 0; i < text.length; i += 1) bytes[at + i] = text.charCodeAt(i); };
  write(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped * 0x7fff, true);
  }
  return bytes;
}

export function readWav(bytes: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleRate = view.getUint32(24, true);
  const data = new Float32Array((bytes.length - 44) / 2);
  for (let i = 0; i < data.length; i += 1) data[i] = view.getInt16(44 + i * 2, true) / 0x7fff;
  return { samples: data, sampleRate };
}

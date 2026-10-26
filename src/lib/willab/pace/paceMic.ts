/* -------------------------------------------------------------------------- */
/*  paceMic — the microphone feeding the pace scale (backend N142).           */
/*                                                                            */
/*  Listen only: the loudness and how voice-like the sound is are read every */
/*  10 ms in this tab and pushed into the meter; no audio is kept or leaves   */
/*  the device. Shared by the founder's bench and the walk's tempo step.      */
/* -------------------------------------------------------------------------- */

import { FRAME_MS, INSTANT_CONFIG, InstantMeter, periodicity, type InstantConfig, type InstantRead } from "./paceSignal";

export type PaceMic = {
  /** The meter, live: the bench retunes it while it listens. */
  meter: InstantMeter;
  /** How voice-like the newest sound is, 0..1 (for tuning only). */
  voiceLike: () => number;
  stop: () => void;
};

/** Opens the microphone and calls `onRead` with every 10 ms read. Null when
 *  the microphone is blocked or missing. */
export async function startPaceMic(
  onRead: (read: InstantRead) => void,
  cfg: InstantConfig = INSTANT_CONFIG,
): Promise<PaceMic | null> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    return null;
  }
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audio = new AudioCtx();
  await audio.resume();
  const source = audio.createMediaStreamSource(stream);
  // Keep the voice's band, so hum and hiss count as room, not voice.
  const high = audio.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 250;
  const low = audio.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 3500;
  const analyser = audio.createAnalyser();
  analyser.fftSize = 32768; // ~0.7 s of samples, so a late tick still finds its frames
  source.connect(high).connect(low).connect(analyser);
  // A second, lower branch to hear pitch: a voice's fundamental and first
  // harmonics live under 1 kHz; hum under 70 Hz is cut.
  const pitchHigh = audio.createBiquadFilter();
  pitchHigh.type = "highpass";
  pitchHigh.frequency.value = 70;
  const pitchLow = audio.createBiquadFilter();
  pitchLow.type = "lowpass";
  pitchLow.frequency.value = 1000;
  const pitchAnalyser = audio.createAnalyser();
  pitchAnalyser.fftSize = 2048;
  source.connect(pitchHigh).connect(pitchLow).connect(pitchAnalyser);
  const pitchBuf = new Float32Array(pitchAnalyser.fftSize);
  // Every 4th sample (the branch is under 1 kHz), the newest ~40 ms.
  const step = 4;
  const pitchRate = audio.sampleRate / step;
  const pitchWin = new Float32Array(Math.round(pitchRate * 0.04));

  const meter = new InstantMeter(cfg);
  const buffer = new Float32Array(analyser.fftSize);
  const frameSamples = Math.max(1, Math.round((audio.sampleRate * FRAME_MS) / 1000));
  let lastTick = performance.now();
  let voiceLike = 0;

  const id = window.setInterval(() => {
    const now = performance.now();
    const frames = Math.min(20, Math.floor((now - lastTick) / FRAME_MS));
    if (frames <= 0) return;
    lastTick += frames * FRAME_MS;
    analyser.getFloatTimeDomainData(buffer);
    pitchAnalyser.getFloatTimeDomainData(pitchBuf);
    const startAt = pitchBuf.length - pitchWin.length * step;
    for (let i = 0; i < pitchWin.length; i++) pitchWin[i] = pitchBuf[startAt + i * step];
    voiceLike = periodicity(pitchWin, pitchRate);
    // One RMS per 10 ms slice of the newest samples, oldest first.
    for (let f = frames - 1; f >= 0; f--) {
      const end = buffer.length - f * frameSamples;
      const begin = Math.max(0, end - frameSamples);
      let sum = 0;
      for (let i = begin; i < end; i++) sum += buffer[i] * buffer[i];
      const rms = Math.sqrt(sum / Math.max(1, end - begin));
      onRead(meter.push(20 * Math.log10(rms + 1e-9), voiceLike));
    }
  }, FRAME_MS);

  return {
    meter,
    voiceLike: () => voiceLike,
    stop: () => {
      window.clearInterval(id);
      stream.getTracks().forEach((t) => t.stop());
      void audio.close();
    },
  };
}

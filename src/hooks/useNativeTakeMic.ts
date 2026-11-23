"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { hushVoices } from "@/lib/willab/oneVoice";
import {
  NATIVE_TAKE_AUDIO,
  TakeRecorder,
  takeNativeRecording,
  type TakeRecorderPlugin,
} from "@/lib/willab/nativeTakeRecorder";
import { rememberEarbuds, type DualCaptureMic, type DualCaptureState } from "./useDualCaptureMic";

/* -------------------------------------------------------------------------- */
/*  useNativeTakeMic — the iPhone app records the Take itself (backend N655,  */
/*  N662), behind the web recorder's own interface (DualCaptureMic), so the   */
/*  recording screens cannot tell the two apart.                              */
/*                                                                            */
/*  Kept from useDualCaptureMic, one by one: one start at a time; a close     */
/*  while the microphone is opening never leaves it on; any voice message     */
/*  playing is hushed; the audio's t=0 for the slide taps (getAudioStartedAt);*/
/*  a call's pause and the time it lasted (getPausedMs, N437 item 2); one     */
/*  Finish, a second tap joining it; a Finish while opening hands over an     */
/*  empty try; Discard keeps nothing; the earbuds line (N372); the same error */
/*  codes and words. The screen stays on: the phone holds it while recording. */
/* -------------------------------------------------------------------------- */

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const DENIED_MESSAGE =
  "Microphone blocked. Open iPhone Settings, find WillpowerLab, and turn on Microphone.";
const FAILED_MESSAGE = "Couldn't access the microphone.";

export function useNativeTakeMic(
  plugin: TakeRecorderPlugin = TakeRecorder,
): DualCaptureMic {
  const [state, setState] = useState<DualCaptureState>({ status: "idle" });
  const startingRef = useRef(false);
  const recordingRef = useRef(false);
  const stoppingRef = useRef<Promise<void> | null>(null);
  /** Bumped by every cancel / unmount: a start still waiting on the phone
   *  sees it moved and lets the microphone go. */
  const genRef = useRef(0);
  const startedAtRef = useRef(0);
  const audioStartedAtRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const pausedMsRef = useRef(0);
  const listenersRef = useRef<PluginListenerHandle[]>([]);

  const unlisten = useCallback(() => {
    listenersRef.current.forEach((l) => void l.remove().catch(() => undefined));
    listenersRef.current = [];
  }, []);

  const getPausedMs = useCallback(
    () => pausedMsRef.current + (pausedAtRef.current !== null ? nowMs() - pausedAtRef.current : 0),
    [],
  );
  const getAudioStartedAt = useCallback(() => audioStartedAtRef.current, []);

  const listen = useCallback(async () => {
    const onPaused = () => {
      if (recordingRef.current && pausedAtRef.current === null) pausedAtRef.current = nowMs();
    };
    const onResumed = () => {
      if (pausedAtRef.current === null) return;
      pausedMsRef.current += nowMs() - pausedAtRef.current;
      pausedAtRef.current = null;
    };
    try {
      listenersRef.current = [
        await plugin.addListener("paused", onPaused),
        await plugin.addListener("resumed", onResumed),
      ];
    } catch {
      /* no events: the clock runs on through a call, the Take still records */
    }
  }, [plugin]);

  const start = useCallback(async () => {
    if (startingRef.current || recordingRef.current) return;
    startingRef.current = true;
    const gen = ++genRef.current;
    hushVoices();
    try {
      const started = await plugin.start({ ...NATIVE_TAKE_AUDIO });
      if (gen !== genRef.current) {
        // Closed while the microphone was opening: let it go, keep nothing.
        void plugin.cancel().catch(() => undefined);
        return;
      }
      const now = nowMs();
      startedAtRef.current = now;
      audioStartedAtRef.current = now - Math.max(0, started.sinceFirstSampleMs || 0);
      pausedAtRef.current = null;
      pausedMsRef.current = 0;
      recordingRef.current = true;
      rememberEarbuds(started.micKind === "bluetooth");
      await listen();
      setState({ status: "recording", partialText: "" });
    } catch (err) {
      if (gen !== genRef.current) return;
      const denied = (err as { code?: string })?.code === "DENIED";
      setState({
        status: "error",
        code: denied ? "denied" : "stream_failed",
        message: denied ? DENIED_MESSAGE : FAILED_MESSAGE,
      });
    } finally {
      startingRef.current = false;
    }
  }, [plugin, listen]);

  const finish = useCallback(async () => {
    recordingRef.current = false;
    unlisten();
    try {
      const stopped = await plugin.stop();
      const audioBlob = await takeNativeRecording(stopped, plugin);
      const durationSec =
        stopped.durationMs > 0
          ? stopped.durationMs / 1000
          : (nowMs() - startedAtRef.current - getPausedMs()) / 1000;
      setState({ status: "stopped", finalText: "", audioBlob, durationSec });
    } catch {
      setState({ status: "error", code: "stream_failed", message: FAILED_MESSAGE });
    }
  }, [plugin, unlisten, getPausedMs]);

  const stop = useCallback((): Promise<void> => {
    if (stoppingRef.current) return stoppingRef.current;
    if (!recordingRef.current) {
      if (startingRef.current) {
        // Finish while the microphone is opening: it goes off the moment it
        // opens, and an empty try is handed over, as on the web.
        genRef.current += 1;
        setState({ status: "stopped", finalText: "", audioBlob: new Blob([], { type: "audio/mp4" }), durationSec: 0 });
      }
      return Promise.resolve();
    }
    const stopping = finish().finally(() => {
      stoppingRef.current = null;
    });
    stoppingRef.current = stopping;
    return stopping;
  }, [finish]);

  const cancel = useCallback(() => {
    genRef.current += 1;
    const wasLive = recordingRef.current || startingRef.current;
    recordingRef.current = false;
    unlisten();
    if (wasLive) void plugin.cancel().catch(() => undefined);
    setState({ status: "idle" });
  }, [plugin, unlisten]);

  // Unmount: the microphone is never left on.
  useEffect(
    () => () => {
      genRef.current += 1;
      if (recordingRef.current) void plugin.cancel().catch(() => undefined);
      recordingRef.current = false;
      unlisten();
    },
    [plugin, unlisten],
  );

  return { state, start, stop, cancel, getAudioStartedAt, getPausedMs };
}

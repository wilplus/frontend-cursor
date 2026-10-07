"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { walkSig, type WalkDir } from "@/lib/willab/walkMotion";
import type { WalkStep } from "@/lib/willab/walkPlan";
import type { FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import {
  PRACTISE_READ_LIMIT_MS,
  loopEnd,
  withChecking,
  withRead,
  withRetry,
} from "@/lib/willab/walkPractise";
import type { WalkPractiseIO, WalkPractisePassage } from "@/services/api/walkPractise";

/* -------------------------------------------------------------------------- */
/*  useWalkPractise — the practise loop's live half (build plan D-FW-16;       */
/*  founder lock 2026-10-06, flow 7; N52.3, CM3a A, CM3b A, O5).               */
/*                                                                            */
/*  The walk's screens only draw; this owns what lives longer than a screen:   */
/*  the microphone, the clock, the practice row of each moment, and the try    */
/*  in flight. (A screen is drawn twice while it leaves, so nothing with a     */
/*  side effect may live inside one.)                                          */
/*                                                                            */
/*    arrive on a practise   the mic opens and the try records at once        */
/*    Stop                   the try is kept, the checking screen fades in,   */
/*                           the try uploads through the attempts route and   */
/*                           the machine is asked (/check)                    */
/*    the answer             laid into the plan (walkPractise.withRead)       */
/*    late or failed         "Next" or "Practise again" (O5); a late answer   */
/*                           that arrives after is ignored here              */
/*                                                                            */
/*  LIVE LOOP: the mic is released on Stop, Skip, ✕, any screen that is not   */
/*  a practise, and unmount (useDualCaptureMic's own teardown). The Take's    */
/*  recording is never touched: this is a separate recorder.                  */
/* -------------------------------------------------------------------------- */

/** The upload is bounded by its route's own limit; past it the try is not
 *  reached yet (O5) rather than a wait with no end. */
const UPLOAD_LIMIT_MS = 60_000;

/** One moment's latest try, as its screens show it. */
export type WalkTry = {
  practiceId: string;
  /** The try's own words, back from a praise: helper words are tapped from
   *  them. */
  words: string | null;
  /** The try's voice, played on the screens after it. */
  audio: { url: string; durationMs: number } | null;
};

function within<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

function passageOf<R>(step: WalkStep, moment: FeedbackWalkMoment<R>): { item: R; passage: WalkPractisePassage } | null {
  if (moment.practiseItem == null) return null;
  if (step.kind === "words" && moment.clearer) {
    return { item: moment.practiseItem, passage: { kind: "rewrite", say: moment.clearer.say } };
  }
  if (step.kind === "moment" && moment.practiseItem != null) {
    return { item: moment.practiseItem, passage: { kind: "plain" } };
  }
  return null;
}

export type WalkPractise = {
  /** Seconds since the try started, for the strip's clock. */
  elapsed: number;
  /** Stop: the try goes to the machine. */
  stop: () => void;
  /** Skip, "Keep my words" or "Next" after a late read: past this moment's
   *  loop. */
  skip: () => void;
  /** "Practise again" after a late or failed read. */
  again: () => void;
  /** The moment's latest try. */
  tryOf: (moment: number) => WalkTry | undefined;
  /** ✕ or a new opening: the mic off, nothing in flight. */
  cancel: () => void;
  /** A new opening of the walk: every moment starts afresh. */
  reset: () => void;
};

export function useWalkPractise<R>(args: {
  io: WalkPractiseIO<R> | null;
  plan: readonly WalkStep[];
  at: number;
  moments: readonly FeedbackWalkMoment<R>[];
  /** A guest's practise asks to sign up and records nothing. */
  blocked: (step: WalkStep) => boolean;
  /** Lay a new plan and move to `to`. */
  relay: (plan: WalkStep[], to: number, dir: WalkDir) => void;
  readLimitMs?: number;
}): WalkPractise {
  const { io, plan, at, moments, blocked, relay } = args;
  const readLimit = args.readLimitMs ?? PRACTISE_READ_LIMIT_MS;
  const mic = useDualCaptureMic({ transcript: false });
  const [tries, setTries] = useState<Record<number, WalkTry>>({});
  const [elapsed, setElapsed] = useState(0);

  const live = useRef({ io, plan, at, moments, blocked, relay, readLimit });
  live.current = { io, plan, at, moments, blocked, relay, readLimit };
  const micOn = useRef(false);
  const run = useRef(0);
  const opened = useRef(new Map<number, Promise<string | null>>());
  const pending = useRef<{ at: number; step: WalkStep; run: number } | null>(null);
  const urls = useRef<string[]>([]);

  const step = plan[at];
  const recording = step?.key === "practise";

  // Arriving on a practise: it records at once (flow 7). Twice in a row (a
  // strict-mode effect) is harmless: the mic starts one capture at a time.
  const sig = step ? walkSig(step) : "";
  useEffect(() => {
    const { io: practiseIO, plan: p, at: i, moments: ms, blocked: guestOnly } = live.current;
    const here = p[i];
    if (!practiseIO || here?.key !== "practise" || here.moment == null) return;
    if (guestOnly(here)) return;
    const moment = ms[here.moment];
    const what = moment ? passageOf(here, moment) : null;
    if (!what) return;
    if (!opened.current.has(here.moment)) {
      opened.current.set(here.moment, practiseIO.open(what.item, what.passage).catch(() => null));
    }
    micOn.current = true;
    setElapsed(0);
    void mic.start();
    // The screen's identity is the trigger; mic is stable per instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, sig]);

  // Off a practise, the mic is off.
  useEffect(() => {
    if (recording || !micOn.current) return;
    micOn.current = false;
    mic.cancel();
  }, [recording, at, mic]);

  // The strip's clock, while the mic records.
  const capturing = mic.state.status === "recording";
  useEffect(() => {
    if (!capturing) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(timer);
  }, [capturing]);

  // The try's voice is a local copy; it goes when the walk goes.
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const late = useCallback((processingAt: number, tried: WalkStep, retry: number) => {
    const { plan: p, relay: lay } = live.current;
    lay(withRead(p, processingAt, tried, null, { words: false, retryAttempt: retry }), processingAt + 1, "fade");
  }, []);

  /** Upload the try, ask the machine, lay its answer in. */
  const submit = useCallback(
    async (audio: Blob, durationSec: number, from: { at: number; step: WalkStep; run: number }) => {
      const { io: practiseIO, readLimit: limit } = live.current;
      const moment = from.step.moment ?? -1;
      const checkingAt = from.at + 1;
      const current = () =>
        run.current === from.run &&
        live.current.at === checkingAt &&
        live.current.plan[checkingAt]?.key === "processing";
      const attempt = from.step.attempt ?? 1;
      const practiceId = practiseIO ? await (opened.current.get(moment) ?? Promise.resolve(null)) : null;
      if (!practiseIO || !practiceId) {
        if (current()) late(checkingAt, from.step, attempt);
        return;
      }
      const sent = await within(practiseIO.upload(practiceId, audio, durationSec), UPLOAD_LIMIT_MS);
      if (!sent) {
        if (current()) late(checkingAt, from.step, attempt);
        return;
      }
      const url = URL.createObjectURL(audio);
      urls.current.push(url);
      setTries((t) => ({
        ...t,
        [moment]: { practiceId, words: null, audio: { url, durationMs: Math.round(durationSec * 1000) } },
      }));
      const tried: WalkStep = { ...from.step, attempt: sent.attempt };
      const read = await within(practiseIO.check(practiceId, sent.attemptId), limit);
      if (!current()) return;
      if (!read) {
        late(checkingAt, tried, sent.attempt + 1);
        return;
      }
      setTries((t) => ({ ...t, [moment]: { ...t[moment], practiceId, words: read.attemptWords } }));
      const { plan: p, relay: lay } = live.current;
      lay(withRead(p, checkingAt, tried, read.check, { words: read.attemptWords !== null }), checkingAt + 1, "fade");
    },
    [late],
  );

  // The try is kept once the recorder hands it over.
  const handled = useRef<Blob | null>(null);
  useEffect(() => {
    const state = mic.state;
    const from = pending.current;
    if (!from) return;
    if (state.status === "stopped" && handled.current !== state.audioBlob) {
      handled.current = state.audioBlob;
      pending.current = null;
      void submit(state.audioBlob, state.durationSec, from);
    }
  }, [mic.state, submit]);

  // A mic that would not open is a failed try (O5), never a dead screen.
  useEffect(() => {
    if (mic.state.status !== "error" || !micOn.current) return;
    micOn.current = false;
    const { plan: p, at: i, relay: lay } = live.current;
    const here = p[i];
    if (here?.key !== "practise") return;
    const checking = withChecking(p, i);
    lay(withRead(checking, i + 1, here, null, { words: false, retryAttempt: here.attempt ?? 1 }), i + 2, "fade");
  }, [mic.state]);

  const stop = useCallback(() => {
    const { plan: p, at: i, relay: lay } = live.current;
    const here = p[i];
    if (here?.key !== "practise" || !micOn.current) return;
    micOn.current = false;
    run.current += 1;
    pending.current = { at: i, step: here, run: run.current };
    void mic.stop();
    lay(withChecking(p, i), i + 1, "fade");
  }, [mic]);

  const cancel = useCallback(() => {
    run.current += 1;
    pending.current = null;
    micOn.current = false;
    mic.cancel();
  }, [mic]);

  const skip = useCallback(() => {
    cancel();
    const { plan: p, at: i, relay: lay } = live.current;
    lay([...p], loopEnd(p, i), "forward");
  }, [cancel]);

  const again = useCallback(() => {
    const { plan: p, at: i, relay: lay, moments: ms } = live.current;
    const here = p[i];
    if (here?.key !== "late" || here.moment == null || !ms[here.moment]) return;
    const practise = p.find((s) => s.key === "practise" && s.moment === here.moment);
    if (!practise) return;
    lay(withRetry(p, i, practise), i, "fade");
  }, []);

  const reset = useCallback(() => {
    cancel();
    opened.current = new Map();
    setTries({});
  }, [cancel]);

  const tryOf = useCallback((moment: number) => tries[moment], [tries]);

  return { elapsed, stop, skip, again, tryOf, cancel, reset };
}

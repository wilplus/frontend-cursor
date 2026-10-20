"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import { walkSig, type WalkDir } from "@/lib/willab/walkMotion";
import type { WalkStep } from "@/lib/willab/walkPlan";
import type { FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import {
  PRACTISE_READ_LIMIT_MS,
  loopEnd,
  threadStart,
  withChecking,
  withRead,
  withRetry,
} from "@/lib/willab/walkPractise";
import type { WalkPractiseIO, WalkPractisePassage } from "@/services/api/walkPractise";
import { ensureAiVoice, noteAiVoicePlay, readAiVoice, type AiVoiceState } from "@/services/api/aiVoice";

/** How often, and how long, a clip being made is asked after (N71; every
 *  second for a minute, founder 2026-10-15). */
const AI_VOICE_POLL_MS = 1000;
const AI_VOICE_POLL_TRIES = 60;

/** The clip as the screen holds it from the moment it is asked for: the
 *  bubble shows at once, with the typing dots (founder 2026-10-15). */
const AI_VOICE_ASKING: AiVoiceState = { demo: "ai_voice", clip: { state: "pending", url: null, durationMs: null, why: null } };

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
  /** The try's voice, played on the screens after it. */
  audio: { url: string; durationMs: number } | null;
  /** Each try's own voice by its number: the thread keeps every try. */
  audios?: Record<number, { url: string; durationMs: number }>;
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
  // After an exercise's video (or straight away with none, Q-B15 A): the
  // same loop, on the exercise the moment carries (D-FW-17).
  if (step.kind === "instruction" && moment.exercise) {
    return { item: moment.exercise.item, passage: { kind: "exercise" } };
  }
  if (moment.practiseItem == null) return null;
  if (step.kind === "words" && moment.clearer) {
    return { item: moment.practiseItem, passage: { kind: "rewrite", say: moment.clearer.say } };
  }
  // "Keep my words": the speaker's own sentence, said again (lock
  // 2026-10-12, section 2.4).
  if (step.kind === "keep" && moment.clearer) {
    return { item: moment.practiseItem, passage: { kind: "plain" } };
  }
  if (step.kind === "moment" && moment.practiseItem != null) {
    return { item: moment.practiseItem, passage: { kind: "plain" } };
  }
  return null;
}

/** The practice a replayed screen reads its clip from: the voice Exercise's
 *  thread, or a clearer version's (founder 2026-10-18). */
function replayClipPractice(plan: readonly WalkStep[], at: number, replayOf: (moment: number) => string | null | undefined): string | null {
  const here = plan[at];
  if (!here?.replay || here.moment == null) return null;
  const start = threadStart(plan, at);
  const clearerLane = plan.some((s) => s.moment === here.moment && s.key === "clearer");
  return (start >= 0 && plan[start].key === "exVideo") || clearerLane ? replayOf(here.moment) ?? null : null;
}

/** The practise kind the AI clip is asked for on this screen, or null. The
 *  voice Exercise, with or without an exercise attached (the moment said
 *  again asks too, founder 2026-10-14), and a clearer version's practise of
 *  the accepted words or the kept ones (founder 2026-10-18). */
function aiPractiseKind<R>(here: WalkStep, moment: FeedbackWalkMoment<R>): WalkStep["kind"] | null {
  if (here.key === "practise" && (here.kind === "words" || here.kind === "keep")) return here.kind;
  const voice = here.key === "exVideo" || (here.key === "practise" && (here.kind === "instruction" || here.kind === "moment"));
  if (!voice || !(moment.exercise || moment.practiseItem != null)) return null;
  return moment.exercise ? "instruction" : "moment";
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
  /** The AI version of the speaker's voice for a voice Exercise moment
   *  (founder lock 2026-10-12, N71); undefined until asked. */
  aiVoiceOf: (moment: number) => AiVoiceState | undefined;
  /** The speaker pressed play on the AI clip. */
  aiVoicePlayed: (moment: number) => void;
  /** The practice the moment's AI clip belongs to; the chat fetches it by it. */
  aiVoicePracticeOf: (moment: number) => string | undefined;
  /** The moment's clip is being asked and not yet answered. */
  aiVoiceAsking: (moment: number) => boolean;
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
  /** The practice a replayed exercise's clip belongs to, when the walk
   *  knows it (the thread kept it): its clip is read, never made again. */
  replayPracticeOf?: (moment: number) => string | null | undefined;
}): WalkPractise {
  const { io, plan, at, moments, blocked, relay } = args;
  const readLimit = args.readLimitMs ?? PRACTISE_READ_LIMIT_MS;
  const replayPracticeOf = args.replayPracticeOf ?? (() => null);
  const mic = useDualCaptureMic({ transcript: false });
  const [tries, setTries] = useState<Record<number, WalkTry>>({});
  const [elapsed, setElapsed] = useState(0);

  const live = useRef({ io, plan, at, moments, blocked, relay, readLimit, replayPracticeOf });
  live.current = { io, plan, at, moments, blocked, relay, readLimit, replayPracticeOf };
  const micOn = useRef(false);
  const run = useRef(0);
  const opened = useRef(new Map<number, Promise<string | null>>());
  const pending = useRef<{ at: number; step: WalkStep; run: number } | null>(null);
  const urls = useRef<string[]>([]);
  const [aiVoice, setAiVoice] = useState<Record<number, AiVoiceState>>({});
  const aiAsked = useRef(new Set<number>());
  const aiPractice = useRef(new Map<number, string>());
  // Moments whose clip is being asked and not yet answered.
  const aiWaiting = useRef(new Set<number>());
  const aiTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const step = plan[at];
  const recording = step?.key === "practise";

  // Arriving on a practise: it records at once (flow 7). Twice in a row (a
  // strict-mode effect) is harmless: the mic starts one capture at a time.
  const sig = step ? walkSig(step) : "";
  useEffect(() => {
    const { io: practiseIO, plan: p, at: i, moments: ms, blocked: guestOnly } = live.current;
    const here = p[i];
    if (!practiseIO || here?.key !== "practise" || here.moment == null) return;
    // A try played again is only listened to (walk first, 2026-10-14).
    if (here.replay || guestOnly(here)) return;
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

  // The AI version of your voice (N71): asked once per practise moment,
  // when its Exercise screen opens (no video may fit) or its practise
  // starts. A clearer version asks too, when its practise starts (founder
  // 2026-10-18, "words first, then voice"): its clip says the accepted
  // words, or their own when they kept them, and shows only after a not yet.
  useEffect(() => {
    const { io: practiseIO, plan: p, at: i, moments: ms, blocked: guestOnly, replayPracticeOf: replayOf } = live.current;
    const here = p[i];
    if (here?.moment == null || guestOnly(here)) return;
    // A replayed exercise only reads the clip it already has (founder
    // 2026-10-15: an exercise already done plays its tries); nothing is
    // made, and a play is not counted. A read-only walk asks nothing.
    if (here.replay || here.readOnly) {
      // Any screen of the exercise's thread: a try tapped in the chat opens
      // on its last answer, with the Exercise above it.
      const practiceId = replayClipPractice(p, i, replayOf);
      if (!practiceId || aiAsked.current.has(here.moment)) return;
      const index = here.moment;
      aiAsked.current.add(index);
      void readAiVoice(practiceId).then((read) => {
        if (read.ok && read.data.clip?.state === "ready") setAiVoice((v) => ({ ...v, [index]: read.data }));
      });
      return;
    }
    if (!practiseIO) return;
    const moment = ms[here.moment];
    const kind = moment ? aiPractiseKind(here, moment) : null;
    if (!kind || aiAsked.current.has(here.moment)) return;
    const index = here.moment;
    aiAsked.current.add(index);
    const what = passageOf({ ...here, kind }, moment);
    if (!what) return;
    if (!opened.current.has(index)) {
      opened.current.set(index, practiseIO.open(what.item, what.passage).catch(() => null));
    }
    let tries = 0;
    aiWaiting.current.add(index);
    // The bubble is on screen from here, the typing dots in it.
    setAiVoice((v) => ({ ...v, [index]: AI_VOICE_ASKING }));
    const keep = (state: AiVoiceState) => {
      aiWaiting.current.delete(index);
      setAiVoice((v) => ({ ...v, [index]: state }));
    };
    const none: AiVoiceState = { demo: "none", clip: null };
    const poll = (practiceId: string) => {
      const timer = setTimeout(async () => {
        aiTimers.current.delete(timer);
        tries += 1;
        const read = await readAiVoice(practiceId);
        const pending = !read.ok || read.data.clip?.state === "pending";
        if (pending && tries < AI_VOICE_POLL_TRIES) {
          if (read.ok) keep(read.data);
          poll(practiceId);
          return;
        }
        // Still not made when the asking ends: no clip, the locked screen.
        keep(read.ok && !pending ? read.data : { demo: "ai_voice", clip: { state: "unavailable", url: null, durationMs: null, why: null } });
      }, AI_VOICE_POLL_MS);
      aiTimers.current.add(timer);
    };
    void (opened.current.get(index) ?? Promise.resolve(null)).then(async (practiceId) => {
      if (!practiceId) return keep(none);
      aiPractice.current.set(index, practiceId);
      const asked = await ensureAiVoice(practiceId);
      if (!asked.ok) return keep(none);
      keep(asked.data);
      if (asked.data.clip?.state === "pending") poll(practiceId);
    });
    // The clip keeps being asked after while the walk moves on (Exercise →
    // practise → not yet); the walk going away stops it (below).
    // The screen's identity is the trigger, as above.
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

  // The try's voice is a local copy; it goes when the walk goes, and so
  // does any wait on an AI clip.
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
      for (const timer of aiTimers.current) clearTimeout(timer);
    },
    [],
  );

  // After Stop every move is instant (lock 2026-10-12, section 2.5: "the
  // walk returns instantly, with no rise animation"): the try's bubble
  // stays where it is while the mark breathes and the answer arrives.
  const late = useCallback((processingAt: number, tried: WalkStep, retry: number) => {
    const { plan: p, relay: lay } = live.current;
    lay(withRead(p, processingAt, tried, null, { retryAttempt: retry }), processingAt + 1, "none");
  }, []);

  /** Upload the try, ask the machine, lay its answer in. */
  const submit = useCallback(
    async (audio: Blob, durationSec: number, from: { at: number; step: WalkStep; run: number }) => {
      // V4 B1.4: the wait is measured from Stop, on the phone's clock.
      const stoppedAtMs = Date.now();
      const { io: practiseIO, readLimit: limit } = live.current;
      const moment = from.step.moment ?? -1;
      const checkingAt = from.at + 1;
      const current = () =>
        run.current === from.run &&
        live.current.at === checkingAt &&
        live.current.plan[checkingAt]?.key === "processing";
      const attempt = from.step.attempt ?? 1;
      // The try's voice is on screen from Stop (its orange bubble stays
      // through the checking and the answer, lock 2026-10-12).
      const url = URL.createObjectURL(audio);
      urls.current.push(url);
      setTries((t) => ({
        ...t,
        [moment]: {
          practiceId: t[moment]?.practiceId ?? "",
          audio: { url, durationMs: Math.round(durationSec * 1000) },
          audios: { ...t[moment]?.audios, [attempt]: { url, durationMs: Math.round(durationSec * 1000) } },
        },
      }));
      const practiceId = practiseIO ? await (opened.current.get(moment) ?? Promise.resolve(null)) : null;
      if (!practiseIO || !practiceId) {
        if (current()) late(checkingAt, from.step, attempt);
        return;
      }
      const sent = await within(practiseIO.upload(practiceId, audio, durationSec, stoppedAtMs), UPLOAD_LIMIT_MS);
      if (!sent) {
        if (current()) late(checkingAt, from.step, attempt);
        return;
      }
      setTries((t) => ({ ...t, [moment]: { ...t[moment], practiceId } }));
      const tried: WalkStep = { ...from.step, attempt: sent.attempt };
      const read = await within(practiseIO.check(practiceId, sent.attemptId), limit);
      if (!current()) return;
      if (!read) {
        late(checkingAt, tried, sent.attempt + 1);
        return;
      }
      const { plan: p, relay: lay } = live.current;
      lay(withRead(p, checkingAt, tried, read.check), checkingAt + 1, "none");
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
    lay(withRead(checking, i + 1, here, null, { retryAttempt: here.attempt ?? 1 }), i + 2, "none");
  }, [mic.state]);

  const stop = useCallback(() => {
    const { plan: p, at: i, relay: lay } = live.current;
    const here = p[i];
    if (here?.key !== "practise" || !micOn.current) return;
    micOn.current = false;
    run.current += 1;
    pending.current = { at: i, step: here, run: run.current };
    void mic.stop();
    lay(withChecking(p, i), i + 1, "none");
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
    lay(withRetry(p, i, practise), i, "none");
  }, []);

  const reset = useCallback(() => {
    cancel();
    opened.current = new Map();
    setTries({});
    for (const timer of aiTimers.current) clearTimeout(timer);
    aiTimers.current.clear();
    aiAsked.current = new Set();
    aiPractice.current = new Map();
    aiWaiting.current = new Set();
    setAiVoice({});
  }, [cancel]);

  const tryOf = useCallback((moment: number) => tries[moment], [tries]);
  const aiVoiceOf = useCallback((moment: number) => aiVoice[moment], [aiVoice]);
  const aiVoicePlayed = useCallback((moment: number) => {
    const practiceId = aiPractice.current.get(moment);
    if (practiceId) void noteAiVoicePlay(practiceId);
  }, []);

  const aiVoicePracticeOf = useCallback((moment: number) => aiPractice.current.get(moment), []);
  const aiVoiceAsking = useCallback((moment: number) => aiWaiting.current.has(moment), []);

  return { elapsed, stop, skip, again, tryOf, cancel, reset, aiVoiceOf, aiVoicePlayed, aiVoicePracticeOf, aiVoiceAsking };
}

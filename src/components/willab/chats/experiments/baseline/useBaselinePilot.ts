"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UiLocale } from "@/lib/uiLocale";
import { baselinePilot, BaselineAccessError, type BaselineReport, type BaselineRun, type BaselineStatus,
  type BaselineStep, type BaselineWrite, type FeltEnergy, type FeltValence } from "@/services/api/baselinePilot";

export type BaselineAnswer = { step: BaselineStep; audio?: Blob; energy?: FeltEnergy; valence?: FeltValence };
export type BaselineApi = typeof baselinePilot;

function startId(version: string, language: UiLocale): string {
  const key = `willab-baseline-start:${version}:${language}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function movedPast(run: BaselineRun | null | undefined, prior: BaselineRun, step: BaselineStep): boolean {
  return run?.id === prior.id && (run.next_step?.id !== step.id || run.next_step.state !== step.state);
}

export function useBaselinePilot(api: BaselineApi, language: UiLocale) {
  const [status, setStatus] = useState<BaselineStatus | null>(null);
  const [statusLanguage, setStatusLanguage] = useState<UiLocale | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [accessError, setAccessError] = useState<BaselineAccessError["kind"] | null>(null);
  const [answers, setAnswers] = useState<BaselineAnswer[]>([]);
  const [energy, setEnergy] = useState<{ step: string; value: FeltEnergy } | null>(null);
  const [captured, setCaptured] = useState<{ step: string; audio: Blob } | null>(null);
  const active = useRef(true);
  const working = useRef(false);
  const revision = useRef(0);
  const startRequest = useRef<{ version: string; language: UiLocale; id: string } | null>(null);
  const pendingReport = useRef<{ run: string; step: string; state: BaselineStep["state"]; report: BaselineReport } | null>(null);
  const run = status?.runs.initial ?? null;
  const step = run?.next_step ?? null;
  const disclosure = statusLanguage === language ? status?.disclosure : null;
  const complete = status?.entry_allowed === true && Boolean(run?.completed_at) && step === null;

  const refuse = useCallback((error: unknown) => {
    if (!(error instanceof BaselineAccessError)) return false;
    if (active.current) setAccessError(error.kind);
    return true;
  }, []);

  const refresh = useCallback(async (): Promise<BaselineStatus | null> => {
    const requested = ++revision.current;
    try {
      const next = await api.status(language);
      if (active.current && requested === revision.current) {
        setStatus(next); setStatusLanguage(language); setFailed(false);
      }
      return next;
    } catch (error) {
      if (active.current && requested === revision.current && !refuse(error)) setFailed(true);
      return null;
    }
  }, [api, language, refuse]);

  useEffect(() => {
    active.current = true;
    void refresh();
    return () => { active.current = false; revision.current += 1; };
  }, [refresh]); // The server chooses the first missing saved answer after navigation.

  function apply(write: BaselineWrite) {
    if (!active.current) return;
    revision.current += 1;
    setStatus(current => current ? {
      ...current, entry_allowed: write.entry_allowed, runs: { ...current.runs, initial: write.run },
    } : current);
    setFailed(false);
  }

  async function transact(work: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true); setFailed(false);
    try { await work(); }
    catch (error) { if (active.current && !refuse(error)) setFailed(true); }
    finally {
      working.current = false;
      if (active.current) setBusy(false);
    }
  }

  async function begin() {
    if (!disclosure || run) return;
    if (startRequest.current?.version !== disclosure.version || startRequest.current.language !== language) {
      startRequest.current = { version: disclosure.version, language, id: startId(disclosure.version, language) };
    }
    const requestId = startRequest.current.id;
    await transact(async () => {
      try { apply(await api.start(disclosure.version, requestId, language)); }
      catch (error) { if (refuse(error)) return; if (!(await refresh())?.runs.initial) throw error; }
    });
  }

  async function upload(audio: Blob): Promise<boolean> {
    if (!run || !step || step.state !== "record" || working.current) return false;
    let saved = false;
    await transact(async () => {
      try {
        apply(await api.audio(run.id, step.id, audio));
        if (active.current) setCaptured({ step: step.id, audio });
        saved = true;
      }
      catch (error) {
        if (refuse(error)) return;
        if (active.current) setCaptured(null);
        const next = (await refresh())?.runs.initial;
        saved = movedPast(next, run, step);
        if (!saved) throw error;
      }
    });
    return saved;
  }

  async function report(value: BaselineReport) {
    if (!run || !step || working.current || step.state === "record") return;
    if ((step.state === "valence") !== ("felt_valence" in value)) return;
    pendingReport.current = { run: run.id, step: step.id, state: step.state, report: value };
    await transact(async () => {
      let saved: BaselineWrite;
      try {
        saved = await api.report(run.id, step.id, value);
        if (!movedPast(saved.run, run, step)) throw Error("Baseline report did not advance");
        apply(saved);
      } catch (error) {
        if (refuse(error)) return;
        if (!movedPast((await refresh())?.runs.initial, run, step)) throw error;
        pendingReport.current = null;
        return;
      }
      pendingReport.current = null;
      if (!active.current) return;
      if (saved.run.next_step?.id === step.id) {
        if ("felt_energy" in value) setEnergy({ step: step.id, value: value.felt_energy });
        return;
      }
      const answer: BaselineAnswer = {
        step, audio: captured?.step === step.id ? captured.audio : undefined,
        energy: "felt_energy" in value ? value.felt_energy : energy?.step === step.id ? energy.value : undefined,
        valence: "felt_valence" in value ? value.felt_valence : undefined,
      };
      setAnswers(current => current.some(previous => previous.step.id === step.id) ? current : [...current, answer]);
      setEnergy(null);
      setCaptured(null);
    });
  }

  function retry() {
    const pending = pendingReport.current;
    if (pending && run?.id === pending.run && step?.id === pending.step && step.state === pending.state) {
      return report(pending.report);
    }
    return run || !disclosure ? refresh() : begin();
  }

  return { status, disclosure, run, step, complete, busy, failed, accessError, answers, captured,
    energy: energy?.step === step?.id ? energy?.value : undefined, begin, upload, report, retry };
}

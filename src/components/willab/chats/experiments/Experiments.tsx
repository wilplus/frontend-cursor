"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { publishExperimentContext } from "@/lib/willab/experiments/contextStore";
import { useExperimentVersion } from "@/lib/willab/experiments/context";
import { pickInterventions } from "@/lib/willab/experiments/overlap";
import { readingFor } from "@/lib/willab/experiments/sample";
import {
  beginAnalysis,
  deleteMine,
  EXPERIMENTS_USE_MOCKS,
  openSession,
  previewPromptSchema,
  promptSchema,
  readAnalysis,
  readInterventions,
  saveTake,
} from "@/services/api/experiments";
import type { AnalyzeTake } from "@/lib/willab/experiments/types";
import { Analysis, Consent, Delete, Export, Library, Menu, Pick, PreviewComplete, PromptStep, Reading, Upload, type View } from "./screens";

/* The private experiment area. One screen at a time, under the builder's
   bar. Results stay with the volunteer. The prompt file supplies the order,
   the cell tags and the self-rating words. */

export default function Experiments({ onBindBack }: { onBindBack: (fn: (() => boolean) | null) => void }) {
  useExperimentVersion();
  const file = promptSchema();
  const sample = EXPERIMENTS_USE_MOCKS;
  const sessionFile = sample ? previewPromptSchema() : file;
  const [view, setView] = useState<View>({ name: "menu", page: 0 });
  const [menuPage, setMenuPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const bind = useRef(onBindBack);
  bind.current = onBindBack;

  const back = useCallback((): boolean => {
    if (savingRef.current) return true;
    if (view.name === "menu") return false;
    if (view.name === "upload") return step({ name: "consent" });
    if (view.name === "prompt" && view.said) return step(promptView(view.sessionId, view.index));
    if (view.name === "reading") {
      return step({ name: "prompt", sessionId: view.sessionId, index: view.index, said: true, takeId: view.takeId, rating: view.rating });
    }
    if (view.name === "analysis" && view.source === "saved") {
      return step({ name: "prompt", sessionId: view.sessionId, index: view.index, said: true, takeId: view.takeId, rating: view.rating });
    }
    if (view.name === "pick" && view.rules) return step({ ...view, rules: false });
    if (view.name === "pick" && view.source === "saved" && view.sessionId) {
      return step({ name: "analysis", sessionId: view.sessionId, index: view.index, takeId: view.takeId, moment: view.moment, source: "saved", rating: {} });
    }
    if (view.name === "library" && view.editing) return step({ name: "library", index: view.index, editing: false, adding: false });
    if (view.name === "delete" && view.step !== "ask") return step({ name: "delete", step: "ask" });
    return step({ name: "menu", page: menuPage });

    function step(next: View): boolean {
      setView(next);
      return true;
    }
  }, [view, menuPage]);

  useEffect(() => {
    bind.current(back);
    return () => bind.current(null);
  }, [back]);

  const openMenu = (id: string) => {
    if (id === "session") return setView({ name: "consent" });
    if (id === "library") return setView({ name: "library", index: 0, editing: false, adding: false });
    if (id === "sample") return setView({ name: "analysis", sessionId: "", index: 0, takeId: "sample", moment: 0, source: "open", rating: {} });
    if (id === "rules") return setView({ name: "pick", sessionId: null, index: 0, takeId: "sample", moment: 0, source: "gate", rules: true, slot: 0, cell: 0 });
    if (id === "export") return setView({ name: "export" });
    setView({ name: "delete", step: "ask" });
  };

  if (view.name === "menu") {
    return <Menu page={view.page} onPage={(page) => { setMenuPage(page); setView({ name: "menu", page }); }} onOpen={openMenu} />;
  }
  if (view.name === "consent") return <Consent onNo={() => setView({ name: "menu", page: menuPage })} onYes={() => {
    if (sample) void startSession();
    else setView({ name: "upload" });
  }} />;
  if (view.name === "upload") return <Upload onStart={startSession} />;
  if (view.name === "prompt") {
    return (
      <PromptStep
        key={view.index}
        file={sessionFile}
        view={view}
        saving={saving}
        saveError={saveError}
        onSkip={() => advance(view.sessionId, view.index)}
        onSaid={(audio) => setView({ ...view, said: true, audio })}
        onRate={(rating) => setView({ ...view, rating })}
        onAgain={() => { setSaveError(null); setView(promptView(view.sessionId, view.index)); }}
        onSave={() => void keepTake(view)}
      />
    );
  }
  if (view.name === "reading") return <Reading />;
  if (view.name === "analysis") {
    return (
      <Analysis
        view={view}
        onMoment={(moment) => setView({ ...view, moment })}
        onTry={() => setView({ name: "pick", sessionId: view.sessionId || null, index: view.index, takeId: view.takeId, moment: view.moment, source: view.source, rules: false, slot: 0, cell: 0 })}
        onNext={() => (view.source === "saved" ? advance(view.sessionId, view.index) : setView({ name: "menu", page: menuPage }))}
      />
    );
  }
  if (view.name === "pick") {
    return (
      <Pick
        view={view}
        onRules={(rules) => setView({ ...view, rules })}
        onChoose={(id) => choose(view, id)}
        onEdit={(slot, cell) => setView({ ...view, slot, cell })}
      />
    );
  }
  if (view.name === "library") {
    return (
      <Library
        file={file}
        view={view}
        onIndex={(index) => setView({ ...view, index, editing: false, adding: false })}
        onEdit={(adding) => setView({ ...view, editing: true, adding })}
      />
    );
  }
  if (view.name === "export") return <Export />;
  if (view.name === "preview-complete") return <PreviewComplete onDone={() => setView({ name: "menu", page: menuPage })} />;
  return (
    <Delete
      step={view.name === "delete" ? view.step : "ask"}
      onAsk={() => setView({ name: "delete", step: "sure" })}
      onKeep={() => setView({ name: "menu", page: menuPage })}
      onGone={() => { void deleteMine().then(() => setView({ name: "delete", step: "gone" })); }}
      onDone={() => setView({ name: "menu", page: menuPage })}
    />
  );

  async function startSession(page?: File) {
    const session = await openSession({ businessCase: page });
    if (!session) return false;
    setView(promptView(session.id, 0));
    return true;
  }
  function promptView(sessionId: string, index: number): View {
    return { name: "prompt", sessionId, index, said: false, rating: {} };
  }
  function advance(sessionId: string, index: number) {
    const next = index + 1;
    if (next < sessionFile.prompts.length) setView(promptView(sessionId, next));
    else setView(sample ? { name: "preview-complete" } : { name: "export" });
  }
  async function keepTake(current: Extract<View, { name: "prompt" }>) {
    const prompt = sessionFile.prompts[current.index];
    const rating = current.rating;
    if (!prompt || !rating.energy || !rating.feeling || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    let takeId = current.takeId;
    try {
      if (!takeId) {
        const take = await saveTake({
          sessionId: current.sessionId, prompt,
          selfRating: { energy: rating.energy, feeling: rating.feeling },
          audio: current.audio,
        });
        if (!take) throw new Error("Take refused");
        takeId = take.id;
      }
      if (sample && prompt.tag === "baseline_calm") {
        advance(current.sessionId, current.index);
        return;
      }
      setView({ name: "reading", sessionId: current.sessionId, index: current.index, takeId, rating });
      await beginAnalysis(takeId);
      const ready = await waitForReading(takeId);
      if (!ready) throw new Error("Reading unavailable");
      setView({ name: "analysis", sessionId: current.sessionId, index: current.index, takeId, moment: 0, source: "saved", rating });
    } catch {
      setSaveError(takeId ? "The reading is unavailable. Try again." : "Could not save the take. Try again.");
      setView({ ...current, takeId });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function choose(current: Extract<View, { name: "pick" }>, chosen: string | null) {
    const analysis = readingFor(current.source === "open" ? "open" : "gate");
    const moment = analysis.moments[current.moment];
    if (moment) {
      const pick = pickInterventions(moment, readInterventions(), analysis.order, current.takeId, analysis.gate);
      const fired = chosen ? pick.shown.filter((hit) => hit.id === chosen) : pick.shown;
      publishExperimentContext({ source: "experiments", order: analysis.order, moment, gate: analysis.gate, fired });
    }
    if (current.source !== "saved" || !current.sessionId) setView({ name: "menu", page: menuPage });
    else advance(current.sessionId, current.index);
  }
}

async function waitForReading(takeId: string): Promise<AnalyzeTake | null> {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const ready = await readAnalysis(takeId);
    if (ready) return ready;
  }
  return null;
}

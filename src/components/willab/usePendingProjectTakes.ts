"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { expiredTake, takeAudio, waitingTakes } from "@/lib/willab/takeOutbox";
import { publishProjectTrainings } from "@/lib/willab/projectTrainings";
import { fetchTrainings, type TrainingArc, type TrainingTake } from "@/services/api/trainings";
import { readyForReview } from "@/lib/willab/takeExchange";

export interface PendingProjectTake {
  key: string;
  ownerId: string;
  projectId: string | null;
  topic: string;
  takeIndex: number;
  startedAt: number;
  audio?: Blob;
  sessionId?: string;
  error?: string;
}

type OnAccepted = (pending: PendingProjectTake, project: TrainingArc, take: TrainingTake) => void;

/** A finished Take can be visible in chat before it is in the project list. */
function usePendingProjectTakes(ownerId: string | null, onAccepted: OnAccepted) {
  const [all, setAll] = useState<PendingProjectTake[]>([]);
  const accepted = useRef(onAccepted);
  accepted.current = onAccepted;
  const pending = all.filter((take) => take.ownerId === ownerId);

  useEffect(() => {
    setAll((current) => current.filter((take) => take.ownerId === ownerId));
    if (!ownerId) return;
    let active = true;
    void waitingTakes().then(async (kept) => {
      const restored = await Promise.all(kept
        .filter((take) => take.ownerId === ownerId && !take.chat && !expiredTake(take))
        .map(async (take): Promise<PendingProjectTake> => ({
          key: take.key,
          ownerId,
          projectId: take.projectId,
          topic: take.upload.topic,
          takeIndex: take.takeIndex ?? 1,
          startedAt: take.savedAt,
          audio: (await takeAudio(take))?.audio,
        })));
      if (active && restored.length > 0) {
        setAll((current) => [...current, ...restored.filter((take) => !current.some((item) => item.key === take.key))]);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [ownerId]);

  useEffect(() => {
    const waiting = all.filter((take) => take.ownerId === ownerId);
    if (!waiting.length) return;
    let active = true;
    let reading = false;
    const refresh = async () => {
      if (reading) return;
      reading = true;
      try {
        const projects = await fetchTrainings({ force: true });
        if (!active || !projects) return;
        const matched = new Set<string>();
        for (const project of projects) {
          for (const take of project.takes) {
            const local = waiting.find((item) => item.key === take.uploadKey || item.sessionId === take.sessionId);
            if (!local) continue;
            matched.add(local.key);
            accepted.current(local, project, take);
          }
        }
        if (matched.size) {
          publishProjectTrainings(projects);
          setAll((current) => current.filter((take) => !matched.has(take.key)));
        }
      } finally {
        reading = false;
      }
    };
    const poll = () => { void refresh().catch(() => undefined); };
    poll();
    const timer = window.setInterval(poll, 2_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [all, ownerId]);

  function remember(take: PendingProjectTake) {
    if (take.ownerId !== ownerId) return;
    setAll((current) => [take, ...current.filter((item) => item.key !== take.key)]);
  }

  function fail(key: string, error: string) {
    setAll((current) => current.map((take) => take.key === key ? { ...take, error } : take));
  }

  function acknowledge(key: string, sessionId: string) {
    setAll((current) => current.map((take) => take.key === key ? { ...take, sessionId } : take));
  }

  return { pending, remember, fail, acknowledge };
}

export function useProjectTakeHandoff(
  ownerId: string | null,
  pickedProject: TrainingArc | null,
  returnProject: TrainingArc | null,
  openAccepted: (project: TrainingArc, sessionId: string) => void,
) {
  const [key, setKey] = useState<string | null>(null);
  const [wait, openWait] = useState<PendingProjectTake | null>(null);
  const closeWait = useCallback(() => openWait(null), []);
  const clear = useCallback(() => {
    setKey(null);
    openWait(null);
  }, []);
  const takes = usePendingProjectTakes(ownerId, (pending, project, take) => {
    if (key === pending.key || pickedProject?.arcId === project.arcId) {
      openAccepted(project, take.sessionId);
      setKey(null);
    }
    openWait((current) => {
      if (current?.key !== pending.key) return current;
      return readyForReview(take) ? null : { ...current, sessionId: take.sessionId };
    });
  });
  const project = pickedProject ?? returnProject;
  const preview = project ? undefined : takes.pending.find((take) => take.key === key);
  const currentWait = wait?.ownerId === ownerId
    ? takes.pending.find((take) => take.key === wait.key) ?? wait : null;

  return {
    ...takes, project, preview, clear, openWait, closeWait,
    select: (take: PendingProjectTake) => setKey(take.key),
    chatActive: Boolean(project || preview),
    wait: currentWait?.error ? null : currentWait,
  };
}

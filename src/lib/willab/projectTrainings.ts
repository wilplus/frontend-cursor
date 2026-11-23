"use client";

import { useEffect, useState } from "react";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";

export type ProjectTrainingsStatus = "loading" | "ready" | "error";

type Snapshot = {
  projects: TrainingArc[] | null;
  status: ProjectTrainingsStatus;
};

let snapshot: Snapshot = { projects: null, status: "loading" };
let pending: Promise<TrainingArc[] | null> | null = null;
const listeners = new Set<() => void>();

export function subscribeToProjectTrainings(receive: (projects: TrainingArc[]) => void): () => void {
  const listen = () => { if (snapshot.status === "ready" && snapshot.projects) receive(snapshot.projects); };
  listeners.add(listen);
  return () => { listeners.delete(listen); };
}

function publish(next: Snapshot): void {
  snapshot = next;
  listeners.forEach((listen) => listen());
}
/** Read the active project list once per in-flight request. All project-list
 * surfaces use this same seam, so a revalidation cannot be stranded in one
 * component's local state. */
export function refreshProjectTrainings(): Promise<TrainingArc[] | null> {
  if (pending) return pending;
  publish({ projects: null, status: "loading" });
  pending = fetchTrainings()
    .then((projects) => {
      publish(
        projects === null
          ? { projects: null, status: "error" }
          : { projects, status: "ready" },
      );
      return projects;
    })
    .catch(() => {
      publish({ projects: null, status: "error" });
      return null;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Apply a successful archive immediately. The server mutation is the source
 * of truth for this row; the next picker mount still performs a fresh read. */
export function removeProjectTraining(projectId: string): void {
  if (!snapshot.projects) return;
  publish({
    projects: snapshot.projects.filter((project) => project.arcId !== projectId),
    status: "ready",
  });
}

/** The picker subscribes to the shared read; mounting it always revalidates,
 * while concurrent callers still share the one request above. */
export function useProjectTrainings(): {
  projects: TrainingArc[] | null;
  status: ProjectTrainingsStatus;
  reload: () => Promise<TrainingArc[] | null>;
} {
  const [current, setCurrent] = useState<Snapshot>(() => snapshot);

  useEffect(() => {
    const listen = () => setCurrent(snapshot);
    listeners.add(listen);
    setCurrent(snapshot);
    void refreshProjectTrainings();
    return () => {
      listeners.delete(listen);
    };
  }, []);

  return { projects: current.projects, status: current.status, reload: refreshProjectTrainings };
}

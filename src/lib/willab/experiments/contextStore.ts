import type { ExperimentCoachingContext } from "./types";

/* The last reading, kept for the coaching chat. No React in this file,
   so the API client can clear it without a cycle. */

let current: ExperimentCoachingContext | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function publishExperimentContext(next: ExperimentCoachingContext | null): void {
  current = next;
  emit();
}

export function readExperimentContext(): ExperimentCoachingContext | null {
  return current;
}

export function clearExperimentContext(): void {
  if (current === null) return;
  publishExperimentContext(null);
}

export function subscribeExperimentContext(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

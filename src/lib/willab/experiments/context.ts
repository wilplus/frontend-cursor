"use client";

import { useSyncExternalStore } from "react";
import { experimentVersion, subscribeExperiments } from "@/services/api/experiments";
import { readExperimentContext, subscribeExperimentContext } from "./contextStore";

export { publishExperimentContext, readExperimentContext, clearExperimentContext } from "./contextStore";

/* The coaching chat can call readExperimentContext() when it wants this
   area's last reading. Nothing in the chat imports this yet. */

export function useExperimentContext() {
  return useSyncExternalStore(subscribeExperimentContext, readExperimentContext, () => null);
}

export function useExperimentVersion(): number {
  return useSyncExternalStore(subscribeExperiments, experimentVersion, experimentVersion);
}

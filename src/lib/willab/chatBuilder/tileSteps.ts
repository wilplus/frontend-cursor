/* Which of the four home tiles is done, on this device. Nothing here
   calls the network. The draft lives for the same visit. */

import { useEffect, useState } from "react";

export const TILE_STEPS_KEY = "wlp-tile-steps";
export const TILE_STEPS_EVENT = "wlp-tile-steps";

export type TileId = "build" | "settings" | "test" | "ai";
export type TileSteps = Record<TileId, boolean>;

const EMPTY: TileSteps = { build: false, settings: false, test: false, ai: false };

function emit(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TILE_STEPS_EVENT));
}

export function readTileSteps(): TileSteps {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = sessionStorage.getItem(TILE_STEPS_KEY);
    if (!raw) return { ...EMPTY };
    const got = JSON.parse(raw) as Partial<TileSteps>;
    return {
      build: got.build === true,
      settings: got.settings === true,
      test: got.test === true,
      ai: got.ai === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Remembers one step. A repeat of the same value does not redraw. */
export function markTileStep(id: TileId, done: boolean): void {
  const cur = readTileSteps();
  if (cur[id] === done) return;
  try {
    sessionStorage.setItem(TILE_STEPS_KEY, JSON.stringify({ ...cur, [id]: done }));
  } catch {
    /* a private window keeps the last value this function returns */
  }
  emit();
}

export function clearTileSteps(): void {
  try {
    sessionStorage.removeItem(TILE_STEPS_KEY);
  } catch {
    /* already gone */
  }
  emit();
}

export function useTileSteps(): TileSteps {
  const [steps, setSteps] = useState<TileSteps>(readTileSteps);
  useEffect(() => {
    const sync = () => setSteps(readTileSteps());
    sync();
    window.addEventListener(TILE_STEPS_EVENT, sync);
    return () => window.removeEventListener(TILE_STEPS_EVENT, sync);
  }, []);
  return steps;
}

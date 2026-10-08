/* -------------------------------------------------------------------------- */
/*  The coach panel harness's still screens (?screen=<name>): where the        */
/*  panel's reducer starts for each P1 screen, built from the fixtures. DEV    */
/*  ONLY.                                                                      */
/* -------------------------------------------------------------------------- */

import { PANEL_START, type PanelState } from "@/lib/willab/coachPanel";
import { IMPORT_BOARD, SNIPS, queueSpeakers } from "./panelFixtures";

export const SCREEN_NAMES = [
  "door", "queue", "speakers", "speaker", "judge", "reveal", "corpushome", "corpusimport", "corpusanalyse", "corpus",
] as const;
export type ScreenName = (typeof SCREEN_NAMES)[number];

/** The snippets each still screen needs rated before it draws. */
export const PRE_RATED: Record<ScreenName, readonly string[]> = {
  door: [], queue: [], speakers: [], speaker: [], judge: [], reveal: [SNIPS[0]],
  corpushome: [], corpusimport: [], corpusanalyse: [], corpus: [],
};

export function startFor(name: ScreenName): PanelState {
  const rated = new Set(PRE_RATED[name]);
  const heron = queueSpeakers(rated)[0];
  const take = heron.takes.find((t) => t.takeIndex === 2) ?? heron.takes[0];
  const speaker = { key: "speaker" as const, speaker: heron };
  switch (name) {
    case "door":
      return PANEL_START;
    case "queue":
      return { ...PANEL_START, screen: { key: "queue" } };
    case "speakers":
      return { ...PANEL_START, screen: { key: "speakers" } };
    case "corpushome":
      return { ...PANEL_START, screen: { key: "corpushome" } };
    case "corpusimport":
      return { ...PANEL_START, screen: { key: "corpusimport", setupOf: null }, history: [{ key: "corpushome" }] };
    case "corpusanalyse":
      return { ...PANEL_START, screen: { key: "corpusanalyse" }, history: [{ key: "corpushome" }, { key: "corpusimport", setupOf: null }] };
    case "corpus":
      return { ...PANEL_START, screen: { key: "corpus", importId: IMPORT_BOARD, topic: "Board update, March" }, history: [{ key: "corpushome" }] };
    case "speaker":
      return { ...PANEL_START, screen: speaker, history: [{ key: "queue" }] };
    case "judge":
      return { ...PANEL_START, screen: { key: "judge", speaker: heron, take, index: 0 }, history: [{ key: "queue" }, speaker] };
    case "reveal":
      return {
        screen: { key: "reveal", speaker: heron, take, index: 0 },
        history: [{ key: "queue" }, speaker],
        rated: { [SNIPS[0]]: "no" },
      };
  }
}

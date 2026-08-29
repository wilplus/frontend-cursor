/* -------------------------------------------------------------------------- */
/*  rootPhraseLayer — the one ordered projection for rehearsal anchors.        */
/*                                                                            */
/*  In fullscreen Presentation Mode a slide has three visual layers: its       */
/*  visual, its rooting phrases, then the complete Ideal Text. This projection  */
/*  belongs to that presenter/export surface only. It never guesses a phrase   */
/*  and never removes words from the detailed text underneath.                  */
/* -------------------------------------------------------------------------- */

export interface RootPhraseLayerSource {
  key: string | number;
  rootPhrase?: string | null;
  rootType?: "flagship" | "neutral" | null;
}

export interface RootPhraseLayerItem {
  key: string | number;
  text: string;
  type: "flagship" | "neutral";
}

export interface SlideRootPhraseLayerSource {
  slideIndex?: number | null;
  rootPhrase?: string | null;
  rootType?: "flagship" | "neutral" | null;
}

export interface CommittedSlideRoot {
  slideIndex: number;
  text: string;
  type: "flagship";
}

/** The recording roadmap projection. Only a user-approved orange flagship is
 * authoritative enough to prompt the next Take; generated neutral text and
 * unassigned phrases are deliberately absent. */
export function buildCommittedSlideRoots(
  sources: readonly SlideRootPhraseLayerSource[],
): CommittedSlideRoot[] {
  return sources.flatMap((source) => {
    const text = source.rootPhrase?.trim() ?? "";
    return source.rootType === "flagship" &&
      typeof source.slideIndex === "number" &&
      Number.isInteger(source.slideIndex) &&
      source.slideIndex >= 0 &&
      text
      ? [{ slideIndex: source.slideIndex, text, type: "flagship" as const }]
      : [];
  });
}

export function buildRootPhraseLayer(
  sources: readonly RootPhraseLayerSource[],
  { includeNeutral = true }: { includeNeutral?: boolean } = {},
): RootPhraseLayerItem[] {
  const out: RootPhraseLayerItem[] = [];
  for (const source of sources) {
    const text = source.rootPhrase?.trim() ?? "";
    if (!text) continue;
    const type = source.rootType === "neutral" ? "neutral" : "flagship";
    if (!includeNeutral && type === "neutral") continue;
    out.push({ key: source.key, text, type });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  rootPhraseLayer — the one ordered projection for rehearsal anchors.        */
/*                                                                            */
/*  A slide has three visual layers: its visual/title, its rooting phrases,    */
/*  then the complete Ideal Text. This helper keeps the middle layer identical */
/*  in the editable deck and fullscreen Presentation Mode. It never guesses a  */
/*  phrase and never removes words from the detailed text underneath.           */
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

import { DEFAULT_DECK } from "@/lib/willab/defaultDeck";
import DeckSlideThumb from "./DeckSlideThumb";

export default function IdealTextSlide({ presentationRef, pageIndex, slideTitle, label, deckKnown = true }: {
  presentationRef: string | null;
  pageIndex: number;
  slideTitle?: string | null;
  label: string;
  deckKnown?: boolean;
}) {
  const hasPreview = presentationRef || slideTitle?.trim() || (deckKnown && DEFAULT_DECK[pageIndex]?.artworkSrc);
  return (
    <figure data-ideal-text-slide={pageIndex} className="flex flex-col items-start gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">{label}</figcaption>
      {hasPreview ? <DeckSlideThumb document
        presentationRef={presentationRef} pageIndex={pageIndex} slideTitle={slideTitle} label={label} /> : null}
    </figure>
  );
}

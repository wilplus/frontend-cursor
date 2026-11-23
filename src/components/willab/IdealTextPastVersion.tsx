"use client";

import { useState, type ReactNode } from "react";
import { copyAiGeneratedText } from "@/lib/willab/aiGeneratedMark";
import type { PresentationExportFormat } from "@/lib/willab/presentationDocument";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import type { ReviewRevision } from "@/services/api/takeReview";
import IdealTextMenu from "./IdealTextMenu";
import PresentMode from "./PresentMode";
import ExportFormatDialog from "./ExportFormatDialog";
import { PAST_TAKE_COPY } from "./idealEditCopy";
import { RichText } from "./RichText";
import { HelpersLabel, kickerFor } from "./TranscriptReviewDeck";
import { useBackDismiss } from "./useBackDismiss";
import { ChatLink } from "./WillQuestion";
import { helperWordRanges, missingHelperWords } from "@/lib/willab/answeredBookmark";
import { helperHeadlineOf, slideGroupsOf, type IdealTextPast } from "@/lib/willab/pastIdealText";
import type { IdealTextRevision } from "@/services/api/blockVariants";
import IdealTextDocument from "./IdealTextDocument";
import IdealTextSlide from "./IdealTextSlide";

/* -------------------------------------------------------------------------- */
/*  IdealTextPastVersion — an older Take's Ideal Text card, opened (founder    */
/*  2026-11-03, backend N375): the words that Take made, as they were then,    */
/*  read only, slide by slide on the deck that Take was said on. The newest    */
/*  card still opens the live page (rule 5: the Ideal Text is what the latest  */
/*  Take said; an old version is shown, never brought back). Read from the     */
/*  same versions as the History under ⋯.                                     */
/* -------------------------------------------------------------------------- */

export default function IdealTextPastVersion({
  revision,
  past,
  latestTake = null,
  onClose,
  onLatest,
}: {
  revision: IdealTextRevision;
  past: IdealTextPast;
  /** The project's latest Take, for "Go to Take M" (N380). */
  latestTake?: number | null;
  onClose: () => void;
  /** "Go to Take M": the Ideal Text page, the latest Take's. */
  onLatest: () => void;
}) {
  useBackDismiss(onClose);
  const take = revision.takeIndex ?? (past.by === "take" ? past.n : null);
  return (
    <div data-ideal-text-past className="fixed inset-0 z-40 overflow-y-auto overscroll-none bg-background px-4 sm:px-6">
      <ArchivedIdealText revision={revision} name={past.title} take={take} onClose={onClose}>
        {take !== null ? (
          <div data-past-take>
            <p className="text-[15px] leading-relaxed">{PAST_TAKE_COPY.whichTake(take)}</p>
            {latestTake !== null && latestTake !== take ? (
              <ChatLink label={PAST_TAKE_COPY.goToLatest(latestTake)} onClick={onLatest} />
            ) : null}
          </div>
        ) : null}
      </ArchivedIdealText>
    </div>
  );
}

type ReviewEdits = {
  arcId: string;
  takeId: string;
  copy: ReviewRevision | null;
  draft?: string[];
  status: string;
  saving: boolean;
  onEdit: (sections: string[]) => void;
  onSave: () => void;
};

export function ArchivedIdealText({ revision, name, take, review, onClose, children }: {
  revision: IdealTextRevision;
  name?: string | null;
  take: number | null;
  review?: ReviewEdits;
  onClose?: () => void;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [delivery, setDelivery] = useState<"present" | PresentationExportFormat | null>(null);
  const groups = slideGroupsOf(revision);
  const saved = review?.copy?.document.ideal_sections;
  const sections = saved?.length === groups.length ? saved : groups.map((group) => group.paragraphs.join("\n\n"));
  const words = sections.join("\n\n");
  const pieces = sections.flatMap((section, i) => section.split("\n\n").map((text) => ({
    text, slideIndex: groups[i].slideIndex, rootPhrase: helperHeadlineOf(revision, groups[i].slideIndex) ?? "",
  }))).map((piece, pieceKey) => ({
    ...piece, pieceKey, rootType: "flagship" as const, status: "settled" as const,
    takeSessionId: review?.takeId ?? "", takeIndex: take, snippetId: "", challenger: null,
  }));
  const menu = review?.draft ? <button type="button" className="min-h-11 text-sm underline"
    disabled={review.saving} onClick={review.onSave}>Done</button> :
    <IdealTextMenu arcId={review?.arcId ?? ""} saved={null} onSaved={() => undefined}
      onEdit={review?.copy && sections.length ? () => review.onEdit(sections) : null}
      onExport={() => setChooser(true)} onPresent={() => setDelivery("present")}
      copied={copied} onCopy={() => {
        void copyAiGeneratedText(stripRichMarkers(words), "ideal-text", { name }).then((ok) => setCopied(ok));
      }} />;
  return <>
    <IdealTextDocument name={name} take={take} menu={menu} onClose={onClose}>
      {children}
      {review?.status ? <p role="status" className="text-sm text-muted-foreground">{review.status}</p> : null}
      {groups.map((group, i) => (
        <section key={i} className="flex w-full flex-col gap-3 border-t border-border py-2"
          data-review-slide={group.slideIndex ?? undefined}>
          {group.slideIndex !== null ? <IdealTextSlide presentationRef={revision.presentationRef}
            pageIndex={group.slideIndex} slideTitle={revision.slideTitles?.[group.slideIndex]}
            deckKnown={revision.deckKnown === true} label={kickerFor(group.slideIndex, null)} /> : null}
          {review?.draft ? <textarea aria-label="Edit Ideal text" value={review.draft[i]}
            className="min-h-24 w-full rounded-lg border border-border bg-background p-2"
            onChange={(event) => {
              const next = event.target.value;
              review.onEdit((review.draft ?? sections).map((text, index) => index === i ? next : text));
            }} /> :
            <PastSlideText paragraphs={sections[i].split("\n\n")} headline={helperHeadlineOf(revision, group.slideIndex)} />}
        </section>
      ))}
    </IdealTextDocument>
    {chooser ? <ExportFormatDialog onClose={() => setChooser(false)} onSelect={(format) => { setChooser(false); setDelivery(format); }} /> : null}
    {delivery ? <PresentMode text={words} pieces={pieces} presentationRef={revision.presentationRef} slideTitles={revision.slideTitles}
      exportFormat={delivery === "present" ? null : delivery} onClose={() => setDelivery(null)} /> : null}
  </>;
}

/** One slide's words, as the page draws them: the helper words of that
 *  time orange where the words say them, and those the words no longer
 *  say before the first paragraph with the HELPERS label (N380). Read
 *  only: nothing here opens. */
function PastSlideText({ paragraphs, headline }: { paragraphs: string[]; headline: string | null }) {
  const missing = missingHelperWords(paragraphs.join("\n\n"), headline);
  return (
    <div className="flex flex-col gap-4">
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="text-[clamp(1.0625rem,0.98rem+0.34vw,1.25rem)] leading-[1.65] text-foreground">
          {i === 0 ? <HelpersLabel phrases={missing} /> : null}
          <RichText
            text={paragraph}
            accent={false}
            tint={helperWordRanges(paragraph, headline)}
            tintClass="walk-helper-word text-primary font-semibold not-italic"
          />
        </p>
      ))}
    </div>
  );
}

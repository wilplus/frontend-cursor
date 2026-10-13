"use client";

import { useEffect, useState } from "react";
import { useDeliveryHeadlines } from "@/components/willab/useSlideHeadlines";
import { copyAiGeneratedText } from "@/lib/willab/aiGeneratedMark";
import { stripRichMarkers } from "@/lib/willab/richMarkers";
import type { PresentationExportFormat } from "@/lib/willab/presentationDocument";
import {
  fetchIdealTextRevisions,
  type IdealTextRevision,
} from "@/services/api/blockVariants";
import type { IdealPiece } from "@/services/api/idealText";
import { RevisionTimelineSheet } from "./BlockVariantPicker";
import ExportFormatDialog from "./ExportFormatDialog";
import IdealTextMenu from "./IdealTextMenu";
import PresentMode from "./PresentMode";

/** The ⋯ on the page a Take lands on: the same five items as the notebook's
 *  (prototype menu: Presentation Mode · Export · History · Copy the text ·
 *  Save the ideal text), with the same screens behind them. */
export default function ReadoutMenu({
  text,
  arcId,
  doc,
  presentationRef,
  onBeforeSave,
  onSaved,
}: {
  text: string;
  arcId: string | null | undefined;
  /** The served document; null before it arrives (Save is then withheld). */
  doc: {
    saved: boolean | null;
    title: string | null;
    pieces: IdealPiece[] | null;
    slideTitles: string[] | null;
  } | null;
  presentationRef: string | null;
  onBeforeSave: () => Promise<boolean>;
  onSaved: () => void;
}) {
  const saved = doc?.saved ?? null;
  const title = doc?.title ?? null;
  const pieces = doc?.pieces ?? null;
  const slideTitles = doc?.slideTitles ?? null;
  const [copied, setCopied] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [exportChooserOpen, setExportChooserOpen] = useState(false);
  const [exportFormat, setExportFormat] =
    useState<PresentationExportFormat | null>(null);
  const [revisions, setRevisions] = useState<IdealTextRevision[] | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const headlines = useDeliveryHeadlines(arcId ?? null, text);

  useEffect(() => {
    setRevisions(null);
    if (!arcId) return;
    let live = true;
    void fetchIdealTextRevisions(arcId).then((r) => {
      if (live && r.kind === "ready") setRevisions(r.revisions);
    });
    return () => {
      live = false;
    };
  }, [arcId, saved]);

  if (!text) return null;
  const present = (format: PresentationExportFormat | null, onClose: () => void) => (
    <PresentMode
      text={text}
      pieces={pieces}
      presentationRef={presentationRef}
      slideTitles={slideTitles}
      headlines={headlines}
      exportFormat={format}
      onClose={onClose}
    />
  );
  return (
    <>
      <IdealTextMenu
        arcId={arcId ?? ""}
        saved={saved}
        onBeforeSave={onBeforeSave}
        onSaved={onSaved}
        onPresent={() => setPresenting(true)}
        onExport={() => setExportChooserOpen(true)}
        onHistory={revisions?.length ? () => setTimelineOpen(true) : null}
        onCopy={() => {
          void copyAiGeneratedText(stripRichMarkers(text), "ideal-text", {
            name: title ?? undefined,
          }).then((ok) => {
            if (!ok) return;
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
        copied={copied}
      />
      {presenting ? present(null, () => setPresenting(false)) : null}
      {exportChooserOpen ? (
        <ExportFormatDialog
          onClose={() => setExportChooserOpen(false)}
          onSelect={(format) => {
            setExportFormat(format);
            setExportChooserOpen(false);
          }}
        />
      ) : null}
      {exportFormat ? present(exportFormat, () => setExportFormat(null)) : null}
      <RevisionTimelineSheet
        open={timelineOpen}
        revisions={revisions ?? []}
        onClose={() => setTimelineOpen(false)}
      />
    </>
  );
}

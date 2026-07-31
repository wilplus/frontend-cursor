"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FileText, Paperclip } from "lucide-react";
import { PANEL, SETUP } from "@/lib/life/copy";
import {
  applyConfirmedItems,
  fetchSetupDocuments,
  proposeFromDocument,
  uploadSetupDocument,
  type LifeDraftItem,
  type LifeSetupDocument,
} from "@/services/api/life";
import { invalidateLifeState } from "@/lib/life/useLifeState";
import { uploadKindForPath } from "@/lib/life/uploadKind";
import { DraftList } from "./StrategyDocument";

/* -------------------------------------------------------------------------- */
/*  PanelUpload — the document dock under every panel view (founder 2026-07-31) */
/*                                                                            */
/*  The upload used to have ONE door, at the foot of Goals, and before that    */
/*  ONE door inside setup. Both were the same argument each time: a strategy   */
/*  does not run once, so the way to hand one over cannot either. This is that */
/*  argument finished. The dock sits under every view, so the file is never    */
/*  further away than the screen you are already on, and it is the same        */
/*  upload, the same draft and the same tick-and-Add in all of them.           */
/*                                                                            */
/*  IT POINTS AT THE VIEW YOU ARE STANDING ON. `uploadKindForPath` turns the   */
/*  route into the item kind that view holds and passes it as a HINT, so a     */
/*  document opened from Phrases is read for phrases and one opened from       */
/*  Principles for principles. It is a hint on purpose: the FE does not decide */
/*  what a document can yield, so a backend that ignores the field answers     */
/*  exactly as it does today and the dock renders whatever comes back.         */
/*                                                                            */
/*  NOTHING LANDS WITHOUT BEING SHOWN FIRST (N5). Upload stores extracted text */
/*  and stops. Drafting returns rows and stops. Only rows the user has SEEN    */
/*  and left ticked are sent to apply, and the press is its own explicit act.  */
/*                                                                            */
/*  It is deliberately not a second navigation: one icon, one word, and it     */
/*  stays that size until there is something to show.                          */
/* -------------------------------------------------------------------------- */

export default function PanelUpload({
  onApplied,
}: {
  /** The rows created here are the surrounding view's own content, so the
   *  list the user is looking at is out of date the moment they land. */
  onApplied: () => void;
}) {
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [docs, setDocs] = useState<LifeSetupDocument[]>([]);
  /** The file THIS visit handed over, which is the only one the sheet may name.
   *  `docs` is the whole history and its order is the server's business, so
   *  captioning the sheet with `docs[0]` would put a filename the user did not
   *  just choose above rows they are about to tick. */
  const [uploaded, setUploaded] = useState<LifeSetupDocument | null>(null);
  const [draft, setDraft] = useState<LifeDraftItem[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftFailed, setDraftFailed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyFailed, setApplyFailed] = useState(false);
  const [applied, setApplied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // A read failure degrades to "no document yet", never an error state: the
    // upload is optional everywhere it appears, so a broken list must not be
    // allowed to hide the affordance that is the point of this dock.
    void fetchSetupDocuments()
      .then((list) => {
        if (!cancelled) setDocs(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const runDraft = useCallback(
    async (documentId?: string) => {
      setDrafting(true);
      setDraftFailed(false);
      setApplied(false);
      try {
        setDraft(
          await proposeFromDocument({
            documentId,
            kind: uploadKindForPath(pathname) ?? undefined,
          })
        );
      } catch {
        setDraftFailed(true);
      } finally {
        setDrafting(false);
      }
    },
    [pathname]
  );

  const onFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadFailed(false);
      setApplied(false);
      try {
        const doc = await uploadSetupDocument(file);
        setDocs((prev) => [doc, ...prev]);
        setUploaded(doc);
        // A new document invalidates the previous draft: those rows were read
        // out of a different file, and leaving them under a fresh upload would
        // attribute them to it.
        setDraft(null);
        if (doc.status === "processed") await runDraft(doc.id);
      } catch {
        setUploadFailed(true);
      } finally {
        setUploading(false);
      }
    },
    [runDraft]
  );

  const ticked = (draft ?? []).filter(
    (d) => d.checked && d.title.trim() !== ""
  ).length;

  const apply = useCallback(async () => {
    if (!draft) return;
    setApplying(true);
    setApplyFailed(false);
    try {
      await applyConfirmedItems(draft);
      setApplied(true);
      // Drop the reviewed rows rather than leave them on screen: they exist
      // now, and a second press of the same list would create them twice.
      setDraft(null);
      invalidateLifeState();
      onApplied();
    } catch {
      setApplyFailed(true);
    } finally {
      setApplying(false);
    }
  }, [draft, onApplied]);

  const hasReadable = docs.some((d) => d.status === "processed");
  const busy = uploading || drafting || applying;
  // The sheet is what makes the dock more than a button, so it opens only when
  // there is something in it. An empty sheet is a bar of chrome across the
  // bottom of every screen for nothing.
  const sheetOpen =
    busy || draft !== null || uploadFailed || draftFailed || applyFailed || applied;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && !busy) void onFile(file);
      }}
      className={`sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur transition-colors ${
        dragOver ? "border-foreground/40 bg-muted/60" : "border-border/70"
      }`}
    >
      {sheetOpen ? (
        <div className="mx-auto max-h-[50dvh] w-full max-w-3xl overflow-y-auto px-5 pb-1 pt-4">
          {uploaded && !uploading ? (
            <div className="flex items-start gap-2.5">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {uploaded.fileName}
                </p>
                {/* An unreadable file is SAID, not swallowed: the fill had
                    nothing to read, and knowing that is what stops someone
                    waiting for rows that are never coming. */}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {uploaded.status === "processed"
                    ? `${uploaded.charCount.toLocaleString("en-GB")} ${
                        SETUP.documentCharsSuffix
                      }`
                    : SETUP.documentFailedNote}
                </p>
              </div>
            </div>
          ) : null}

          {uploading ? (
            <p className="text-sm text-muted-foreground">
              {SETUP.documentUploading}
            </p>
          ) : null}
          {drafting ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {SETUP.draftWorking}
            </p>
          ) : null}
          {uploadFailed ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {SETUP.documentUploadError}
            </p>
          ) : null}
          {draftFailed ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {SETUP.draftFailed}
            </p>
          ) : null}

          {draft !== null ? (
            <>
              <DraftList
                draft={draft}
                onDraft={setDraft}
                disabled={applying}
                note={SETUP.draftPanelNote}
              />
              {draft.length > 0 ? (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => void apply()}
                    disabled={applying || ticked === 0}
                    className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-40"
                  >
                    {applying ? SETUP.draftApplyWorking : SETUP.draftApplyLabel}
                  </button>
                  {ticked === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {SETUP.draftNothingTicked}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {applied ? (
            <p className="text-sm text-foreground">{SETUP.draftApplied}</p>
          ) : null}
          {applyFailed ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {SETUP.draftApplyFailed}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-5 py-2.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title={`${PANEL.uploadHint} ${SETUP.documentDropNote}`}
          className="flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-[13px] text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {uploading
            ? SETUP.documentUploading
            : docs.length > 0
              ? PANEL.uploadOpenLabel
              : PANEL.uploadLabel}
        </button>

        {/* A document uploaded in an earlier visit has no draft in memory, so
            this is how that person reaches one. Hidden while a draft is on
            screen: re-reading the same file would throw away their ticks. */}
        {hasReadable && !busy && draft === null ? (
          <button
            type="button"
            onClick={() => void runDraft()}
            className="truncate rounded-full border border-border px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {SETUP.draftButton}
          </button>
        ) : null}

        <p className="ml-auto hidden truncate text-xs text-muted-foreground sm:block">
          {SETUP.documentDropNote}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFile(file);
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { FileText } from "lucide-react";
import { SETUP } from "@/lib/life/copy";
import {
  uploadSetupDocument,
  type LifeDraftItem,
  type LifeSetupDocument,
} from "@/services/api/life";
import { PanelCard } from "./primitives";

/* -------------------------------------------------------------------------- */
/*  The strategy document, and what gets filled in from it (item 9)            */
/*                                                                            */
/*  Founder 2026-07-30: this works like a CV generator. You hand over the      */
/*  document you already wrote, and the screens after it come pre-filled with  */
/*  what it found, ready to be edited or deleted. The document step therefore  */
/*  sits FIRST among the real questions, and the fill is the whole point of    */
/*  it rather than a bonus at the end.                                        */
/*                                                                            */
/*  TWO HOSTS, ONE IMPLEMENTATION:                                            */
/*    · setup (SetupFlow) — upload on step 2, via `DocumentUpload` below.      */
/*      Goals fold forward into the eight horizon screens (see                 */
/*      lib/life/documentFold); everything that cannot fold is reviewed as     */
/*      checkable rows on the last screen and created on Finish.               */
/*    · the panel (`PanelUpload`) — the same upload, kept open afterwards      */
/*      because setup runs once and a strategy does not, and docked under      */
/*      EVERY view rather than one. There is no form left to fold into there,  */
/*      so every drafted row goes through the `DraftList` tick-and-Add below.  */
/*                                                                            */
/*  THE PANEL HOST EXISTS BECAUSE THE UPLOAD HAD EXACTLY ONE DOOR. Two         */
/*  ordinary paths missed it. Someone who finished setup had no way back to it */
/*  at all. And someone PARTWAY THROUGH setup when this step was inserted      */
/*  resumed at their saved `resume_step`, which is a later horizon, so the     */
/*  flow jumped straight over a step that did not exist when they started.     */
/*  The dock is that argument finished: no view is a door the upload lacks.    */
/*                                                                            */
/*  NOTHING IS CREATED WITHOUT BEING SHOWN FIRST, in either host. Drafting     */
/*  runs on upload because drafting creates nothing: it fills a form the user  */
/*  then walks through screen by screen, and rows that cannot be filled into a */
/*  screen are displayed as ticked lines that only land when a button is       */
/*  pressed. Every row is on a screen before it is real (N5).                  */
/* -------------------------------------------------------------------------- */

/** The upload itself.
 *
 *  OPTIONAL IS THE DESIGN: skipping this is a complete answer, the copy says
 *  so, and nothing later refers back to it with a should-have. Only the
 *  EXTRACTED TEXT is stored, never the file; an unreadable file is kept as
 *  `extraction_failed` and said plainly, so the user knows the fill had
 *  nothing to read rather than wondering why nothing appeared. */
export function DocumentUpload({
  docs,
  onUploaded,
  children,
}: {
  docs: LifeSetupDocument[];
  onUploaded: (doc: LifeSetupDocument) => void;
  /** What happened after the upload, rendered under the document card. The
   *  hosts say different things: setup reports what it filled in, the panel
   *  reports what is waiting to be ticked. */
  children?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    setFailed(false);
    try {
      onUploaded(await uploadSetupDocument(file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {SETUP.documentHint}
      </p>

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
        className={`rounded-2xl border border-dashed px-4 py-8 text-center transition ${
          dragOver ? "border-foreground/40 bg-muted/40" : "border-border"
        }`}
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="mx-auto flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40"
        >
          <FileText className="h-4 w-4" />
          {busy ? SETUP.documentUploading : SETUP.documentBrowseLabel}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
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

      {failed ? (
        <p className="text-sm text-muted-foreground">
          {SETUP.documentUploadError}
        </p>
      ) : null}

      {docs.map((doc) => (
        <PanelCard key={doc.id}>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {doc.fileName}
              </p>
              {doc.status === "processed" ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {doc.charCount.toLocaleString("en-GB")}{" "}
                  {SETUP.documentCharsSuffix}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {SETUP.documentFailedNote}
                </p>
              )}
            </div>
          </div>
        </PanelCard>
      ))}

      {children}
    </div>
  );
}

/** The rows that could not be filled into a screen, as checkable lines.
 *
 *  Default-checked is allowed precisely because every row is fully displayed
 *  here first, so the default never bypasses the display (N5). `note` is
 *  passed rather than read from copy: the hosts create these at different
 *  moments (Finish in setup, an Add button in the panel), and each has to name
 *  its own or one of them is lying about when something lands. */
export function DraftList({
  draft,
  onDraft,
  disabled,
  note,
}: {
  draft: LifeDraftItem[];
  onDraft: (items: LifeDraftItem[]) => void;
  disabled: boolean;
  note: string;
}) {
  // The four the setup fold knows about lead, in that order, because that is
  // the order the screens after the upload ask for them in. Anything else the
  // drafter hands back (a phrase, a principle) follows in the order it
  // arrived, rather than being dropped by a hardcoded list that predates it.
  const leading: string[] = ["bet", "goal", "habit", "distraction"];
  const kinds = [
    ...leading.filter((k) => draft.some((d) => d.kind === k)),
    ...draft.map((d) => d.kind).filter((k) => !leading.includes(k)),
  ].filter((k, i, all) => all.indexOf(k) === i);

  function update(item: LifeDraftItem, patch: Partial<LifeDraftItem>) {
    onDraft(draft.map((d) => (d === item ? { ...d, ...patch } : d)));
  }

  /** Edit a TRUNCATION PAIR as the one text it actually is, and keep the two
   *  fields consistent afterwards.
   *
   *  Re-applying the backend's own split (cut at `titleCut`) rather than
   *  sending the edited text as a bare title is what makes an UNTOUCHED row
   *  round-trip byte-identically: title back to exactly the opening the server
   *  sent, body back to exactly the line. And an edit that brings the text
   *  under the cut collapses the pair, because a short line has no second half
   *  to carry. */
  function updateText(item: LifeDraftItem, text: string) {
    const cut = item.titleCut ?? text.length;
    update(
      item,
      text.length > cut
        ? { title: text.slice(0, cut), body: text }
        : { title: text, body: "" }
    );
  }

  return (
    <div className="mt-8 border-t border-border pt-6">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {SETUP.draftReviewTitle}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>

      {draft.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{SETUP.draftEmpty}</p>
      ) : (
        kinds.map((kind) => {
          const rows = draft.filter((d) => d.kind === kind);
          if (rows.length === 0) return null;
          return (
            <div key={kind} className="mt-4">
              <p className="text-xs font-medium text-foreground">
                {SETUP.draftKindLabels[kind] ?? kind}
              </p>
              <ul className="mt-2 space-y-2">
                {rows.map((item, i) => {
                  // A pair edits as one long text; anything else keeps the
                  // single-line field it has always had.
                  const paired = item.titleCut !== null;
                  const fieldClass = `min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/30 ${
                    item.checked ? "" : "text-muted-foreground"
                  }`;
                  return (
                    <li
                      key={`${kind}-${item.externalId ?? i}`}
                      className="flex items-start gap-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        disabled={disabled}
                        onChange={(e) =>
                          update(item, { checked: e.target.checked })
                        }
                        className="mt-2 h-4 w-4 shrink-0 accent-foreground"
                        aria-label={`Create ${item.title}`}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {paired ? (
                          <textarea
                            value={item.body}
                            rows={3}
                            disabled={disabled}
                            onChange={(e) => updateText(item, e.target.value)}
                            className={`${fieldClass} resize-y leading-relaxed`}
                          />
                        ) : (
                          <input
                            value={item.title}
                            disabled={disabled}
                            onChange={(e) =>
                              update(item, { title: e.target.value })
                            }
                            className={fieldClass}
                          />
                        )}
                        {/* An ordinary row's body is a DESCRIPTION, and it is
                            created with the row, so it is shown. Read-only:
                            the document wrote it, and the title is the line
                            the user came here to correct. */}
                        {!paired && item.body ? (
                          <p className="px-3 text-xs leading-relaxed text-muted-foreground">
                            {item.body}
                          </p>
                        ) : null}
                      </div>
                      {item.dueLabel ? (
                        <span className="mt-2 shrink-0 text-xs text-muted-foreground">
                          {item.dueLabel}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  The third host, `StrategyDocumentPanel`, is gone (founder 2026-07-31).      */
/*                                                                            */
/*  It existed to keep the upload open after setup, at the foot of Goals, and  */
/*  that job now belongs to `PanelUpload`: the same upload, the same draft and */
/*  the same tick-and-Add, docked under EVERY view instead of one. Leaving     */
/*  both would have put two uploads on the Goals screen doing the same thing,  */
/*  which is the confusion this file's header warns about in the other         */
/*  direction (two Uploads meaning DIFFERENT things, on Strategy).             */
/*                                                                            */
/*  `DocumentUpload` and `DraftList` above are still the shared pieces: setup  */
/*  mounts both, and the dock mounts `DraftList`.                              */
/* -------------------------------------------------------------------------- */

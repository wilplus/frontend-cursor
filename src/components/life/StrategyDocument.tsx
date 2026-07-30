"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { SETUP } from "@/lib/life/copy";
import {
  applyConfirmedItems,
  fetchSetupDocuments,
  proposeFromDocument,
  uploadSetupDocument,
  type LifeDraftItem,
  type LifeSetupDocument,
} from "@/services/api/life";
import { invalidateLifeState } from "@/lib/life/useLifeState";
import { Eyebrow, PanelCard } from "./primitives";

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
/*    · setup (SetupFlow) — upload on step 2. Goals fold forward into the      */
/*      eight horizon screens (see lib/life/documentFold); everything that     */
/*      cannot fold is reviewed as checkable rows on the last screen and       */
/*      created on Finish.                                                    */
/*    · the panel (/panel/goals) — the same upload, kept open afterwards       */
/*      because setup runs once and a strategy does not. There is no form left */
/*      to fold into here, so every drafted row goes through the tick-and-Add  */
/*      review instead.                                                       */
/*                                                                            */
/*  THE PANEL HOST EXISTS BECAUSE THE UPLOAD HAD EXACTLY ONE DOOR. Two         */
/*  ordinary paths missed it. Someone who finished setup had no way back to it */
/*  at all. And someone PARTWAY THROUGH setup when this step was inserted      */
/*  resumed at their saved `resume_step`, which is a later horizon, so the     */
/*  flow jumped straight over a step that did not exist when they started.     */
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
  const kinds: Array<LifeDraftItem["kind"]> = [
    "bet",
    "goal",
    "habit",
    "distraction",
  ];

  function update(item: LifeDraftItem, patch: Partial<LifeDraftItem>) {
    onDraft(draft.map((d) => (d === item ? { ...d, ...patch } : d)));
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
                {SETUP.draftKindLabels[kind]}
              </p>
              <ul className="mt-2 space-y-2">
                {rows.map((item, i) => (
                  <li
                    key={`${kind}-${item.externalId ?? i}`}
                    className="flex items-center gap-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={disabled}
                      onChange={(e) =>
                        update(item, { checked: e.target.checked })
                      }
                      className="h-4 w-4 shrink-0 accent-foreground"
                      aria-label={`Create ${item.title}`}
                    />
                    <input
                      value={item.title}
                      disabled={disabled}
                      onChange={(e) => update(item, { title: e.target.value })}
                      className={`min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/30 ${
                        item.checked ? "" : "text-muted-foreground"
                      }`}
                    />
                    {item.dueLabel ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.dueLabel}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------- panel host -------------------------------- */

/** The same upload, still open after setup, on /panel/goals.
 *
 *  The Add button is this host's reason to exist: setup creates the ticked
 *  rows as part of Finish, and there is no Finish here, so the create step has
 *  to be its own explicit press. It sends only ticked rows, exactly like
 *  Finish does. */
export default function StrategyDocumentPanel({
  onApplied,
}: {
  /** The host view reloads itself: the rows created here are its own content,
   *  so the list the user is looking at is now out of date. */
  onApplied: () => void;
}) {
  const [docs, setDocs] = useState<LifeSetupDocument[]>([]);
  const [draft, setDraft] = useState<LifeDraftItem[] | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftFailed, setDraftFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // A read failure degrades to "no document yet", never an error screen: the
    // upload is optional, so a broken list must not be allowed to hide the
    // affordance that is the point of this section.
    void fetchSetupDocuments()
      .then((list) => {
        if (!cancelled) setDocs(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const runDraft = useCallback(async () => {
    setDrafting(true);
    setDraftFailed(false);
    setApplied(false);
    try {
      setDraft(await proposeFromDocument());
    } catch {
      setDraftFailed(true);
    } finally {
      setDrafting(false);
    }
  }, []);

  const ticked = (draft ?? []).filter(
    (d) => d.checked && d.title.trim() !== ""
  ).length;

  const apply = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setFailed(false);
    try {
      await applyConfirmedItems(draft);
      setApplied(true);
      // Drop the reviewed rows rather than leave them on screen: they exist
      // now, and a second press of the same list would create them twice.
      setDraft(null);
      invalidateLifeState();
      onApplied();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [draft, onApplied]);

  const hasReadable = docs.some((d) => d.status === "processed");

  return (
    <section className="mt-12 border-t border-border pt-8">
      <Eyebrow>{SETUP.documentPanelTitle}</Eyebrow>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        {SETUP.documentPanelLede}
      </p>

      <DocumentUpload
        docs={docs}
        onUploaded={(doc) => {
          setDocs((prev) => [doc, ...prev]);
          // A new document invalidates the previous draft: those rows were
          // read out of a different file, and leaving them under a fresh
          // upload would attribute them to it.
          setDraft(null);
          setApplied(false);
          if (doc.status === "processed") void runDraft();
        }}
      >
        {drafting ? (
          <p className="text-sm text-muted-foreground">{SETUP.draftWorking}</p>
        ) : null}
        {draftFailed ? (
          <p className="text-sm text-muted-foreground">{SETUP.draftFailed}</p>
        ) : null}
        {/* A document uploaded in an earlier visit has no draft in memory, so
            the button is how that person reaches one. Hidden while a draft is
            on screen: re-reading the same file would throw away their ticks. */}
        {hasReadable && !drafting && draft === null ? (
          <button
            type="button"
            onClick={() => void runDraft()}
            className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            {SETUP.draftButton}
          </button>
        ) : null}
      </DocumentUpload>

      {draft !== null ? (
        <>
          <DraftList
            draft={draft}
            onDraft={setDraft}
            disabled={busy}
            note={SETUP.draftPanelNote}
          />
          {draft.length > 0 ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => void apply()}
                disabled={busy || ticked === 0}
                className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-40"
              >
                {busy ? SETUP.draftApplyWorking : SETUP.draftApplyLabel}
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
        <p className="mt-4 text-sm text-foreground">{SETUP.draftApplied}</p>
      ) : null}
      {failed ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {SETUP.draftApplyFailed}
        </p>
      ) : null}
    </section>
  );
}

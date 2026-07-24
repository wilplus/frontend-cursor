"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import {
  fetchContextDocument,
  uploadContextDocument,
  type ContextDocumentStatus,
} from "@/services/api/contextDocument";

/* -------------------------------------------------------------------------- */
/*  ContextDocumentInput (X-1) — attach a background document at setup.         */
/*                                                                            */
/*  Upload a PDF or text/markdown file (≤20 pages) that shapes the coaching as  */
/*  BACKGROUND — never quoted back, never injected as facts. Shows the current  */
/*  document as a chip (filename / pages / "first 20 pages used" when the BE     */
/*  truncated) with a replace action. Needs an arc id, so the host only mounts   */
/*  it once the project exists; a failed upload is never fatal.                 */
/* -------------------------------------------------------------------------- */

const ACCEPT = ".pdf,.txt,.md,text/plain,text/markdown,application/pdf";

export default function ContextDocumentInput({ arcId }: { arcId: string }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<ContextDocumentStatus | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Once the user uploads, the fresh POST result is authoritative. Latch it so a
  // slow mount GET that resolves *after* the upload can't clobber the new chip
  // with the pre-upload status (arcId is stable, so the GET is a one-shot).
  const userActedRef = useRef(false);

  useEffect(() => {
    let active = true;
    void fetchContextDocument(arcId).then((s) => {
      if (active && !userActedRef.current) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    userActedRef.current = true;
    setUploadState("uploading");
    setErrorMsg(null);
    const r = await uploadContextDocument(arcId, file);
    if (r.ok) {
      setStatus({
        hasDocument: true,
        pages: r.pages,
        chars: r.chars,
        truncated: r.truncated,
        filename: file.name,
      });
      setUploadState("idle");
    } else {
      setErrorMsg(r.message);
      setUploadState("error");
    }
  }

  const has = status?.hasDocument === true;
  const pages = status?.pages ?? null;

  return (
    <div>
      <p className="-mt-1 mb-4 text-[13px] leading-relaxed text-muted-foreground">
        Attach a brief, notes, or a paper (PDF or text, up to 20 pages). It gives
        your coach context in the background. It&apos;s never quoted back to you.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadState === "uploading"}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[14px] transition hover:bg-muted active:scale-[0.98] disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploadState === "uploading"
            ? "Reading your document…"
            : has
              ? "Replace document"
              : "Attach a context document"}
        </button>
        {has ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="max-w-[14rem] truncate">
              {status?.filename ?? "Document attached"}
            </span>
            {pages != null ? (
              <span className="tabular-nums">
                · {pages} {pages === 1 ? "page" : "pages"}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {errorMsg ? (
        <p className="mt-2 text-[12px] text-destructive">{errorMsg}</p>
      ) : null}
      {has && status?.truncated ? (
        <p className="mt-2 text-[12px] text-muted-foreground">
          That document was long, so the first 20 pages were used.
        </p>
      ) : null}
    </div>
  );
}

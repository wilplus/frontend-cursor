"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { extractPresentation } from "@/services/api/presentationExtract";
import {
  ACCEPTED_DECK_ACCEPT,
  type PresentationSlide,
} from "./presentation";

/* -------------------------------------------------------------------------- */
/*  PresentationInput — capture the deck in the recording setup (T4).          */
/*                                                                            */
/*  A PURELY BINARY SCREEN (founder 2026-08-14): the upload space and          */
/*  nothing else. The per-slide editors — title inputs, body textareas,        */
/*  add/remove slide — are DELETED, not hidden: the deck's text comes from     */
/*  the uploaded PDF (the BE parses it), and hand-typed slide text was a       */
/*  second author of deck truth beside the parser. Proceed/Skip live in the    */
/*  parent wizard's footer; this component is the dropzone, the attached       */
/*  state, and the errors. Controlled — the parent owns slides + ref.          */
/* -------------------------------------------------------------------------- */

export default function PresentationInput({
  slides,
  presentationRef,
  onChange,
}: {
  slides: PresentationSlide[];
  presentationRef: string | null;
  onChange: (slides: PresentationSlide[], presentationRef: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  async function takeFile(file: File | undefined | null) {
    if (!file) return;
    setUploadState("uploading");
    setErrorMsg(null);
    setWarnings([]);
    const result = await extractPresentation(file);
    if (result.status === "ok") {
      const next = result.deck.slides.length > 0 ? result.deck.slides : slides;
      onChange(next, result.deck.presentationRef);
      setWarnings(result.deck.warnings);
      setUploadState("idle");
    } else {
      setErrorMsg(result.message);
      setUploadState("error");
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    void takeFile(file);
  }

  function clearDeck() {
    setWarnings([]);
    onChange([], null);
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_DECK_ACCEPT}
        onChange={handleFile}
        className="hidden"
      />
      {/* THE DROPZONE — the whole upload space is the target. */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploadState === "uploading"}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void takeFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex min-h-[9.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 text-center transition disabled:opacity-60 ${
          dragOver
            ? "border-foreground/60 bg-muted"
            : "border-border hover:bg-muted"
        }`}
      >
        <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
        <span className="text-[14px] text-foreground">
          {uploadState === "uploading"
            ? "Reading your deck…"
            : presentationRef
              ? "Replace deck"
              : "Upload your deck (PDF)"}
        </span>
      </button>

      {presentationRef ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground">
          Deck attached
          <button
            type="button"
            onClick={clearDeck}
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            remove
          </button>
        </p>
      ) : null}
      {errorMsg ? (
        <p className="mt-2 text-[12px] text-destructive">{errorMsg}</p>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-0.5 text-[12px] text-muted-foreground">
          {warnings.map((w, i) => (
            <li key={`${i}-${w.slice(0, 12)}`}>• {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

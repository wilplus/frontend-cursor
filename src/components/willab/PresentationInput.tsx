"use client";

import { useRef, useState } from "react";
import { CircleCheck, Upload } from "lucide-react";
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
        {/* Once a deck is attached the upload arrow gives way to a check and
            the box reads "Deck attached" — tapping it still replaces it. */}
        {presentationRef && uploadState !== "uploading" ? (
          <CircleCheck className="h-6 w-6 text-foreground" aria-label="Deck attached" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
        )}
        <span className="text-[14px] text-foreground">
          {uploadState === "uploading"
            ? "Reading your deck…"
            : presentationRef
              ? "Deck attached"
              : "Upload your deck (PDF)"}
        </span>
      </button>

      {presentationRef ? (
        // The box says "Deck attached"; the one move under it is replacing
        // the deck (founder 2026-09-24: no remove). Sized like the deck
        // modal's grey footer link: 16px at 48px.
        <div className="mt-3 flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadState === "uploading"}
            className="flex min-h-[48px] items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            Replace the deck
          </button>
        </div>
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

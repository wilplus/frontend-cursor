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
        {/* Once a deck is attached the upload arrow gives way to a check —
            the box still replaces the deck on tap. */}
        {presentationRef && uploadState !== "uploading" ? (
          <CircleCheck className="h-6 w-6 text-foreground" aria-label="Deck attached" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
        )}
        <span className="text-[14px] text-foreground">
          {uploadState === "uploading"
            ? "Reading your deck…"
            : presentationRef
              ? "Replace deck"
              : "Upload your deck (PDF)"}
        </span>
      </button>

      {presentationRef ? (
        // Sized like the deck modal's footer pair (black pill + grey link):
        // 16px semibold at the pill's 54px, 16px grey at the link's 48px,
        // stacked with the same tight gap.
        <div className="mt-3 flex flex-col items-center gap-0.5">
          <p className="flex min-h-[54px] items-center justify-center text-[16px] font-semibold text-foreground">
            Deck attached
          </p>
          <button
            type="button"
            onClick={clearDeck}
            className="flex min-h-[48px] items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground"
          >
            remove
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

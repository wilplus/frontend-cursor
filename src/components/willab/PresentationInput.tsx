"use client";

import { useRef, useState } from "react";
import { Plus, Upload, X } from "lucide-react";
import { extractPresentation } from "@/services/api/presentationExtract";
import {
  ACCEPTED_DECK_ACCEPT,
  SLIDE_CAPS,
  emptySlide,
  type PresentationSlide,
} from "./presentation";

/* -------------------------------------------------------------------------- */
/*  PresentationInput — capture the deck in the recording setup (T4)            */
/*                                                                            */
/*  Rendered inside the setup page's "Your slides" Field (the label lives in    */
/*  the Field). Upload a PDF (the BE parses → fills the blocks + attaches the    */
/*  served PDF via presentationRef) OR type the slides by hand (opens with 5     */
/*  blocks). Optional; a failed upload degrades to manual entry. Controlled —    */
/*  the parent owns slides + ref.                                               */
/* -------------------------------------------------------------------------- */

const CARD_INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3.5 text-[14px] placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition";

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

  function updateSlide(i: number, patch: Partial<PresentationSlide>) {
    onChange(
      slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
      presentationRef
    );
  }
  function removeSlide(i: number) {
    onChange(
      slides.filter((_, idx) => idx !== i),
      presentationRef
    );
  }
  function addSlide() {
    if (slides.length >= SLIDE_CAPS.maxSlides) return;
    onChange([...slides, emptySlide()], presentationRef);
  }
  function clearDeck() {
    setWarnings([]);
    onChange(slides, null); // keep the (now editable) text; drop the PDF link
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
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

  return (
    <div>
      <p className="-mt-1 mb-4 text-[13px] leading-relaxed text-muted-foreground">
        Adding slides will make a truly incredibly valuable experience! Promise.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_DECK_ACCEPT}
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
            ? "Reading your deck…"
            : presentationRef
              ? "Replace deck"
              : "Upload your deck (PDF)"}
        </button>
        {presentationRef ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            Deck attached
            <button
              type="button"
              onClick={clearDeck}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              remove
            </button>
          </span>
        ) : null}
      </div>
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

      <div className="mt-4 space-y-3">
        {slides.map((s, i) => (
          <div
            key={i}
            className="space-y-2.5 rounded-xl border border-border p-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-foreground/70">
                Slide {i + 1}
              </span>
              {slides.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeSlide(i)}
                  aria-label={`Remove slide ${i + 1}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <input
              value={s.title}
              onChange={(e) => updateSlide(i, { title: e.target.value })}
              maxLength={SLIDE_CAPS.maxTitle}
              placeholder="Slide title"
              className={`h-11 ${CARD_INPUT_CLS}`}
            />
            <textarea
              value={s.body}
              onChange={(e) => updateSlide(i, { body: e.target.value })}
              maxLength={SLIDE_CAPS.maxBody}
              placeholder="Bullet points, one per line"
              rows={3}
              className={`resize-none py-2.5 ${CARD_INPUT_CLS}`}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSlide}
        disabled={slides.length >= SLIDE_CAPS.maxSlides}
        className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-[13px] text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" /> Add slide
      </button>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
/*  Two ways into one `slides[]`: upload a .pptx/.pdf (the BE parses → fills    */
/*  the blocks + attaches the served PDF via presentationRef) OR type the       */
/*  slides by hand (opens with 5 blocks). Fully optional; a failed upload       */
/*  degrades to manual entry. Controlled — the parent owns slides+ref.          */
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
      const next =
        result.deck.slides.length > 0 ? result.deck.slides : slides;
      onChange(next, result.deck.presentationRef);
      setWarnings(result.deck.warnings);
      setUploadState("idle");
    } else {
      setErrorMsg(result.message);
      setUploadState("error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="text-[13px] font-medium text-foreground">
          Your slides{" "}
          <span className="text-muted-foreground">(optional)</span>
        </span>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Training without slides works. Adding them sharpens the read on how
          your delivery lands against each slide. PowerPoint? Export it to PDF
          first.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_DECK_ACCEPT}
          onChange={handleFile}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploadState === "uploading"}
          className="rounded-full"
        >
          {uploadState === "uploading"
            ? "Reading your deck…"
            : presentationRef
              ? "Replace deck"
              : "Upload your deck (PDF)"}
        </Button>
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
        <p className="text-[12px] text-destructive">{errorMsg}</p>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-[12px] text-muted-foreground">
          {warnings.map((w, i) => (
            <li key={`${i}-${w.slice(0, 12)}`}>• {w}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-3">
        {slides.map((s, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-background p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-muted-foreground">
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
              className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] outline-none focus:border-primary"
            />
            <textarea
              value={s.body}
              onChange={(e) => updateSlide(i, { body: e.target.value })}
              maxLength={SLIDE_CAPS.maxBody}
              placeholder="Bullet points, one per line"
              rows={3}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[14px] outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSlide}
        disabled={slides.length >= SLIDE_CAPS.maxSlides}
        className="self-start rounded-full border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
      >
        + Add slide
      </button>
    </div>
  );
}

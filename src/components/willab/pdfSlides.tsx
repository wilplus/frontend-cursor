"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { bulletLines } from "./presentation";

/* -------------------------------------------------------------------------- */
/*  pdfSlides — client-only rendering of the deck (T0)                          */
/*                                                                            */
/*  The FE renders the BE-served PDF (presentation_ref) via PDF.js — page index */
/*  = slide index. It NEVER parses the raw upload (the BE converts pptx/pdf →    */
/*  one PDF). pdfjs is imported dynamically (client-only, never SSR'd → no node  */
/*  `canvas` bundling) and its worker is copied from the installed package and   */
/*  served same-origin (workers can't load cross-origin, so a CDN workerSrc      */
/*  silently degrades to main-thread rendering). ANY failure (CORS, network,     */
/*  corrupt) shows an explicit retryable visual error. Spoken/transcribed text   */
/*  is never substituted for the slide image.                                   */
/* -------------------------------------------------------------------------- */

type PdfDoc = PDFDocumentProxy;

// One in-flight/loaded promise per url (the report renders many pages off one
// doc). Failures are evicted so a later retry can re-attempt.
const docCache = new Map<string, Promise<PdfDoc>>();

function loadPdf(url: string): Promise<PdfDoc> {
  let p = docCache.get(url);
  if (!p) {
    p = (async () => {
      const pdfjs = await import("pdfjs-dist");
      // Same-origin worker copied from the installed package by
      // scripts/copy-pdf-worker.mjs (postinstall) — always version-matched;
      // ?v= busts browser caches when pdfjs-dist upgrades.
      pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${pdfjs.version}`;
      return pdfjs.getDocument({ url }).promise;
    })();
    docCache.set(url, p);
    void p.catch(() => docCache.delete(url));
  }
  return p;
}

function usePdfDocument(url: string | null): {
  doc: PdfDoc | null;
  status: "loading" | "ready" | "error";
} {
  const [state, setState] = useState<{
    doc: PdfDoc | null;
    status: "loading" | "ready" | "error";
  }>({ doc: null, status: url ? "loading" : "error" });

  useEffect(() => {
    if (!url) {
      setState({ doc: null, status: "error" });
      return;
    }
    let active = true;
    setState({ doc: null, status: "loading" });
    loadPdf(url).then(
      (doc) => active && setState({ doc, status: "ready" }),
      () => active && setState({ doc: null, status: "error" })
    );
    return () => {
      active = false;
    };
  }, [url]);

  return state;
}

/** The deck's page count, or null while loading / on failure / without a url.
 *  Rides the same cached document promise the pages render from, so by the
 *  time a page could draw the count has already resolved — gating a layout on
 *  it costs no extra fetch and no extra wait. */
export function useDeckPageCount(url: string | null): number | null {
  const { doc } = usePdfDocument(url);
  return doc ? doc.numPages : null;
}

/** Render one PDF page (0-based `pageIndex`) to a canvas scaled to the container
 *  width. Calls `onError` on any failure so the parent falls back to text. */
export function PdfPage({
  url,
  pageIndex,
  onError,
  className,
  fit = false,
}: {
  url: string;
  pageIndex: number;
  onError?: () => void;
  className?: string;
  /** Fit the complete page inside a fixed visual slot without cropping. */
  fit?: boolean;
}) {
  const { doc, status } = usePdfDocument(url);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (status === "error") onError?.();
  }, [status, onError]);

  useEffect(() => {
    if (status !== "ready" || !doc) return;
    let cancelled = false;
    setRendered(false);
    void (async () => {
      try {
        const pageNum = pageIndex + 1;
        if (pageNum < 1 || pageNum > doc.numPages) {
          throw new Error("requested slide is outside the uploaded deck");
        }
        const page = await doc.getPage(pageNum);
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap || cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const targetW = wrap.clientWidth || 320;
        const viewport = page.getViewport({ scale: targetW / base.width });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setRendered(true);
      } catch {
        if (!cancelled) onError?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, doc, pageIndex, onError]);

  return (
    <div ref={wrapRef} className={`${fit ? "h-full" : ""} ${className ?? ""}`}>
      {!rendered && status !== "error" ? (
        <div className="flex h-full w-full items-center justify-center text-[12px] text-muted-foreground">
          Loading slide…
        </div>
      ) : null}
      {status === "error" ? (
        <div className="flex h-full w-full items-center justify-center text-[12px] text-muted-foreground">
          Slide preview unavailable
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className={`mx-auto rounded-lg ${
          fit ? "h-full w-full object-contain" : "h-auto max-w-full"
        } ${rendered ? "" : "hidden"}`}
      />
    </div>
  );
}

/** The one visual treatment for the canonical deckless presentation.
 *  Generated artwork supplies the photographic/editorial layer; live HTML
 *  supplies exact, readable text, so the slide can look real without ever
 *  inheriting image-generation spelling errors. */
export function MockPresentationSlide({
  artworkSrc,
  title,
  body,
}: {
  artworkSrc: string;
  title: string;
  body: string;
}) {
  const bullets = bulletLines(body);
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#061a3a] bg-cover bg-center"
      style={{ backgroundImage: `url(${artworkSrc})` }}
      role="img"
      aria-label={`${title}. ${bullets.join(" ")}`.trim()}
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,19,45,0.98)_0%,rgba(3,19,45,0.86)_35%,rgba(3,19,45,0.12)_66%,rgba(3,19,45,0)_100%)]" />
      <div className="absolute inset-y-0 left-0 flex w-[56%] flex-col justify-center px-[6%] py-[5%] text-white">
        <span className="mb-[5%] h-1 w-[18%] rounded-full bg-primary" />
        <h3 className="text-[clamp(1rem,3vw,2.2rem)] font-semibold leading-[1.05] tracking-[-0.025em]">
          {title}
        </h3>
        {bullets.length > 0 ? (
          <ul className="mt-[6%] flex flex-col gap-[0.45em] text-[clamp(0.58rem,1.25vw,1rem)] leading-[1.35] text-white/90">
            {bullets.map((line) => (
              <li key={line} className="flex gap-[0.6em]">
                <span
                  aria-hidden="true"
                  className="mt-[0.55em] size-1 shrink-0 rounded-full bg-primary"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** What a viewer shows for one slide: the rendered PDF page when a deck PDF is
 *  present, or the canonical artwork for a deckless presentation.
 *
 *  A transcript is never a slide image. If the visual is unavailable we keep
 *  that absence explicit and retryable instead of silently substituting the
 *  words spoken while the slide was on screen. */
export function SlideRender({
  presentationRef,
  pageIndex,
  title,
  body,
  artworkSrc,
  className,
  showRetry = true,
  fit = false,
}: {
  presentationRef: string | null;
  pageIndex: number;
  title: string;
  body: string;
  artworkSrc?: string;
  className?: string;
  showRetry?: boolean;
  fit?: boolean;
}) {
  const [pdfFailed, setPdfFailed] = useState(false);
  const handleError = useCallback(() => setPdfFailed(true), []);
  // A new deck source gets a fresh chance to render.
  useEffect(() => setPdfFailed(false), [presentationRef]);

  if (presentationRef && !pdfFailed) {
    return (
      <PdfPage
        url={presentationRef}
        pageIndex={pageIndex}
        onError={handleError}
        className={className}
        fit={fit}
      />
    );
  }
  if (!presentationRef && artworkSrc) {
    return (
      <div className={className}>
        <MockPresentationSlide
          artworkSrc={artworkSrc}
          title={title}
          body={body}
        />
      </div>
    );
  }
  return (
    <div className={className}>
      <div className="flex aspect-video h-full w-full items-center justify-center rounded-xl border border-border bg-muted text-[13px] text-muted-foreground">
        Slide preview unavailable
      </div>
      {/* Clearing pdfFailed remounts PdfPage, and loadPdf evicts the failed
          promise on error, so retry really re-fetches the visual. */}
      {presentationRef && pdfFailed && showRetry ? (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setPdfFailed(false)}
            className="rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Retry loading slides
          </button>
        </div>
      ) : null}
    </div>
  );
}

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
/*  corrupt) degrades to the text card: the rendered deck is an enhancement      */
/*  over a guaranteed text floor.                                               */
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
        const pageNum = Math.min(Math.max(pageIndex + 1, 1), doc.numPages || 1);
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

/** Text-card slide: title + newline bullets. The manual path AND the PDF
 *  fallback — so the deck always has a text floor. */
export function TextSlide({ title, body }: { title: string; body: string }) {
  const bullets = bulletLines(body);
  const blank = title.trim() === "" && bullets.length === 0;
  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-y-auto rounded-xl border border-gray-200 bg-white p-5">
      {title ? (
        <p className="text-[18px] font-semibold leading-snug text-gray-900">
          {title}
        </p>
      ) : null}
      {bullets.length > 0 ? (
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-gray-900 marker:text-[0.8em] marker:text-primary">
          {bullets.map((b, i) => (
            <li key={`${i}-${b.slice(0, 12)}`}>{b}</li>
          ))}
        </ul>
      ) : null}
      {blank ? (
        <p className="m-auto text-[13px] text-gray-400">Blank slide</p>
      ) : null}
    </div>
  );
}

/** What a viewer shows for one slide: the rendered PDF page when a deck PDF is
 *  present (and renders), otherwise the text card. PDF failure → text. */
export function SlideRender({
  presentationRef,
  pageIndex,
  title,
  body,
  className,
  showRetry = true,
  fit = false,
}: {
  presentationRef: string | null;
  pageIndex: number;
  title: string;
  body: string;
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
  return (
    <div className={className}>
      <TextSlide title={title} body={body} />
      {/* FE-1 — the deck already degrades to this text floor, so the user is
          never blocked; when a served PDF failed to load (404 / CORS / network)
          offer a retry. Clearing pdfFailed remounts PdfPage, and loadPdf evicts
          the failed promise on error, so this actually re-fetches. */}
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

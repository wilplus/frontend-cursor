/* -------------------------------------------------------------------------- */
/*  presentation — slide-deck context (what the slide CLAIMED)                  */
/*                                                                            */
/*  Per-session deck: each slide is { title, body } with body a single string  */
/*  (newlines = bullets, the BE-canonical wire shape). Typed manually or auto-  */
/*  extracted from an uploaded PPTX/PDF (the BE converts the file to ONE served  */
/*  PDF + returns the per-slide text). The deck rides the recording multipart   */
/*  so the analysis can judge spoken delivery against the slide's promise. It's  */
/*  the user's own input — echoed back, never a verdict. Optional throughout.   */
/* -------------------------------------------------------------------------- */

export interface PresentationSlide {
  title: string;
  /** Body as one string; newlines are bullet breaks (wire contract: body:string). */
  body: string;
  /** Render-only artwork for the canonical deckless mock. It is deliberately
   *  stripped at the upload boundary: the backend slide contract remains
   *  exactly `{ title, body }`, while every UI can render the same real slide. */
  artworkSrc?: string;
}

/** BE-enforced caps; the FE mirrors them as the first line (BE is the backstop). */
export const SLIDE_CAPS = {
  maxSlides: 60,
  maxTitle: 200,
  maxBody: 2000,
  maxFileBytes: 20 * 1024 * 1024,
} as const;

// PDF only for now: the BE doesn't convert decks; PPTX returns a 415 ("export
// to PDF"). Narrowed so the picker never offers a dead-end type.
export const ACCEPTED_DECK_EXTENSIONS = [".pdf"] as const;
/** `accept` attribute for the file input (extension + MIME type). */
export const ACCEPTED_DECK_ACCEPT = ".pdf,application/pdf";

export function emptySlide(): PresentationSlide {
  return { title: "", body: "" };
}

/** The manual form opens with 5 empty slide blocks (founder spec). */
export function initialSlides(): PresentationSlide[] {
  return Array.from({ length: 5 }, emptySlide);
}

function clampSlide(s: PresentationSlide): PresentationSlide {
  return {
    title: s.title.slice(0, SLIDE_CAPS.maxTitle),
    body: s.body.slice(0, SLIDE_CAPS.maxBody),
  };
}

/** Drop rows blank in BOTH title and body, clamp to caps, cap the count. The
 *  submit-boundary filter — empty trailing blocks never reach the wire. */
export function nonEmptySlides(slides: PresentationSlide[]): PresentationSlide[] {
  return slides
    .filter((s) => s.title.trim() !== "" || s.body.trim() !== "")
    .slice(0, SLIDE_CAPS.maxSlides)
    .map(clampSlide);
}

/** Clamp + cap WITHOUT dropping blanks — for a served-PDF deck, where each slide
 *  is a PDF PAGE. Blank-text pages must stay: the page still renders during
 *  recording, and the slide indices must line up with the tap timeline and the
 *  served PDF. (Manual entry uses nonEmptySlides, which drops empty blocks.) */
export function clampSlides(slides: PresentationSlide[]): PresentationSlide[] {
  return slides.slice(0, SLIDE_CAPS.maxSlides).map(clampSlide);
}

/** Render-only: split a body string into bullet lines (blank lines dropped). */
export function bulletLines(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Pre-upload guard. Returns a user-facing message, or null when the file is OK. */
export function deckFileError(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_DECK_EXTENSIONS.some((e) => name.endsWith(e))) {
    return "Upload a PDF. Export your slides to PDF first if they aren't already.";
  }
  if (file.size > SLIDE_CAPS.maxFileBytes) {
    return oversizeDeckMessage();
  }
  return null;
}

/** The cap in whole MB — derived from the byte cap so there's one source of
 *  truth for the pre-upload guard's copy. */
const LOCAL_LIMIT_MB = Math.round(SLIDE_CAPS.maxFileBytes / (1024 * 1024));

/** User-facing oversize copy for the pre-upload guard (uses the local cap). */
function oversizeDeckMessage(limitMb: number = LOCAL_LIMIT_MB): string {
  return `That file is over ${limitMb} MB. Try a smaller export.`;
}

/** Build the oversize message from a backend 413 body. BE (#128) returns a
 *  single-source-of-truth contract `{ code:"FILE_TOO_LARGE", error, limit_mb }`;
 *  prefer its message, else its cap. Falls back to the local cap when the 413
 *  carried no usable JSON (e.g. a platform body-size 413 from the edge — see the
 *  BFF proxy caveat), so behavior never regresses below today's copy. */
export function fileTooLargeMessage(body: unknown): string {
  const b = (body && typeof body === "object" ? body : {}) as {
    error?: unknown;
    limit_mb?: unknown;
  };
  if (typeof b.error === "string" && b.error.trim()) return b.error.trim();
  const limitMb =
    typeof b.limit_mb === "number" && b.limit_mb > 0 ? b.limit_mb : LOCAL_LIMIT_MB;
  return oversizeDeckMessage(limitMb);
}

/* ------------------------- parse-response mapping ------------------------- */

export interface ExtractedDeck {
  /** The BE-served PDF url (public, browser-fetchable). null = no file. */
  presentationRef: string | null;
  slides: PresentationSlide[];
  warnings: string[];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function mapSlide(raw: unknown): PresentationSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const slide = clampSlide({ title: str(r.title), body: str(r.body) });
  if (slide.title.trim() === "" && slide.body.trim() === "") return null;
  return slide;
}

/** Map the `POST /v2/lab/presentation/extract` response defensively. */
export function mapExtractedDeck(raw: unknown): ExtractedDeck {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // Keep one slide per BE entry, INCLUDING blank-text ones: for a served PDF
  // each entry is a PAGE, and an image-only / text-free page is still a real
  // slide (it renders from the PDF, and its index must line up with the rest).
  // Only genuinely malformed (non-object) entries are dropped. This is why a
  // 10-page deck with 2 blank pages now keeps all 10 slides, not just 8.
  const slides = Array.isArray(r.slides)
    ? r.slides
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
        .map((s) => clampSlide({ title: str(s.title), body: str(s.body) }))
        .slice(0, SLIDE_CAPS.maxSlides)
    : [];
  const warnings = Array.isArray(r.warnings)
    ? r.warnings.filter((w): w is string => typeof w === "string")
    : [];
  const ref =
    typeof r.presentation_ref === "string" && r.presentation_ref.length > 0
      ? r.presentation_ref
      : null;
  return { presentationRef: ref, slides, warnings };
}

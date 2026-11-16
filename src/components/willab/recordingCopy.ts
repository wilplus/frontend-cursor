/* -------------------------------------------------------------------------- */
/*  recordingCopy — the words the recording screens' lock added               */
/*  (founder lock 2026-10-07, N59, as amended 2026-10-12, N70).               */
/*                                                                            */
/*  ONLY THE LOCK'S WORDS live here, typed exactly as signed. Every other     */
/*  word on these screens is today's and stays where it already is ("Finish  */
/*  take", "Discard this take?", the processing wait). "Scroll down to start" */
/*  and "Click down to start" were retired with the learning screen (N70).    */
/*  recordingCopy.test.ts holds the list.                                     */
/* -------------------------------------------------------------------------- */

import { DEFAULT_DECK, isDefaultDeckText } from "@/lib/willab/defaultDeck";
import {
  normalizeUiLocale,
  storedUiLocale,
  type UiLocale,
} from "@/lib/uiLocale";

export const RECORDING_COPY = {
  /** The two buttons under the strip (N70). On the last slide Next slide
   *  becomes Finish take. */
  back: "Back",
  nextSlide: "Next slide",
  /** Before every Take, as small grey text under the voice mark (the
   *  prototype's renderMic). It was read only by screen readers until the
   *  founder signed every word a locked prototype shows (Q-B4 A, decisions
   *  log N62/N63, 2026-10-07). */
  micReady: "Getting your mic ready",
  /** On Take 1, under "Getting your mic ready", while the browser asks for
   *  the microphone: why it asks (N269's sentence; N273 item 4). */
  micWhy: "WillpowerLab uses the microphone to record your Takes.",
  /** Under "Getting your mic ready" when the last Take was recorded through
   *  earbuds or a headset (N372 item 4). */
  earbuds: "Earbuds make you sound like a phone call. The built-in mic sounds like you.",
} as const;

type RecordingScreenCopy = {
  [Key in keyof typeof RECORDING_COPY]: string;
} & {
  finishTake: string;
  take: string;
  slide: string;
  of: string;
  to: string;
  asks: string;
  speakingAnchors: string;
  slidePreviewUnavailable: string;
  retryLoadingSlides: string;
};

/**
 * Fixed recording-screen words. They follow the app locale only; the words a
 * speaker wrote or said never pass through this table.
 */
const RECORDING_SCREEN_COPY: Record<UiLocale, RecordingScreenCopy> = {
  en: {
    ...RECORDING_COPY,
    finishTake: "Finish take",
    take: "Take",
    slide: "Slide",
    of: "of",
    to: "To",
    asks: "asks",
    speakingAnchors: "Speaking anchors for slide",
    slidePreviewUnavailable: "Slide preview unavailable",
    retryLoadingSlides: "Retry loading slides",
  },
  pl: {
    back: "Wstecz",
    nextSlide: "Następny slajd",
    finishTake: "Zakończ nagranie",
    take: "Nagranie",
    slide: "Slajd",
    of: "z",
    to: "Do:",
    asks: "pyta",
    speakingAnchors: "Punkty wypowiedzi dla slajdu",
    micReady: "Przygotowujemy mikrofon",
    micWhy: "WillpowerLab używa mikrofonu do nagrywania Twoich wystąpień.",
    earbuds: "Słuchawki sprawiają, że brzmisz jak przez telefon. Wbudowany mikrofon brzmi naturalniej.",
    slidePreviewUnavailable: "Podgląd slajdu jest niedostępny",
    retryLoadingSlides: "Spróbuj ponownie wczytać slajdy",
  },
};

export type RecordingCopyKey = keyof RecordingScreenCopy;

/**
 * Read the app/system locale resolved by the existing locale foundation.
 * The persisted manual choice wins, then the server-rendered html language;
 * neither transcript nor coaching-content language is consulted.
 */
export function recordingUiLocale(): UiLocale {
  const stored = storedUiLocale();
  if (stored) return stored;
  if (typeof document === "undefined") return "en";
  return (
    normalizeUiLocale(document.documentElement.lang) ??
    normalizeUiLocale(document.documentElement.dataset.uiLocale) ??
    "en"
  );
}

export function recordingCopy(locale: UiLocale): RecordingScreenCopy {
  return RECORDING_SCREEN_COPY[locale];
}

export function recordingText(
  key: RecordingCopyKey,
  locale: UiLocale = recordingUiLocale(),
): string {
  return recordingCopy(locale)[key];
}

const DEFAULT_POSTER_COPY: Record<
  UiLocale,
  readonly { title: string; body: string }[]
> = {
  en: DEFAULT_DECK.map(({ title, body }) => ({ title, body })),
  pl: [
    { title: "Początek", body: "O czym opowiesz — w jednym zdaniu." },
    { title: "Główne punkty", body: "1\n2\n3" },
    { title: "Podsumowanie", body: "Co zostało powiedziane i co dalej." },
  ],
};

/**
 * Localise only the built-in, fixed poster. A speaker's uploaded or typed
 * slide is returned byte-for-byte unchanged, whatever the interface locale.
 */
export function recordingSlidesInLocale<
  T extends { title: string; body: string },
>(slides: readonly T[], locale: UiLocale = recordingUiLocale()): T[] {
  if (!isDefaultDeckText(slides)) return [...slides];
  return slides.map((slide, index) => {
    const fixed = DEFAULT_POSTER_COPY[locale][index];
    return fixed ? { ...slide, ...fixed } : { ...slide };
  });
}

/** The top bar's line while recording: "Take N · Slide n of m". The only
 *  numbers are the Take's and the slide's position (AC-9). The /dev harness
 *  has no Take, so it reads "Slide n of m" alone. */
export function recordingWhere(
  take: number | null,
  slideIndex: number,
  slideCount: number,
  to: string | null = null,
  locale: UiLocale = recordingUiLocale(),
): string {
  const copy = recordingCopy(locale);
  const slide = `${copy.slide} ${slideIndex + 1} ${copy.of} ${slideCount}`;
  // A question to someone: "To {name} · Slide n of m" (backend N483 item 6).
  if (to) return `${copy.to} ${to} · ${slide}`;
  return take ? `${copy.take} ${take} · ${slide}` : slide;
}

/** An answer to someone's Take, over the Take's own slides (backend N493
 *  item 1): "{name} · Slide n of m". */
export function answerWhere(
  name: string,
  slideIndex: number,
  slideCount: number,
  locale: UiLocale = recordingUiLocale(),
): string {
  const copy = recordingCopy(locale);
  return `${name} · ${copy.slide} ${slideIndex + 1} ${copy.of} ${slideCount}`;
}

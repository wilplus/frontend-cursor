import { getAuthToken } from "@/lib/api/auth-client";
import {
  deckFileError,
  fileTooLargeMessage,
  mapExtractedDeck,
  type ExtractedDeck,
} from "@/components/willab/presentation";

/* -------------------------------------------------------------------------- */
/*  presentationExtract — deck parse client (§S / T2)                           */
/*                                                                            */
/*  POST /api/v2/lab/presentation/extract (multipart file=pptx|pdf). The BE     */
/*  converts the deck to ONE served PDF and returns its url (presentation_ref)   */
/*  + per-slide title/body. Parse-and-RETURN (not store-final): the FE fills the */
/*  editable form, the user corrects, the corrected slides ride the recording   */
/*  upload. Guest-friendly (token optional, like the Lab upload). Any failure    */
/*  degrades to manual entry.                                                    */
/* -------------------------------------------------------------------------- */

export type ExtractResult =
  | { status: "ok"; deck: ExtractedDeck }
  | { status: "error"; message: string };

/** Browser-visible backend base. Next inlines NEXT_PUBLIC_* into the client
 *  bundle; this mirrors getBackendUrl()'s public fallbacks minus the
 *  server-only vars the browser can't see. Empty → use the same-origin BFF
 *  proxy (no public URL configured in this env). */
const PUBLIC_BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  ""
).replace(/\/+$/, "");

export async function extractPresentation(file: File): Promise<ExtractResult> {
  const guard = deckFileError(file);
  if (guard) return { status: "error", message: guard };

  const form = new FormData();
  form.append("file", file, file.name);

  const token = await getAuthToken(); // optional — guest-friendly
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  // R6-FE4 — a deliberately non-safelisted header so the DIRECT cross-origin
  // attempt always PREFLIGHTS. Without it, a guest's multipart POST is a CORS
  // "simple request": the whole deck uploads and the BE fully processes it
  // before the missing CORS headers block the read (then the fallback uploads
  // it all AGAIN). With it, a CORS-dead BE fails the preflight instantly — no
  // body sent, no orphaned artifacts, immediate fallback. Harmless same-origin.
  headers["X-Requested-With"] = "willab";

  // FE-1: POST the deck straight to the backend first, bypassing the Next.js
  // proxy — on a serverless host (Vercel) the proxy function has a ~4.5 MB
  // request-body cap that 413s 5–20 MB decks before they reach the BE.
  //
  // R6-FE4: the direct path REQUIRES the BE to send CORS headers, and today it
  // doesn't (verified live: no Access-Control-Allow-Origin on the preflight or
  // the POST), so the browser kills every direct call before/after the wire.
  // Until the BE ships CORS, fall back to the same-origin BFF proxy whenever
  // the direct fetch dies at the network layer (CORS block, DNS, offline) —
  // that restores deck upload for everything under the proxy's body cap, and
  // big decks self-heal the moment the BE adds the headers.
  const attempt = async (url: string): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
      return await fetch(url, {
        method: "POST",
        headers,
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const proxyUrl = "/api/v2/lab/presentation/extract";
  let res: Response;
  let usedFallback = !PUBLIC_BACKEND_URL;
  try {
    if (PUBLIC_BACKEND_URL) {
      try {
        res = await attempt(`${PUBLIC_BACKEND_URL}/v2/lab/presentation/extract`);
      } catch (e) {
        // A TIMEOUT means the BE is alive but slow (cold LibreOffice, big
        // deck) — re-uploading the whole body via the proxy would double the
        // work and the wait, so surface it instead of chaining attempts.
        if (e instanceof Error && e.name === "AbortError") {
          return {
            status: "error",
            message: "Reading the deck took too long. Add your slides below.",
          };
        }
        // Network-layer death (CORS preflight block, DNS, offline) → the
        // same-origin proxy. Thanks to the preflight header above, no deck
        // bytes were uploaded on the failed attempt.
        usedFallback = true;
        res = await attempt(proxyUrl);
      }
    } else {
      res = await attempt(proxyUrl);
    }
  } catch {
    return {
      status: "error",
      message: "Couldn't reach the lab to read your deck. Add your slides below.",
    };
  }

  if (res.status === 413) {
    // BE (#128) sends `{ code:"FILE_TOO_LARGE", error, limit_mb }`. Read the
    // canonical message + cap so the FE never re-hardcodes the limit.
    const body = (await res.json().catch(() => null)) as unknown;
    if (usedFallback && body === null) {
      // A bare 413 on the PROXY leg is Vercel's ~4.5 MB platform body cap, not
      // the BE's 20 MB deck cap — saying "over 20 MB" to a 10 MB deck would be
      // false. Honest copy until the direct path (BE CORS) carries big decks.
      return {
        status: "error",
        message:
          "That deck is too large to send right now. Export a lighter PDF (a few MB) or add your slides below.",
      };
    }
    return { status: "error", message: fileTooLargeMessage(body) };
  }
  if (res.status === 415) {
    return {
      status: "error",
      message: "That file type isn't supported. Export your slides to PDF and upload that.",
    };
  }
  if (res.status === 422) {
    return {
      status: "error",
      message: "We couldn't read that deck. Add your slides below.",
    };
  }
  if (!res.ok) {
    return {
      status: "error",
      message: "We couldn't read that deck just now. Add your slides below.",
    };
  }

  const body = (await res.json().catch(() => null)) as unknown;
  return { status: "ok", deck: mapExtractedDeck(body) };
}

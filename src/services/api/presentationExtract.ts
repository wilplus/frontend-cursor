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

  // FE-1: POST the deck straight to the backend, bypassing the Next.js proxy.
  // On a serverless host (Vercel) the proxy function has a ~4.5 MB request-body
  // cap that silently 413s 5–20 MB decks before they reach the BE, which the FE
  // then mislabels "over 20 MB". Going direct removes that ceiling — the BE
  // endpoint is optional-auth (Bearer when present) and CORS-open to the app.
  // Falls back to the same-origin proxy when no public backend URL is exposed.
  const url = PUBLIC_BACKEND_URL
    ? `${PUBLIC_BACKEND_URL}/v2/lab/presentation/extract`
    : "/api/v2/lab/presentation/extract";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    });
  } catch {
    return {
      status: "error",
      message: "Couldn't reach the lab to read your deck. Add your slides below.",
    };
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 413) {
    // BE (#128) sends `{ code:"FILE_TOO_LARGE", error, limit_mb }`. Read the
    // canonical message + cap so the FE never re-hardcodes the limit; fall back
    // to the local cap when the 413 has no JSON body (e.g. a platform edge cap).
    const body = (await res.json().catch(() => null)) as unknown;
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

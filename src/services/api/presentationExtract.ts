import { getAuthToken } from "@/lib/api/auth-client";
import {
  deckFileError,
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

export async function extractPresentation(file: File): Promise<ExtractResult> {
  const guard = deckFileError(file);
  if (guard) return { status: "error", message: guard };

  const form = new FormData();
  form.append("file", file, file.name);

  const token = await getAuthToken(); // optional — guest-friendly
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch("/api/v2/lab/presentation/extract", {
      method: "POST",
      headers,
      body: form,
      credentials: "include",
    });
  } catch {
    return {
      status: "error",
      message: "Couldn't reach the lab to read your deck. Add your slides below.",
    };
  }

  if (res.status === 413) {
    return { status: "error", message: "That file is over 20 MB. Try a smaller export." };
  }
  if (res.status === 415) {
    return {
      status: "error",
      message: "That file type isn't supported. Use a .pptx or .pdf.",
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

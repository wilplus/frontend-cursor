import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  contextDocument (X-1) — attach a background context document to an arc.     */
/*                                                                            */
/*  The BE parses the file (PDF or UTF-8 text/markdown), stores the text as    */
/*  BACKGROUND ONLY (never rendered back, never injected as facts) and returns  */
/*  a light summary. Uploads cap at 20 pages: `truncated` means the first 20    */
/*  were used. A paywall/error is never fatal — the setup flow proceeds.        */
/* -------------------------------------------------------------------------- */

/** GET status — the text is never returned. Absent document → hasDocument false. */
export interface ContextDocumentStatus {
  hasDocument: boolean;
  pages: number | null;
  chars: number | null;
  /** true → the doc exceeded 20 pages and only the first 20 were used. */
  truncated: boolean;
  filename: string | null;
}

export type UploadContextResult =
  | { ok: true; pages: number | null; chars: number | null; truncated: boolean }
  /** 413 — over the file-size/page cap. */
  | { ok: false; reason: "too_large"; message: string }
  /** 400 — not a readable PDF/text, or no extractable text. */
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "error"; message: string };

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const endpoint = (arcId: string): string =>
  `/api/v2/explore/arc/${encodeURIComponent(arcId)}/context-document`;

/** GET the current context-document status. Soft-fails to "no document". */
export async function fetchContextDocument(
  arcId: string
): Promise<ContextDocumentStatus> {
  const none: ContextDocumentStatus = {
    hasDocument: false,
    pages: null,
    chars: null,
    truncated: false,
    filename: null,
  };
  const token = await getAuthToken();
  let res: Response;
  try {
    res = await fetch(endpoint(arcId), {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return none;
  }
  if (!res.ok) return none;
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return none;
  return {
    hasDocument: body.has_document === true,
    pages: num(body.pages),
    chars: num(body.chars),
    truncated: body.truncated === true,
    filename:
      typeof body.filename === "string" && body.filename.length > 0
        ? body.filename
        : null,
  };
}

/** POST a file (PDF or UTF-8 text/markdown) as the arc's context document. */
export async function uploadContextDocument(
  arcId: string,
  file: File
): Promise<UploadContextResult> {
  const token = await getAuthToken();
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch(endpoint(arcId), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
      cache: "no-store",
      body: form,
    });
  } catch {
    return { ok: false, reason: "error", message: "Network error. Try again." };
  }
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (res.ok) {
    return {
      ok: true,
      pages: num(body?.pages),
      chars: num(body?.chars),
      truncated: body?.truncated === true,
    };
  }
  if (res.status === 413) {
    return {
      ok: false,
      reason: "too_large",
      // 413 covers both the page cap and a byte-size cap, so don't assert pages
      // alone — a short-but-heavy scan is rejected on size, not page count.
      message: "That file is too large. Try a smaller file, or keep it under 20 pages.",
    };
  }
  if (res.status === 400) {
    return {
      ok: false,
      reason: "invalid",
      message:
        typeof body?.error === "string"
          ? body.error
          : "Couldn't read that file. Try a PDF or a text file.",
    };
  }
  return {
    ok: false,
    reason: "error",
    message: "Couldn't attach that just now. Try again.",
  };
}

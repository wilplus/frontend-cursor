/* -------------------------------------------------------------------------- */
/*  What the CMS may upload, and what to say when it may not                   */
/*                                                                            */
/*  These files go STRAIGHT to R2 on a presigned PUT — they never transit the  */
/*  BFF, so Vercel's ~4.5 MB body limit is not the constraint here and a guard */
/*  borrowed from a BFF path (MAX_UPLOAD_BYTES, the coach recorder's) refuses  */
/*  ordinary phone video for no reason. The only real limits are the           */
/*  backend's: a per-kind MIME allowlist, and a per-kind size cap served with  */
/*  the presign itself (JOURNAL_MAX_VIDEO_MB and friends, 500 MB for video by  */
/*  default). The cap is served rather than hardcoded so the founder can move  */
/*  it without a deploy — so this file must never contain the number.          */
/*                                                                            */
/*  Mirrors services/journal_media.py `_ALLOWED`. If that list changes, this   */
/*  one changes with it; being out of date here costs a clear message, never   */
/*  a wrong upload, because the presign refuses anything outside its own list. */
/* -------------------------------------------------------------------------- */

export type MediaKind = "image" | "video" | "audio";

const ALLOWED: Record<MediaKind, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav"],
};

/** How the sentence names the thing, and what a person calls those formats. */
const NOUN: Record<MediaKind, string> = {
  image: "an image",
  video: "a video",
  audio: "audio",
};
const SPOKEN: Record<MediaKind, string> = {
  image: "JPEG, PNG, WebP, AVIF or GIF",
  video: "MP4, MOV or WebM",
  audio: "MP3, M4A, WAV, OGG or WebM",
};

/** Extension → MIME, for the pickers that set no type on the File. An
 *  AirDropped .mov arriving with an empty `type` is the case that bites. */
const BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", gif: "image/gif",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime",
  qt: "video/quicktime", webm: "video/webm",
  mp3: "audio/mpeg", m4a: "audio/mp4", weba: "audio/webm", ogg: "audio/ogg",
  wav: "audio/wav",
};

/** ONE content type for both the presign and the PUT. Two separately derived
 *  values is a signature mismatch waiting for the first file without a type. */
export function contentTypeFor(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? "";
}

/** A message when this file cannot be published as `kind`, else null. */
export function unsupportedMessage(contentType: string, kind: MediaKind): string | null {
  if (ALLOWED[kind].includes(contentType)) return null;
  return `That file is not ${NOUN[kind]} we can publish. Use ${SPOKEN[kind]}.`;
}

const mb = (bytes: number) => Math.max(1, Math.round(bytes / (1024 * 1024)));

/** A message when the file is past the cap the presign served, else null.
 *  `maxBytes` null (an older backend that serves no cap) means no check —
 *  never a guessed number. */
export function oversizeMessage(bytes: number, maxBytes: number | null): string | null {
  if (!maxBytes || bytes <= maxBytes) return null;
  return `That file is ${mb(bytes)} MB and the limit is ${mb(maxBytes)} MB.`;
}

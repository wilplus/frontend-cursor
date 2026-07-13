/* -------------------------------------------------------------------------- */
/*  audioUploadValidation — client-side guard on the "upload a recording"       */
/*  pickers (bug 1). A video file used to reach the Vercel BFF and die as a      */
/*  raw 413 (the platform's ~4.5MB Node.js serverless body limit) with a         */
/*  confusing downstream error. Reject video + oversize files BEFORE the         */
/*  network call, with a plain-language message.                                */
/* -------------------------------------------------------------------------- */

/** Vercel's Node.js serverless function body-size limit. Not configurable
 *  below Enterprise, so the guard sits client-side, ahead of the request. */
export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

const VIDEO_EXT_RE = /\.(mp4|mov|avi|mkv|webm|m4v|3gp|wmv|flv)$/i;

/** Returns an error message when the file can't be submitted, or null when
 *  it's fine. Video is checked by MIME type first (reliable when present),
 *  falling back to the filename extension (some OS pickers / drag-drop don't
 *  set a MIME type). */
export function validateAudioUpload(file: File): string | null {
  const isVideo = file.type.startsWith("video/") || VIDEO_EXT_RE.test(file.name);
  if (isVideo) return "Audio files only. Video isn't supported.";
  if (file.size > MAX_UPLOAD_BYTES) {
    return "That file's too large. Try a shorter audio file.";
  }
  return null;
}

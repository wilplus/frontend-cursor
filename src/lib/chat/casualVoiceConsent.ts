/**
 * Single-key localStorage flag for the one-time dual-capture consent
 * prompt (FE Prompt 3, contract C6). Encapsulated here rather than
 * inlined in the modal so the component never reads window directly —
 * lets us swap to a server-side preference store later without
 * touching call-sites.
 *
 * Backend is intentionally unaware of this flag. The consent dialog
 * is pure-frontend UX; backend's contract is just "if audio_file
 * lands, analyse it." The matrix's privacy story (audio metrics-only,
 * never retained as transcript) is communicated once via this modal
 * and then assumed acknowledged for the duration of the device.
 */

const STORAGE_KEY = "casualVoiceConsent";

/** Read the consent flag. Returns false during SSR (no localStorage). */
export function hasCasualVoiceConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // Private-browsing Safari can throw on localStorage access; treat
    // as "no consent" so the modal fires (degrades to per-session
    // re-consent, which is still better than silently recording).
    return false;
  }
}

/** Mark consent granted. No-op during SSR. */
export function setCasualVoiceConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    /* private-browsing — swallow */
  }
}

/** Test/utility — clear the flag (used by /signout or QA tooling). */
export function clearCasualVoiceConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* swallow */
  }
}

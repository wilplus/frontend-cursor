/**
 * Strong-sides anchor — persists the timestamp at which the "★ Strong sides"
 * button was last offered, so the button survives a reload (FE handoff F).
 *
 * The trainings chip already persists via the bot message's
 * `metadata.suggested_action` (it round-trips through the thread). The
 * strong-sides button is different: it's an anchored, text-less bubble keyed
 * off a single timestamp held in component state, so without this it vanished
 * on reload. We store just the ISO timestamp (its thread sort position); a new
 * offer overwrites it (re-anchors), matching the in-session behaviour.
 */

const KEY = "willab_strong_sides_at";

export function readStrongSidesAnchor(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function writeStrongSidesAnchor(iso: string): void {
  try {
    localStorage.setItem(KEY, iso);
  } catch {
    // storage quota / unavailable — not fatal; the button just won't survive
    // a reload this once.
  }
}

export function clearStrongSidesAnchor(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

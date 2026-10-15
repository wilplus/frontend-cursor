/* -------------------------------------------------------------------------- */
/*  The last copy of a screen's data, on this device (founder 2026-10-14,     */
/*  speed plan). A screen opens on what it showed last time and refreshes     */
/*  behind it, the way the CEO panel's bootstrap already does. Only for       */
/*  admin, coach and research screens; never anything a speaker reads.        */
/*  Storage blocked or full: the screen simply waits for the backend.        */
/* -------------------------------------------------------------------------- */

const PREFIX = "willab:last:";

export function readLastCopy<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLastCopy(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* too big or blocked: the next open waits for the backend */
  }
}

export function dropLastCopy(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* nothing kept */
  }
}

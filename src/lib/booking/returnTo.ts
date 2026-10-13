/**
 * Coming back to the booking page after sign-in or sign-up (founder
 * 2026-10-13). The booking page saves which page and time the person chose;
 * BookingReturn sends them back there once they are signed in, wherever the
 * sign-in road ended (email, Google, LinkedIn, email confirmation).
 */
const KEY = "willab_booking_return";
const FRESH_MS = 60 * 60 * 1000;

export interface BookingReturn {
  slug: string;
  slot: number | null;
}

export function saveBookingReturn(slug: string, slot: number | null): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ slug, slot, at: Date.now() }));
  } catch {
    /* storage blocked: the redirectTo link still carries the page */
  }
}

export function readBookingReturn(): BookingReturn | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw.slug !== "string" || Date.now() - Number(raw.at) > FRESH_MS) return null;
    return { slug: raw.slug, slot: typeof raw.slot === "number" ? raw.slot : null };
  } catch {
    return null;
  }
}

export function clearBookingReturn(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

export function bookingUrl(r: BookingReturn): string {
  return `/book/${encodeURIComponent(r.slug)}${r.slot ? `?slot=${new Date(r.slot).toISOString()}` : ""}`;
}

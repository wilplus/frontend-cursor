import "server-only";
import { backendFetch } from "@/app/api/_lib/backend";
import type { PageInfo } from "@/app/book/[slug]/BookingPage";

/** The public booking page's settings, or null when the link is wrong or off. */
export async function loadBookingPage(slug: string): Promise<PageInfo | null> {
  try {
    const res = await backendFetch(`/v2/booking/${encodeURIComponent(slug)}`, { token: null, cache: "no-store" });
    return res.ok ? ((await res.json()) as PageInfo) : null;
  } catch {
    return null;
  }
}

import "server-only";
import { backendFetch } from "@/app/api/_lib/backend";
import type { PageInfo } from "@/app/book/[slug]/BookingPage";

/** The public booking page's settings, or null when the link is wrong or off.
 *  A valid price link (?link=) sets the price everyone is shown. */
export async function loadBookingPage(slug: string, link?: string): Promise<PageInfo | null> {
  try {
    const q = link ? `?link=${encodeURIComponent(link)}` : "";
    const res = await backendFetch(`/v2/booking/${encodeURIComponent(slug)}${q}`, { token: null, cache: "no-store" });
    return res.ok ? ((await res.json()) as PageInfo) : null;
  } catch {
    return null;
  }
}

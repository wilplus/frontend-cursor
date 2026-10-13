import { notFound } from "next/navigation";
import { backendFetch } from "@/app/api/_lib/backend";
import { loadBookingPage as loadPage } from "@/lib/booking/server";
import Done, { type Confirmation } from "./Done";

export const dynamic = "force-dynamic";

/* /book/<slug>/done?session_id=… — Stripe sends the guest here after paying.
 * Reading the confirmation also confirms the booking if Stripe's webhook has
 * not arrived yet, so the guest never sees a "pending" page. */
export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { session_id?: string; booking?: string };
}) {
  const info = await loadPage(params.slug);
  if (!info) notFound();
  const q = new URLSearchParams();
  if (searchParams.session_id) q.set("session_id", searchParams.session_id);
  if (searchParams.booking) q.set("booking", searchParams.booking);
  let booking: Confirmation | null = null;
  try {
    const res = await backendFetch(`/v2/booking/confirmation?${q}`, { token: null, cache: "no-store" });
    booking = res.ok ? ((await res.json()) as Confirmation) : null;
  } catch {
    booking = null;
  }
  return <Done info={info} booking={booking} />;
}

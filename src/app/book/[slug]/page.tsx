import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loadBookingPage as loadPage } from "@/lib/booking/server";
import BookingPage, { type PageInfo } from "./BookingPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const info = await loadPage(params.slug);
  return info ? { title: `${info.title} · ${info.host_name}` } : {};
}

export default async function Page({ params }: { params: { slug: string } }) {
  const info = await loadPage(params.slug);
  if (!info) notFound();
  // Vercel names the visitor's time zone from their IP; the page starts there.
  const ipZone = headers().get("x-vercel-ip-timezone") || undefined;
  return <BookingPage info={info} ipZone={ipZone} />;
}

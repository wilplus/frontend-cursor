import type { Metadata } from "next";
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
  return <BookingPage info={info} />;
}

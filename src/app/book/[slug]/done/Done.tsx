import { city, fmtDay, fmtTime, money } from "@/lib/booking/time";
import { Shell, type PageInfo } from "../BookingPage";

export interface Confirmation {
  status: "held" | "confirmed" | "cancelled";
  title: string;
  start_at: string;
  end_at: string;
  guest_name: string;
  guest_email: string;
  guest_timezone: string;
  meet_url: string;
  price_cents: number;
  currency: string;
}

export default function Done({ info, booking }: { info: PageInfo; booking: Confirmation | null }) {
  if (!booking || booking.status !== "confirmed") {
    return (
      <Shell>
        <div className="mx-auto grid max-w-[520px] gap-3.5">
          <h1 className="font-heading text-[30px] leading-tight">We couldn&apos;t find this booking</h1>
          <p className="text-muted-foreground">
            If you paid, the confirmation email is on its way. If it doesn&apos;t arrive in a few minutes,
            write to artur@willonski.com.
          </p>
          <a href={`/book/${info.slug}`} className="justify-self-start rounded-[10px] border border-border px-[18px] py-3 font-semibold">
            Back to booking
          </a>
        </div>
      </Shell>
    );
  }
  const tz = booking.guest_timezone || "UTC";
  const start = Date.parse(booking.start_at);
  const end = Date.parse(booking.end_at);
  const row = "grid grid-cols-[90px_1fr] gap-2.5 border-b border-border py-2.5 text-sm";
  return (
    <Shell>
      <div className="mx-auto grid max-w-[520px] gap-3.5">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-[hsl(var(--success))] text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="m5 12 5 5 9-10" />
          </svg>
        </div>
        <h1 className="font-heading text-[30px] leading-tight">You&apos;re booked</h1>
        <p className="text-muted-foreground">A calendar invite is on its way to {booking.guest_email}.</p>
        <dl className="grid border-t border-border">
          <div className={row}><dt className="text-muted-foreground">What</dt><dd>{booking.title} with {info.host_name}</dd></div>
          <div className={row}>
            <dt className="text-muted-foreground">When</dt>
            <dd>{fmtDay(start, tz)}, {fmtTime(start, tz, true)} – {fmtTime(end, tz, true)} ({city(tz)})</dd>
          </div>
          <div className={row}>
            <dt className="text-muted-foreground">Where</dt>
            <dd className="min-w-0 [overflow-wrap:anywhere]">
              <a href={booking.meet_url} className="underline" target="_blank" rel="noreferrer">{booking.meet_url}</a>
            </dd>
          </div>
          <div className={row}><dt className="text-muted-foreground">Paid</dt><dd>{money(booking.price_cents, booking.currency)}</dd></div>
        </dl>
        <p className="text-sm text-muted-foreground">Need to cancel or move it? Reply to the confirmation email.</p>
      </div>
    </Shell>
  );
}

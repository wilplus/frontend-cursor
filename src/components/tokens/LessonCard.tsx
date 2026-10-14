"use client";

import Link from "next/link";
import { money } from "@/lib/booking/time";
import type { LessonOffer } from "@/lib/booking/offers";

/** The 1-on-1 lesson on the pricing screen (founder 2026-10-14, step 3):
 *  always there, with this person's price and a way to book. */
export default function LessonCard({ lesson }: { lesson: LessonOffer }) {
  const first = lesson.host_name.split(" ")[0];
  const lower = lesson.price_cents < lesson.list_price_cents;
  return (
    <section className="mt-8 w-full">
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        1-on-1 with {first}
      </h3>
      <div className={`flex flex-col rounded-2xl border bg-card p-6 ${lower ? "border-foreground" : "border-border"}`}>
        {lower ? (
          <span className="mb-2 self-start rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-background">
            Your price
          </span>
        ) : null}
        <p className="text-sm font-medium text-foreground">
          1-on-1 lesson · {lesson.duration_min} min · Google Meet
        </p>
        <p className="mt-2 text-4xl font-bold tracking-tight text-foreground">
          {lower ? (
            <s className="mr-2 text-xl font-medium text-muted-foreground">
              {money(lesson.list_price_cents, lesson.currency)}
            </s>
          ) : null}
          {money(lesson.price_cents, lesson.currency)}
        </p>
        <Link
          href={`/book/${encodeURIComponent(lesson.slug)}`}
          className="mt-5 self-start rounded-full border border-foreground px-5 py-2 text-sm font-semibold text-foreground no-underline hover:bg-foreground hover:text-background"
        >
          Book a time
        </Link>
      </div>
    </section>
  );
}

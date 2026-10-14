/** What the pricing screen shows for one person (GET /api/v2/user/offers). */
export interface PlanPromotion {
  plan: string;
  price_cents: number;
  list_cents: number;
  ends_at: string;
}

export interface LessonOffer {
  slug: string;
  host_name: string;
  duration_min: number;
  price_cents: number;
  list_price_cents: number;
  currency: string;
}

export interface MyOffers {
  promotion: PlanPromotion | null;
  lesson: LessonOffer | null;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

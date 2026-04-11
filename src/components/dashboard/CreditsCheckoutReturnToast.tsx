"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/** Shows a toast after Stripe redirects to `/dashboard?credits=success|cancelled` and clears the query param. */
export default function CreditsCheckoutReturnToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const raw = searchParams.get("credits");
    if (raw !== "success" && raw !== "cancelled") return;
    handled.current = true;

    if (raw === "success") {
      toast.success("Payment complete — your credits should update shortly.");
    } else {
      toast.message("Checkout cancelled", {
        description: "No charge was made. You can choose a pack anytime from the credits page.",
      });
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("credits");
    const q = next.toString();
    router.replace(q ? `/dashboard?${q}` : "/dashboard", { scroll: false });
  }, [router, searchParams]);

  return null;
}

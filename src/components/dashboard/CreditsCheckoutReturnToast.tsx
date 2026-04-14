"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  WILLAB_CREDITS_CHECKOUT_SUCCESS_EVENT,
  type CreditsCheckoutSuccessDetail,
} from "@/lib/willabWindowEvents";

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
      const checkoutSessionId = searchParams.get("session_id");
      if (!checkoutSessionId?.trim()) {
        toast.error(
          "Payment may have succeeded, but the return URL is missing the Stripe session id (?session_id=). Credits cannot be claimed automatically — refresh after a minute or contact support.",
          { duration: 16_000 }
        );
      }
      const sid = checkoutSessionId?.trim() || null;
      const next = new URLSearchParams(searchParams.toString());
      next.delete("credits");
      next.delete("session_id");
      const q = next.toString();
      /** Dispatch after replace would race listeners; microtask runs after layout effects on this commit. */
      queueMicrotask(() => {
        window.dispatchEvent(
          new CustomEvent<CreditsCheckoutSuccessDetail>(
            WILLAB_CREDITS_CHECKOUT_SUCCESS_EVENT,
            { detail: { checkoutSessionId: sid } }
          )
        );
        router.replace(q ? `/dashboard?${q}` : "/dashboard", { scroll: false });
      });
    } else {
      toast.message("Checkout cancelled", {
        description: "No charge was made. You can choose a pack anytime from the credits page.",
      });
      const next = new URLSearchParams(searchParams.toString());
      next.delete("credits");
      next.delete("session_id");
      const q = next.toString();
      router.replace(q ? `/dashboard?${q}` : "/dashboard", { scroll: false });
    }
  }, [router, searchParams]);

  return null;
}

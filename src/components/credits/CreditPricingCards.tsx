"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CREDIT_PACK_DISPLAY } from "@/lib/stripe/creditPacks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CreditPricingCards() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const supabase = createClient();

  async function startCheckout(priceId: string) {
    setLoadingId(priceId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ priceId }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Checkout failed");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error("No checkout URL returned");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="w-full space-y-6">
      <p className="text-center text-sm text-muted-foreground sm:text-base">
        Most students pick <span className="font-semibold text-foreground">Standard</span> — best credits per dollar.
      </p>
      <div className="grid gap-4 sm:grid-cols-3 sm:items-stretch sm:gap-3">
        {CREDIT_PACK_DISPLAY.map((pack) => {
          const isMiddle = pack.tier === "standard";
          return (
            <div
              key={pack.priceId}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-shadow",
                isMiddle &&
                  "border-primary ring-2 ring-primary/25 shadow-md sm:scale-[1.03] sm:z-[1]"
              )}
            >
              {isMiddle && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold text-foreground">{pack.title}</h3>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                ${pack.priceUsd}
                <span className="text-base font-normal text-muted-foreground"> USD</span>
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{pack.credits} credits</p>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{pack.blurb}</p>
              <Button
                type="button"
                className="mt-5 w-full"
                variant={isMiddle ? "default" : "outline"}
                disabled={loadingId !== null}
                onClick={() => startCheckout(pack.priceId)}
              >
                {loadingId === pack.priceId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Redirecting…
                  </>
                ) : (
                  "Continue to checkout"
                )}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/dashboard" className="underline-offset-4 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}

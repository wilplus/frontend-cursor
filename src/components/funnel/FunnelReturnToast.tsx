"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, { kind: "info" | "error"; text: string }> = {
  already_claimed: {
    kind: "info",
    text: "Looks like you've already claimed this session.",
  },
  claim_error: {
    kind: "error",
    text: "Something went wrong claiming your recording. Please try again.",
  },
  expired: {
    kind: "info",
    text: "Your trial recording expired. Try again — it's quick.",
  },
};

export default function FunnelReturnToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const value = params.get("funnel");
    if (!value) return;
    const entry = MESSAGES[value];
    if (entry) {
      if (entry.kind === "error") toast.error(entry.text);
      else toast.message(entry.text);
    }
    const next = new URLSearchParams(params.toString());
    next.delete("funnel");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [params, pathname, router]);

  return null;
}

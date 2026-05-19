"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  SignupCta — full-width primary pill                                       */
/*                                                                            */
/*  Single-action slot. Used for "create your account" / "save your         */
/*  progress" CTAs that should dominate the bottom slot — visually the     */
/*  loudest variant of any slot because the conversion moment matters.     */
/* -------------------------------------------------------------------------- */

export interface SignupCtaProps {
  onClick: () => void;
  /** Spinner while the parent's auth round-trip is in flight. */
  submitting?: boolean;
  label?: string;
}

export function SignupCta({
  onClick,
  submitting = false,
  label = "Create your account",
}: SignupCtaProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-full",
        "bg-primary text-primary-foreground text-[15px] font-semibold",
        "shadow-md transition-all hover:shadow-lg active:scale-[.98]",
        "disabled:cursor-not-allowed disabled:opacity-60"
      )}
    >
      {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {label}
    </button>
  );
}

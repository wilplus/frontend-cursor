"use client";

import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  The chrome every lane screen wears.                                        */
/*                                                                            */
/*  Phone-first (founder 2026-09-16): the camera screen is full-bleed and dark,*/
/*  every other screen is light with one decision in the middle and the CTA in */
/*  thumb reach. On a wider screen the same column is centred rather than       */
/*  stretched — a 1400px-wide text field is nobody's idea of one action.       */
/* -------------------------------------------------------------------------- */

export function LaneShell({
  step,
  total,
  dark,
  onBack,
  onClose,
  children,
  footer,
}: {
  step: number;
  total: number;
  dark?: boolean;
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main
      className={`flex h-full flex-col ${
        dark ? "bg-[#121212] text-white" : "bg-background text-foreground"
      }`}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5">
        <div className="flex items-center justify-between gap-3 py-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-1 p-1 opacity-70 transition hover:opacity-100"
          >
            <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <div className="flex items-center gap-1" aria-label={`Step ${step} of ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`block h-[3px] w-4 rounded-full ${
                  i < step
                    ? dark ? "bg-white" : "bg-foreground"
                    : dark ? "bg-white/25" : "bg-border"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 p-1 opacity-70 transition hover:opacity-100"
          >
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col pt-2">{children}</div>

        <div className="flex flex-col gap-3 pb-7 pt-4">{footer}</div>
      </div>
    </main>
  );
}

export function LaneHeading({ children, small }: { children: ReactNode; small?: boolean }) {
  return (
    <h1
      className={`mb-5 font-semibold tracking-[-0.02em] ${
        small ? "text-[20px]" : "text-[24px]"
      } leading-[1.25]`}
      style={{ textWrap: "balance" }}
    >
      {children}
    </h1>
  );
}

export function LaneCta({
  children,
  onClick,
  disabled,
  dark,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full px-5 py-[15px] text-[15px] font-medium transition disabled:opacity-30 ${
        dark ? "bg-white text-[#121212]" : "bg-foreground text-background"
      }`}
    >
      {children}
    </button>
  );
}

export function LaneQuiet({
  children,
  onClick,
  dark,
}: {
  children: ReactNode;
  onClick: () => void;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-1.5 text-center text-[14px] underline underline-offset-4 ${
        dark ? "text-white/60" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export const LANE_INPUT =
  "w-full rounded-[10px] border border-border bg-background px-3.5 py-3 text-[16px] text-foreground outline-none focus:border-foreground/30";

export function LaneField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium">{label}</span>
      {children}
    </label>
  );
}

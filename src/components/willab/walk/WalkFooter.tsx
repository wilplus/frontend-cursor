import type { ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/*  WalkFooter — one black pill, grey links under it, never beside it          */
/*  (founder lock 2026-10-06). Anything passed as children (the recording      */
/*  strip) sits above the pill.                                               */
/* -------------------------------------------------------------------------- */

export type WalkAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
};

export function WalkPill({ action, dot = false }: { action: WalkAction; dot?: boolean }) {
  return (
    <button
      type="button"
      data-walk-pill
      data-testid={action.testId}
      onClick={action.onClick}
      disabled={action.disabled}
      className="walk-press flex h-[54px] w-full items-center justify-center gap-[9px] rounded-full bg-foreground text-center text-[16px] font-semibold text-background disabled:cursor-default disabled:opacity-30"
    >
      {dot ? <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-record" /> : null}
      {action.label}
    </button>
  );
}

export function WalkLink({ action }: { action: WalkAction }) {
  return (
    <button
      type="button"
      data-walk-link
      data-testid={action.testId}
      onClick={action.onClick}
      disabled={action.disabled}
      className="walk-press flex h-10 w-full items-center justify-center text-[16px] text-muted-foreground"
    >
      {action.label}
    </button>
  );
}

export default function WalkFooter({
  pill,
  dot = false,
  links = [],
  children,
}: {
  pill?: WalkAction | null;
  /** The record dot inside the pill ("Record Take N"). */
  dot?: boolean;
  links?: readonly WalkAction[];
  children?: ReactNode;
}) {
  return (
    <div data-walk-footer className="flex flex-col gap-1 px-5 pb-[max(30px,env(safe-area-inset-bottom))] pt-2">
      {children}
      {pill ? <WalkPill action={pill} dot={dot} /> : null}
      {links.map((link) => (
        <WalkLink key={link.label} action={link} />
      ))}
    </div>
  );
}

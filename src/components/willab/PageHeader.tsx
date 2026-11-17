import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";

/* -------------------------------------------------------------------------- */
/*  PageHeader — the locked authenticated page/overlay header primitive.       */
/*                                                                            */
/*  The header owns the viewport rule and the safe content rail. Callers own   */
/*  the controls inside it (Back, title/profile, menu and the canonical X),   */
/*  so navigation semantics stay with the surface while geometry cannot drift. */
/*                                                                            */
/*  `viewport` is for a header mounted inside the 1080px app canvas (the       */
/*  project chat); its separator is fixed to the viewport. `container` is for  */
/*  a full-screen overlay (Ideal Text and feedback), where the header itself   */
/*  already spans the viewport.                                                */
/* -------------------------------------------------------------------------- */

export type PageHeaderProps = Omit<ComponentPropsWithoutRef<"header">, "children"> & {
  children: ReactNode;
  contentClassName?: string;
  safeArea?: boolean;
  divider?: "container" | "viewport";
  dividerClassName?: string;
};

export function PageHeader({
  children,
  className,
  contentClassName,
  safeArea = false,
  divider = "container",
  dividerClassName,
  ...props
}: PageHeaderProps) {
  return (
    <header
      {...props}
      data-page-header
      className={cn(
        "relative shrink-0 bg-background",
        divider === "container" && "border-b border-border",
        safeArea && "pt-[env(safe-area-inset-top)]",
        className,
      )}
    >
      <div
        data-page-header-content
        className={cn(WILLAB_CONTENT_RAIL, "flex items-center", contentClassName)}
      >
        {children}
      </div>
      {divider === "viewport" ? (
        <span
          aria-hidden
          data-page-header-divider
          className={cn(
            "pointer-events-none fixed inset-x-0 h-px bg-border",
            dividerClassName,
          )}
        />
      ) : null}
    </header>
  );
}

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
/*  `viewport` keeps the separator viewport-wide even when the header is       */
/*  mounted inside the 1080px app canvas. `container` remains available for    */
/*  the rare surface whose own header is intentionally the divider boundary.    */
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
  divider = "viewport",
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
            "pointer-events-none absolute bottom-0 left-1/2 h-px w-screen -translate-x-1/2 bg-border",
            dividerClassName,
          )}
        />
      ) : null}
    </header>
  );
}

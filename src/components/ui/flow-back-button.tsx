"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Secondary "Back" button used in flow steps (pre-quest, post-quest, command select, recording).
 * Consistent ¼ width, neutral styling: border, background, muted text, hover state.
 * Use to the left of the primary orange action button.
 */
export const flowBackButtonClass =
  "w-1/4 shrink-0 rounded-md border border-input bg-background py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export interface FlowBackButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

const FlowBackButton = React.forwardRef<HTMLButtonElement, FlowBackButtonProps>(
  ({ className, children = "Back", ...props }, ref) => {
    return (
      <button
        type="button"
        ref={ref}
        className={cn(flowBackButtonClass, className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

FlowBackButton.displayName = "FlowBackButton";

export default FlowBackButton;

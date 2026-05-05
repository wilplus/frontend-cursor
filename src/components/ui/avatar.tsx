import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight avatar — round container with initials fallback. Image is not
 * supported here yet because the admin payload doesn't carry photo URLs.
 */
export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Single name/email used to derive initials when children is omitted. */
  name?: string;
  /** Visual size in px (renders as h/w utility). Defaults to 40px. */
  sizePx?: number;
}

function deriveInitials(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "?";
  const beforeAt = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  const parts = beforeAt
    .split(/[\s._-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return trimmed.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, name, sizePx = 40, children, style, ...props }, ref) => {
    const fallback = name ? deriveInitials(name) : "?";
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium select-none",
          className
        )}
        style={{ height: sizePx, width: sizePx, fontSize: sizePx * 0.36, ...style }}
        {...props}
      >
        {children ?? fallback}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

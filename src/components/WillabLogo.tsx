import { cn } from "@/lib/utils";

/** Willab. logo: bold serif "Willab" in dark blue/charcoal with orange period. */
export default function WillabLogo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl sm:text-2xl",
    lg: "text-2xl sm:text-3xl",
  };
  return (
    <span
      className={cn("font-serif font-bold tracking-tight", sizeClasses[size], className)}
      style={{ color: "hsl(220 25% 25%)" }}
      aria-label="Willab"
    >
      Willab
      <span style={{ color: "hsl(24 95% 53%)" }} aria-hidden>.</span>
    </span>
  );
}

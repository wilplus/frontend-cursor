import { Pacifico } from "next/font/google";
import { cn } from "@/lib/utils";

const pacifico = Pacifico({ weight: "400", subsets: ["latin"] });

/** Willab. logo: Pacifico "Willab" in dark blue/charcoal with orange period. */
export default function WillabLogo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "text-base",
    md: "text-lg sm:text-xl",
    lg: "text-xl sm:text-2xl",
  };
  return (
    <span
      className={cn(pacifico.className, "tracking-tight", sizeClasses[size], className)}
      style={{ color: "hsl(220 25% 25%)" }}
      aria-label="Willab"
    >
      Willab
      <span style={{ color: "hsl(24 95% 53%)" }} aria-hidden>.</span>
    </span>
  );
}

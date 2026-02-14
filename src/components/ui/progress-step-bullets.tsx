"use client";

interface ProgressStepBulletsProps {
  total: number;
  currentIndex: number;
  "aria-label"?: string;
  /** When "minimal": no connector lines; current = primary, others = grey (no completed/green). */
  variant?: "default" | "minimal";
}

/**
 * Numbered circles (e.g. 1–5): active = primary (orange). default: connectors, completed = green; minimal: no connectors, pending = grey.
 */
export function ProgressStepBullets({
  total,
  currentIndex,
  "aria-label": ariaLabel,
  variant = "default",
}: ProgressStepBulletsProps) {
  const minimal = variant === "minimal";
  return (
    <div
      className="flex items-center justify-center gap-0"
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={ariaLabel ?? `Step ${currentIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const completed = !minimal && i < currentIndex;
        const current = i === currentIndex;
        return (
          <div key={i} className="flex items-center">
            {!minimal && i > 0 && (
              <div
                className={`h-0.5 w-4 sm:w-6 flex-shrink-0 ${
                  completed ? "bg-step-completed" : "bg-step-pending"
                }`}
                aria-hidden
              />
            )}
            {minimal && i > 0 && <div className="w-1.5 sm:w-2 flex-shrink-0" aria-hidden />}
            <div
              className={`flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                current
                  ? "bg-primary text-white"
                  : minimal
                    ? "border-2 border-input bg-transparent text-muted-foreground"
                    : completed
                      ? "bg-step-completed text-white"
                      : "bg-step-pending text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}

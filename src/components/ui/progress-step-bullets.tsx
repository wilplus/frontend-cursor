"use client";

interface ProgressStepBulletsProps {
  total: number;
  currentIndex: number;
  "aria-label"?: string;
}

/**
 * Three numbered circles (1, 2, 3) with connector lines: active = primary (orange), pending = step-pending (grey).
 */
export function ProgressStepBullets({
  total,
  currentIndex,
  "aria-label": ariaLabel,
}: ProgressStepBulletsProps) {
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
        const completed = i < currentIndex;
        const current = i === currentIndex;
        return (
          <div key={i} className="flex items-center">
            {i > 0 && (
              <div
                className={`h-0.5 w-4 sm:w-6 flex-shrink-0 ${
                  completed ? "bg-step-completed" : "bg-step-pending"
                }`}
                aria-hidden
              />
            )}
            <div
              className={`flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                current
                  ? "bg-primary text-white"
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

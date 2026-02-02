"use client";

interface ProgressPillsNumberedProps {
  total: number;
  currentIndex: number;
  "aria-label"?: string;
}

/**
 * Numbered circular pills connected by thin lines.
 * Current = solid orange with white number; completed = dark grey with white number; future = white with grey border + grey number.
 */
export function ProgressPillsNumbered({
  total,
  currentIndex,
  "aria-label": ariaLabel,
}: ProgressPillsNumberedProps) {
  return (
    <div
      className="flex items-center justify-center gap-0"
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={ariaLabel ?? `Question ${currentIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const completed = i < currentIndex;
        const current = i === currentIndex;
        const isLast = i === total - 1;
        return (
          <div key={i} className="flex items-center">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 sm:h-10 sm:w-10 ${
                completed
                  ? "bg-neutral-700 text-white dark:bg-neutral-600"
                  : current
                    ? "bg-orange-500 text-white ring-2 ring-orange-500/40 scale-110"
                    : "border-2 border-neutral-300 bg-white text-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-500"
              }`}
            >
              {i + 1}
            </div>
            {!isLast && (
              <div
                className={`mx-0.5 h-0.5 w-3 sm:w-4 ${
                  completed ? "bg-neutral-700 dark:bg-neutral-600" : "bg-neutral-200 dark:bg-neutral-600"
                }`}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

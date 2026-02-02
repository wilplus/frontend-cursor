"use client";

interface ProgressPillBarProps {
  total: number;
  currentIndex: number;
  "aria-label"?: string;
}

/**
 * Horizontal pill bar: active (current) w-8 bg-primary, completed w-4 step-completed (green), pending w-4 step-pending (muted).
 */
export function ProgressPillBar({
  total,
  currentIndex,
  "aria-label": ariaLabel,
}: ProgressPillBarProps) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={ariaLabel ?? `Question ${currentIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const completed = i < currentIndex;
        const current = i === currentIndex;
        return (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              completed
                ? "w-4 bg-step-completed"
                : current
                  ? "w-8 bg-primary"
                  : "w-4 bg-step-pending"
            }`}
          />
        );
      })}
    </div>
  );
}

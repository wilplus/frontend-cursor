"use client";

interface LevelProgressProps {
  current: number;
  total: number;
}

export default function LevelProgress({ current, total }: LevelProgressProps) {
  const safeTotal = Math.max(1, total);
  const filledCount = Math.min(Math.max(0, current), safeTotal);

  return (
    <div
      className="mt-1 mb-4 flex items-center justify-center gap-1.5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={filledCount}
      aria-label={`Level progress: ${filledCount} of ${safeTotal} steps completed`}
    >
      {Array.from({ length: safeTotal }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 w-6 rounded-full transition-colors ${
            i < filledCount ? "bg-primary" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

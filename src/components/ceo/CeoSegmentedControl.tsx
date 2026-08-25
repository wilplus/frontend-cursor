"use client";

import { cn } from "@/lib/utils";

export default function CeoSegmentedControl({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { key: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="inline-flex w-fit rounded-xl border border-border bg-background p-1"
      role="group"
      aria-label={label}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          aria-pressed={value === item.key}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors",
            value === item.key && "bg-foreground text-background"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

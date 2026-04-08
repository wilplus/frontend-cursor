"use client";

import type { CopilotAnnotationChip } from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";

export interface SelectedReasonChip {
  chip_key: string;
  custom_reason?: string | null;
}

interface ReasonChipSelectorProps {
  chips: CopilotAnnotationChip[];
  selected: SelectedReasonChip[];
  customReason: string;
  onSelectedChange: (next: SelectedReasonChip[]) => void;
  onCustomReasonChange: (value: string) => void;
  disabled?: boolean;
}

export default function ReasonChipSelector({
  chips,
  selected,
  customReason,
  onSelectedChange,
  onCustomReasonChange,
  disabled = false,
}: ReasonChipSelectorProps) {
  const activeKeys = new Set(selected.map((item) => item.chip_key));

  const toggleChip = (chipKey: string) => {
    if (disabled) return;
    if (activeKeys.has(chipKey)) {
      onSelectedChange(selected.filter((item) => item.chip_key !== chipKey));
      return;
    }
    onSelectedChange([...selected, { chip_key: chipKey }]);
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Reason Chips
      </p>
      <div className="flex flex-wrap gap-2">
        {chips.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            No active chips yet. Create them in the annotation chip endpoint.
          </span>
        ) : (
          chips
            .filter((chip) => chip.is_active !== false)
            .map((chip) => {
              const isSelected = activeKeys.has(chip.chip_key);
              return (
                <button
                  key={chip.chip_key}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleChip(chip.chip_key)}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs font-medium transition-all duration-200",
                    isSelected
                      ? "border-primary/40 bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:-translate-y-0.5 hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {chip.label}
                </button>
              );
            })
        )}
      </div>
      <textarea
        value={customReason}
        disabled={disabled}
        onChange={(event) => onCustomReasonChange(event.target.value)}
        rows={2}
        placeholder="Optional custom reason"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-all duration-200 ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

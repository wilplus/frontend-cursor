"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Single acoustic measurement displayed inside the toggle's expanded grid. */
export interface AcousticMetric {
  label: string;
  value: string;
}

interface AcousticToggleProps {
  metrics: AcousticMetric[];
  /** Optional id for ARIA wiring with the trigger button. */
  panelId?: string;
}

/**
 * AcousticToggle — pill button that expands to reveal a grid of metric chips.
 * Uses the CSS-grid 0fr → 1fr trick so the height transition is smooth without
 * having to measure DOM height in JS.
 */
export default function AcousticToggle({ metrics, panelId }: AcousticToggleProps) {
  const [open, setOpen] = useState(false);
  const id = panelId ?? "acoustic-panel";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {open ? "Hide acoustic data" : "Show acoustic data"}
        <ChevronDown
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-300",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </button>

      <div
        id={id}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-2 pt-1">
            {metrics.map((m) => (
              <span
                key={`${m.label}-${m.value}`}
                className="inline-flex items-baseline gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs"
              >
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-semibold text-foreground">{m.value}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

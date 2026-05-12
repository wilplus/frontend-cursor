"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
 * AcousticToggle — pill button that progressively reveals a row of
 * metric chips. Uses the CSS-grid `0fr → 1fr` height trick so the
 * transition is smooth without any DOM-measurement code in JS.
 *
 * Render nothing if `metrics` is empty so we don't show a useless
 * "Show acoustic data" pill that opens to white space.
 */
export default function AcousticToggle({ metrics, panelId }: AcousticToggleProps) {
  const [open, setOpen] = useState(false);
  if (metrics.length === 0) return null;
  const id = panelId ?? "acoustic-panel";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? "Hide" : "Show"} acoustic data
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id={id}
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="mt-3 flex flex-wrap gap-2">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-lg bg-muted/50 px-3 py-2 text-xs"
              >
                <span className="text-muted-foreground">{m.label}</span>{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

/* -------------------------------------------------------------------------- */
/*  ModeToggle — THE two-option segmented control (founder rule).              */
/*                                                                            */
/*  Extracted verbatim from the game screen, which is the design reference:    */
/*  small, black & white, w-[220px] rounded-full border bg-card p-1            */
/*  text-[12px], with the sliding black (bg-foreground) thumb. Any future      */
/*  screen that needs a two-state toggle uses THIS component, so toggles can    */
/*  never drift apart visually.                                                */
/* -------------------------------------------------------------------------- */

export interface ModeToggleOption<T extends string> {
  value: T;
  label: string;
}

export default function ModeToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  /** Exactly two options — this is a two-state pill by design. */
  options: [ModeToggleOption<T>, ModeToggleOption<T>];
  onChange: (value: T) => void;
}) {
  const activeIndex = value === options[1].value ? 1 : 0;
  return (
    <div className="relative grid w-[220px] grid-cols-2 rounded-full border border-border bg-card p-1 text-[12px]">
      <span
        aria-hidden
        className="absolute inset-y-1 rounded-full bg-foreground transition-transform duration-300 ease-out"
        style={{
          left: 4,
          width: "calc(50% - 4px)",
          transform: activeIndex === 0 ? "translateX(0)" : "translateX(100%)",
        }}
      />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`relative z-10 rounded-full px-3 py-1.5 font-semibold transition-colors ${
            value === opt.value ? "text-background" : "text-muted-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

"use client";

/** Small shared pieces for the rings panel tabs. Operator copy only. */

export const RING_CHOICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function RingSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (ring: number) => void;
  disabled?: boolean;
  label: string;
}) {
  // Rings are unbounded integers; the dropdown lists the near ones and keeps
  // whatever the row already holds beyond them.
  const choices = RING_CHOICES.includes(value as (typeof RING_CHOICES)[number])
    ? [...RING_CHOICES]
    : [...RING_CHOICES, value].sort((a, b) => a - b);
  return (
    <select
      aria-label={label}
      className="rounded-md border border-black/10 bg-background px-2 py-1 font-mono text-sm"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {choices.map((ring) => (
        <option key={ring} value={ring}>
          {ring}
        </option>
      ))}
    </select>
  );
}

export function Chip({ tone, children }: { tone: "on" | "off" | "hold" | "one"; children: React.ReactNode }) {
  const classes = {
    on: "bg-emerald-50 text-emerald-700",
    off: "bg-rose-50 text-rose-700",
    hold: "bg-amber-50 text-amber-700",
    one: "bg-indigo-50 text-indigo-700",
  }[tone];
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classes}`}>
      {children}
    </span>
  );
}

export function Toast({ text }: { text: string | null }) {
  return <p className="mt-2 min-h-[1.25rem] text-sm text-foreground/60">{text ?? ""}</p>;
}

export function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function describeRefusal(code: string): string {
  switch (code) {
    case "RING_ONE_WAY_KILLED":
      return "This row is one-way: it was killed and cannot be reopened or edited.";
    case "RING_RULE_INVALID":
      return "The rule must be an object of lists, e.g. {\"region\": [\"PL\"]}.";
    case "RING_VALUE_INVALID":
      return "Rings are whole numbers from 0 up.";
    case "RINGS_UNAVAILABLE":
      return "Rings are temporarily unavailable.";
    case "UNREACHABLE":
      return "The backend could not be reached.";
    default:
      return `Refused: ${code}`;
  }
}

"use client";

/** Finish take: the record red with its 12px stop square. On the recording
 *  screen it replaces Next slide on the last slide (founder lock 2026-10-12,
 *  N70); with no deck it stands alone. */
export default function FinishTakeButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Finish take"
      className={`flex shrink-0 items-center justify-center gap-2 bg-record font-semibold text-record-foreground ${className}`}
    >
      <span
        data-testid="finish-square"
        className="h-3 w-3 shrink-0 rounded-[2px] bg-current"
        aria-hidden
      />
      Finish take
    </button>
  );
}

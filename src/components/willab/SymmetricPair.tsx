"use client";

/**
 * SymmetricPair — equal-width pills that mirror the overlay Back | Next nav
 * (see SnippetScreenShell): a grey outline pill on the left (the close) and
 * the solid black pill on the right (the forward action; black, founder
 * 2026-10-12). Kept only where backend N467 item 7 keeps it: the consent ask,
 * the policy update and the one-project sheet. Every other choice in a chat
 * is an answer (`AnswerPair`, WillQuestion.tsx).
 */
export default function SymmetricPair({
  closeLabel,
  onClose,
  actionLabel,
  onAction,
}: {
  closeLabel: string;
  onClose: () => void;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-stretch gap-3">
      <button
        type="button"
        onClick={onClose}
        className="flex h-11 flex-1 items-center justify-center rounded-full border border-border text-[15px] text-foreground transition-colors hover:border-primary/50"
      >
        {closeLabel}
      </button>
      <button
        type="button"
        onClick={onAction}
        className="flex h-11 flex-1 items-center justify-center rounded-full bg-foreground text-[15px] font-medium text-background transition-colors hover:bg-foreground/90"
      >
        {actionLabel}
      </button>
    </div>
  );
}

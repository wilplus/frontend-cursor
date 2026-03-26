"use client";

export default function CoachMessageBanner({ message }: { message: string | null }) {
  const trimmed = (message ?? "").trim();
  if (!trimmed) return null;
  return (
    <div className="w-full max-w-md mx-auto mb-6 rounded-xl border border-border bg-muted/50 p-4 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">A message for you</p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{trimmed}</p>
    </div>
  );
}

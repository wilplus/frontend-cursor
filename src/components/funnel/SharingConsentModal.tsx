"use client";

import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Task 8 — one-time sharing-consent modal.
 *
 * Triggered on `/chat` when the user enters the reviewing phase AND
 * the BE consent surface reports `has_answered: false` (current state
 * `share_consent = null`). Three outcomes:
 *
 *   onAccept   → PUT { opt_in: true }  → close.
 *   onDecline  → PUT { opt_in: false } → close.
 *   onDismiss  → close WITHOUT a PUT — the user gets re-prompted on
 *                their next visit. Matches the "dismiss without
 *                answering = don't write, re-prompt next visit"
 *                stance agreed with BE.
 *
 * Per-flip audit ledger lives on BE (commit a901bf7 — every PUT
 * writes one row to user_consent_events with IP + UA). Dismiss-
 * without-answering deliberately doesn't ledger anything — there's
 * nothing yet to record because no decision was made.
 *
 * Copy intentionally framed about the sharing uplift (training
 * corpus + peer review), NOT about whether we process the
 * recording for the user's own analysis. The personal-use
 * processing was covered at session-1 acceptance (flagged for
 * legal review on the BE side).
 */
export function SharingConsentModal({
  open,
  onAccept,
  onDecline,
  onDismiss,
  submitting = false,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
  /** True while the parent's PUT is in flight — locks both buttons
   *  so the user can't double-fire. */
  submitting?: boolean;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // The shadcn AlertDialog fires onOpenChange(false) for both
        // the X button (none rendered) AND Esc / backdrop click. We
        // treat all "close without click" as a dismiss — no PUT, no
        // ledger row, re-prompt on next visit.
        if (!next && !submitting) onDismiss();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Share your snippets to help the community?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Sharing your charisma and stress snippets helps us train better
            voice models and lets peers learn from your moments. You can
            change your mind anytime — just tell us &ldquo;don&apos;t share
            this one&rdquo; about a specific recording.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Plain Button primitives instead of the local AlertDialog
              Cancel/Action wrappers because those don't surface
              `disabled` through their narrow type — and we need to
              lock both buttons while the parent's PUT is in flight to
              prevent double-clicks racing the round-trip.

              The button onClicks trigger the parent's PUT handler.
              AlertDialog's backdrop-click closes via onOpenChange,
              which calls the parent's onDismiss — that's the "dismiss
              without answering" path. After a confirmed click,
              onDismiss may also fire when the parent closes the modal
              programmatically; harmless because by then no decision
              state changes (the PUT already committed). */}
          <Button
            type="button"
            variant="outline"
            onClick={onDecline}
            disabled={submitting}
          >
            No, keep them private
          </Button>
          <Button
            type="button"
            onClick={onAccept}
            disabled={submitting}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            Yes, share my snippets
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

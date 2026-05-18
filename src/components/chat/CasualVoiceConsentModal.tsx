"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * One-time consent prompt for the dual-capture mic (FE Prompt 3, C6).
 *
 * The component itself is dumb — it renders the dialog and emits two
 * outcomes:
 *   onAccept — user agreed. Parent should setCasualVoiceConsent() and
 *              proceed to start the mic.
 *   onDecline — user declined. Parent should close the modal and NOT
 *              start the mic. (The mic affordance stays available so
 *              the user can re-attempt later if they change their
 *              mind.)
 *
 * Copy is the exact string from the prompt — explicitly mentions that
 * audio is for metrics only, not retained, so the user has an
 * informed-consent record before any audio leaves the browser.
 */
export function CasualVoiceConsentModal({
  open,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onDecline()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Voice analysis in chat</AlertDialogTitle>
          <AlertDialogDescription>
            To help us track how your voice changes under pressure, we&apos;ll
            briefly analyze the acoustics of what you say in chat. Audio is
            processed for metrics only and not retained.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDecline}>Not now</AlertDialogCancel>
          <AlertDialogAction
            onClick={onAccept}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            OK, got it
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

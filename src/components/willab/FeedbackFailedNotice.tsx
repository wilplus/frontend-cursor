"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";

/** THE FEEDBACK COULD NOT BE MADE, AND THE PAGE SAYS SO (F1 Repair Plan
 *  Phase 2, founder 2026-10-04; contract 24h).
 *
 *  The server no longer serves stand-in items when V3 cannot make a Take's
 *  Feedback: it serves none and reports the failure. Without this the
 *  speaker would see a page with no bookmarks and no reason.
 *
 *  Retried ONCE by itself, three seconds after the failure is first seen --
 *  most failures are a moment's contention and the second read succeeds.
 *  Only if that read fails too does the notice appear, with Try again. The
 *  text itself is never in question: it is already on the page, which is
 *  why the sentence says so (copy signed off 2026-10-04). */
export const FEEDBACK_RETRY_DELAY_MS = 3000;

export default function FeedbackFailedNotice({
  failed,
  onRetry,
}: {
  failed: boolean;
  onRetry: () => void;
}) {
  const [retried, setRetried] = useState(false);
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;

  useEffect(() => {
    if (!failed || retried) return;
    const timer = setTimeout(() => {
      setRetried(true);
      retryRef.current();
    }, FEEDBACK_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [failed, retried]);

  if (!failed || !retried) return null;
  return (
    <div
      role="status"
      className="flex shrink-0 flex-col items-start gap-2 px-5 pt-3"
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {IDEAL_EDIT_COPY.feedbackFailed}
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => retryRef.current()}
        className="h-9 rounded-full px-4 text-[14px] font-medium"
      >
        {IDEAL_EDIT_COPY.feedbackRetry}
      </Button>
    </div>
  );
}

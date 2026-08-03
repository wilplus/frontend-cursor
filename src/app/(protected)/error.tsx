"use client";

import ErrorState from "@/components/willab/ErrorState";

/** Route-level error boundary: the one qualitative error fallback, instead
 *  of Next's default white screen. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} />;
}

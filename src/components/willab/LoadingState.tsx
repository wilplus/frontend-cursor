import { Loader2 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  LoadingState — the ONE loading indicator across the app.                    */
/*                                                                            */
/*  Used both as the lazy-overlay dynamic-import fallback (`fullscreen`) and as */
/*  each overlay's own in-content loading state, so every loading screen looks  */
/*  identical. It's a lightweight lucide spinner (already in the bundle), NOT a */
/*  Lottie: the brand `public/animations/loading.json` is currently unused and  */
/*  a Lottie player would add weight to the very first paint. To switch the     */
/*  look everywhere, change the markup HERE only.                               */
/* -------------------------------------------------------------------------- */

export default function LoadingState({
  fullscreen = false,
}: {
  /** Full-viewport overlay (the lazy-overlay fallback). Default: fill the
   *  parent (an overlay's own loading state). */
  fullscreen?: boolean;
}) {
  const spinner = (
    <Loader2
      className="h-8 w-8 animate-spin text-muted-foreground"
      aria-label="Loading"
    />
  );
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background">
        {spinner}
      </div>
    );
  }
  return (
    <div className="flex min-h-[140px] flex-1 items-center justify-center">
      {spinner}
    </div>
  );
}

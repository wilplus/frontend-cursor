"use client";

import { useEffect, useState } from "react";
import DeckSlidePreview from "./DeckSlidePreview";

/** The slide as a small tile beside its kicker, and the full picture on a tap
 *  (founder 2026-09-26, Ideal Text redesign B).
 *
 *  The picture used to take up to 38% of the screen's height, and it repeats
 *  on every screen of a slide, so on a phone the speaker's own words started
 *  under it and a slide split into more screens than it needed. The tile keeps
 *  "which slide is this" at a glance; the tap keeps the whole slide one step
 *  away. The enlarged view closes on any tap or Escape. */
export default function DeckSlideThumb({
  presentationRef,
  pageIndex,
  label,
}: {
  presentationRef: string | null;
  pageIndex: number;
  /** The slide's kicker ("Slide 2"), used as the tile's accessible name. */
  label: string;
}) {
  const [enlarged, setEnlarged] = useState(false);
  useEffect(() => {
    if (!enlarged) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEnlarged(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged]);
  return (
    <>
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        aria-label={`Show ${label} larger`}
        className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <DeckSlidePreview
          presentationRef={presentationRef}
          pageIndex={pageIndex}
          className=""
          size="thumb"
        />
      </button>
      {enlarged ? (
        <button
          type="button"
          aria-label="Close the slide"
          onClick={() => setEnlarged(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/60 p-4"
        >
          <span className="block w-full max-w-3xl">
            <DeckSlidePreview
              presentationRef={presentationRef}
              pageIndex={pageIndex}
              className=""
            />
          </span>
        </button>
      ) : null}
    </>
  );
}

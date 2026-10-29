"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/auth/nativeSignIn";

/* Marks <html data-app="native"> inside the iPhone app (backend N267), so a
 * class can differ there with Tailwind's `app:` variant (tailwind.config.ts).
 * The app keeps the page clear of the home bar itself, so the footer needs
 * less padding there than in Safari (founder, 2026-10-29). Renders nothing. */
export default function NativeAppMarker() {
  useEffect(() => {
    if (isNativeApp()) document.documentElement.dataset.app = "native";
  }, []);
  return null;
}

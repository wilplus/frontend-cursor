"use client";

import { useEffect } from "react";
import { watchLaunchScreen } from "@/lib/phone/launchScreen";

/* In the iPhone app, ends the launch screen once the page has drawn (backend
 * N661 item 2; src/lib/phone/launchScreen.ts). Renders nothing, and does
 * nothing in a browser. */
export default function NativeLaunchScreen() {
  useEffect(() => watchLaunchScreen(document, window), []);
  return null;
}

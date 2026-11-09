"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/auth/nativeSignIn";

/* The keyboard in the iPhone app (backend N561 item 2). The keyboard plugin
 * works natively, set in capacitor.config.ts: it hides the grey bar with the
 * arrows and "Done", and shrinks the page to the space above the keyboard,
 * so the text box sits on it. No script of the plugin is loaded here.
 *
 * What this adds: while the keyboard is up, <html data-keyboard="open">, and
 * the footer goes behind the keyboard (globals.css), as an app's tab bar
 * does, rather than riding up between the text box and the keyboard. The
 * plugin tells the page with its own window events. Builds without the
 * plugin send none, and on the web nothing happens. Renders nothing. */
export default function NativeKeyboard() {
  useEffect(() => {
    if (!isNativeApp()) return;
    const root = document.documentElement;
    const shown = () => {
      root.dataset.keyboard = "open";
    };
    const hidden = () => {
      delete root.dataset.keyboard;
    };
    window.addEventListener("keyboardWillShow", shown);
    window.addEventListener("keyboardWillHide", hidden);
    return () => {
      window.removeEventListener("keyboardWillShow", shown);
      window.removeEventListener("keyboardWillHide", hidden);
      hidden();
    };
  }, []);
  return null;
}

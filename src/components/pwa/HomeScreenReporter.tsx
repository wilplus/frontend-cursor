"use client";

import { useEffect } from "react";

/* Tells the backend, once per device, that this person opened WillpowerLab
 * from their home screen, so the admin profile can show it (founder
 * 2026-10-13). Guests get a 401 and nothing happens. */
const KEY = "willab:home-screen-reported:v1";

export default function HomeScreenReporter() {
  useEffect(() => {
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((window.navigator as { standalone?: boolean }).standalone);
      if (!standalone || localStorage.getItem(KEY)) return;
      void fetch("/api/v2/user/home-screen", { method: "PUT" })
        .then((r) => {
          if (r.ok) localStorage.setItem(KEY, "1");
        })
        .catch(() => undefined);
    } catch {
      // Storage blocked: report again next time, which the backend ignores.
    }
  }, []);
  return null;
}

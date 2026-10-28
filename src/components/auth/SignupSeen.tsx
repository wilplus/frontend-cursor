"use client";

import { useEffect } from "react";

/* -------------------------------------------------------------------------- */
/*  SignupSeen — counts the sign-up screen once per browser tab (backend N207 */
/*  item 6; N174 item 6: "First count how many people leave at the sign-up    */
/*  screen"). The backend keeps a number a day and nothing about the person.   */
/*  Draws nothing; a count that fails is lost, never the screen.               */
/* -------------------------------------------------------------------------- */

const KEY = "willab:signup-seen";

export default function SignupSeen() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* storage blocked: count this opening anyway */
    }
    void fetch("/api/v2/signup/seen", { method: "POST" }).catch(() => undefined);
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bookingUrl, readBookingReturn } from "@/lib/booking/returnTo";

/** Side-effect only: a person who left the booking page to sign in or sign
 *  up goes straight back to it, with their time open, once signed in. */
export default function BookingReturn() {
  const pathname = usePathname() || "";
  useEffect(() => {
    if (pathname.startsWith("/book") || pathname.startsWith("/auth") ||
        pathname === "/login" || pathname === "/signup") return;
    const pending = readBookingReturn();
    if (!pending) return;
    const supabase = createClient();
    const go = () => window.location.replace(bookingUrl(pending));
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) go();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.access_token) go();
    });
    return () => subscription.unsubscribe();
  }, [pathname]);
  return null;
}

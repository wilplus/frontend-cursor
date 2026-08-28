"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";


export function useUserEmail(): string | null | undefined {
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (active) setEmail(session?.user?.email?.trim().toLowerCase() ?? null);
      })
      .catch(() => {
        if (active) setEmail(null);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email?.trim().toLowerCase() ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return email;
}

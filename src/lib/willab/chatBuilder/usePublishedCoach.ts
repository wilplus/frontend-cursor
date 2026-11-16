"use client";

import { useEffect, useState } from "react";
import { readActiveCoach } from "@/services/api/chatBuilder";
import type { CoachDefinition } from "./types";

/** The coach published to this person. Null is today's hardcoded walk.
    Tests do not call the network. */
export function usePublishedCoach(): CoachDefinition | null {
  const [doc, setDoc] = useState<CoachDefinition | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    let live = true;
    void readActiveCoach().then((got) => {
      if (live) setDoc(got);
    });
    return () => {
      live = false;
    };
  }, []);
  return doc;
}

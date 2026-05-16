"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * / — legacy redirect.
 *
 * The cold-start onboarding moved onto /chat as part of the unified
 * conversation surface (record → metrics → signup → welcome → Q&A
 * all inside one continuous thread). The standalone HeroRecorder
 * landing was retired; any direct hits to the root bounce through
 * here into /chat. The chat page's own phase machine decides what to
 * render based on auth state + URL params (anonymous → new cold-
 * start onboarding; signed-in with session → review/roleplay loop).
 *
 * Replaces the old HeroRecorder + ExplainerVideo + ProcessingScreen
 * orchestration. Kept as a client component so the redirect happens
 * pre-paint without flashing the SSR placeholder.
 */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/chat");
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </main>
  );
}

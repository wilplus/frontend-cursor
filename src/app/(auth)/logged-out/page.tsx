import Link from "next/link";
import type { Metadata } from "next";
import WillabLogo from "@/components/WillabLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Logged Out | Willab",
};

export default function LoggedOutPage() {
  return (
    <div className="relative flex min-h-screen min-h-[100dvh] items-center justify-center bg-background px-4 py-10 sm:px-6">
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <WillabLogo size="lg" />
      </div>

      <Card className="w-full max-w-md border-0 bg-transparent p-6 sm:p-8 shadow-none">
        <div className="flex flex-col items-center w-full max-w-[280px] mx-auto space-y-4">
          <div className="w-full rounded-3xl border border-border bg-muted/40 px-5 py-6 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 6v6l4 2" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-lg font-semibold text-foreground">Your homework is being reviewed</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Artur is analysing your homework and will send you the grading and comment soon. If you pass, we
                will see each other in the next step!
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                We&apos;ll email you when your next homework is ready.
              </p>
            </div>
          </div>

          <div className="w-full space-y-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Security note</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Logging out between sessions helps keep your connection secure on shared devices.
            </p>
          </div>
          <Button asChild className="w-full rounded-xl h-12 font-semibold">
            <Link href="/login">Sign in again</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

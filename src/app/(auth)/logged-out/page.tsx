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

      <Card className="w-full max-w-md border border-border/60 bg-card/80 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <h1 className="text-xl font-semibold text-foreground">Waiting for your next assignment</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You have been logged out successfully.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Logging out helps keep your connection secure between sessions.
        </p>

        <Button asChild className="mt-6 w-full">
          <Link href="/login">Sign in again</Link>
        </Button>
      </Card>
    </div>
  );
}

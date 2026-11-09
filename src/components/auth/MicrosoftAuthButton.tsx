"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { rememberOAuthStart } from "@/lib/auth/oauthRetry";
import { startOAuth } from "@/lib/auth/startOAuth";

/** The signed word (backend N401 items 6 and 7). */
export const MICROSOFT_LABEL = "Microsoft";

/** The Microsoft button shows only once the founder has turned Microsoft on
 *  in the Supabase project (Auth → Providers → Azure, with a Microsoft app's
 *  id and secret) and set NEXT_PUBLIC_MICROSOFT_SIGNIN=on: without the
 *  provider the redirect fails with "Unsupported provider", so the button
 *  stays hidden until then. */
export function microsoftSignInOn(): boolean {
  return process.env.NEXT_PUBLIC_MICROSOFT_SIGNIN === "on";
}

/**
 * Microsoft sign-in, beside Google (backend N401 item 6). Supabase's provider
 * for it is "azure"; the same callback chain as Google and LinkedIn, and the
 * same one restart on a replayed state (oauthRetry.ts).
 */
export default function MicrosoftAuthButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  const handleMicrosoft = async () => {
    setLoading(true);
    try {
      rememberOAuthStart("azure");
      const failure = await startOAuth("azure");
      if (!failure) return; // navigating to Microsoft
      toast.error(failure.error === "provider" && failure.message ? failure.message : "Something went wrong. Please try again.");
      setLoading(false);
    } catch (err) {
      console.error("Microsoft OAuth exception:", err);
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={`w-full gap-2 font-medium ${className ?? ""}`}
      onClick={handleMicrosoft}
      disabled={loading}
      data-auth-microsoft=""
    >
      <MicrosoftIcon className="h-[18px] w-[18px] shrink-0" />
      <span>{loading ? "Connecting..." : MICROSOFT_LABEL}</span>
    </Button>
  );
}

/** Microsoft's four squares, in black and white like the other small logos
 *  (backend N232). */
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="2" y="2" width="9.5" height="9.5" />
      <rect x="12.5" y="2" width="9.5" height="9.5" />
      <rect x="2" y="12.5" width="9.5" height="9.5" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" />
    </svg>
  );
}

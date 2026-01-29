'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function ResetPasswordForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  
  // Check for error parameter from callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "expired") {
      toast.error("The reset link has expired. Please request a new one.");
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Go directly to update-password - it's already whitelisted and can handle hash fragments
      // This simplifies the flow and avoids redirect chain issues
      const redirectUrl = `${window.location.origin}/update-password`;
      
      console.log("[ResetPassword] Sending reset email with redirect:", redirectUrl);
      console.log("[ResetPassword] This URL must be whitelisted in Supabase:", redirectUrl);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast.error(error.message || "Reset failed");
        return;
      }

      setSent(true);
      toast.success("Check your email for reset link");
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Card className="p-6 text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          Check your email for a password reset link. It will expire in 1 hour.
        </p>
        <Link
          href="/login"
          className="text-sm text-orange-500 hover:underline"
        >
          Back to login
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Email</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <div className="mt-4 text-center text-sm">
        <Link href="/login" className="text-orange-500 hover:underline">
          Back to login
        </Link>
      </div>
    </Card>
  );
}


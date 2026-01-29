'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function ChangePasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Only show the form when we have a session, so "Update password" never hits "Auth session missing!"
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      for (let i = 0; i < 8; i++) {
        if (cancelled) return;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setSessionReady(true);
            return;
          }
        } catch (_) {
          // retry
        }
        if (i < 7) await new Promise((r) => setTimeout(r, 300));
      }
      if (!cancelled) {
        toast.error("Please log in to change your password.");
        router.replace("/login");
      }
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setSessionReady(true);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        const isSessionError =
          error.message?.includes("session") ||
          error.message?.includes("Auth session missing") ||
          error.message?.toLowerCase().includes("jwt");
        if (isSessionError) {
          toast.error("Your session expired. Please log in again.");
          router.replace("/login");
          return;
        }
        toast.error(error.message || "Failed to update password");
        return;
      }

      toast.success("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err: unknown) {
      console.error("[ChangePassword] Error:", err);
      const message = err instanceof Error ? err.message : String(err);
      const isSessionMissing =
        message.includes("Auth session missing") || message.includes("session");
      const isNetwork =
        message === "Load failed" ||
        message === "Failed to fetch" ||
        message.includes("network");
      if (isSessionMissing) {
        toast.error("Your session expired. Please log in again.");
        router.replace("/login");
        return;
      }
      if (isNetwork) {
        toast.error("Network error. Check your connection and try again.");
      } else {
        toast.error(message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!sessionReady) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Update your password</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Enter a new password below. You will stay logged in.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">New password</label>
          <Input
            type="password"
            placeholder="At least 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">
            Confirm new password
          </label>
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm">
        <Link href="/dashboard" className="text-orange-500 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </Card>
  );
}

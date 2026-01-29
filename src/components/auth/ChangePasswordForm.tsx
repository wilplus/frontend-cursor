'use client';

import { useState } from "react";
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
      const isNetwork =
        message === "Load failed" ||
        message === "Failed to fetch" ||
        message.includes("network");
      if (isNetwork) {
        toast.error("Network error. Check your connection and try again.");
      } else {
        toast.error(message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

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

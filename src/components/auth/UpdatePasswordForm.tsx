'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function UpdatePasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user has a valid session (from password reset link)
    // Add a small delay to ensure cookies are set from the callback
    const checkSession = async () => {
      // Wait a bit for cookies to be set from the redirect
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        // First, try to get the session
        let { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // If no session, wait a bit more and try again (cookies might still be setting)
        if (!session) {
          console.log("[UpdatePassword] No session found, waiting and retrying...");
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryResult = await supabase.auth.getSession();
          session = retryResult.data?.session || null;
        }
        
        // If still no session, try to refresh it
        if (!session) {
          console.log("[UpdatePassword] Still no session, trying to refresh...");
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error("[UpdatePassword] Refresh error:", refreshError);
          }
          
          session = refreshData?.session || null;
        }
        
        if (!session) {
          console.error("[UpdatePassword] No session available after all attempts");
          toast.error("Invalid or expired reset link. Please request a new one.");
          setTimeout(() => {
            router.push("/reset-password");
          }, 2000);
          return;
        }

        console.log("[UpdatePassword] Session found, user:", session.user.email);
        setCheckingSession(false);
      } catch (error) {
        console.error("Error checking session:", error);
        toast.error("Error verifying reset link. Please try requesting a new one.");
        setTimeout(() => {
          router.push("/reset-password");
        }, 2000);
      }
    };

    checkSession();
  }, [supabase, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message || "Failed to update password");
        return;
      }

      toast.success("Password updated successfully!");
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Verifying reset link...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">New Password</label>
          <Input
            type="password"
            placeholder="Enter new password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Confirm Password</label>
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Password"}
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

'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface LoginFormProps {
  onSuccess?: () => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps = {}) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Clear any stale session/refresh token so we don't get "Refresh Token Not Found" after login
      await supabase.auth.signOut();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error);
        
        // Handle specific errors
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password");
          return;
        }
        
        if (error.message.includes("Email not confirmed")) {
          toast.error("Please check your email and confirm your account first");
          return;
        }
        
        toast.error(error.message || "Login failed");
        return;
      }

      // Verify session was created
      const { data: { session: newSession } } = await supabase.auth.getSession();
      
      if (!newSession) {
        toast.error("Session not created. Please try again.");
        return;
      }

      // Call server route to ensure httpOnly cookies are set server-side
      try {
        const confirmRes = await fetch("/api/auth/confirm-session", {
          method: "POST",
          credentials: "include", // Important: include cookies
        });

        if (!confirmRes.ok) {
          console.error("Failed to confirm session on server");
        }
      } catch (err) {
        console.error("Error confirming session:", err);
      }

      // Check for redirectTo parameter (from email links or protected routes)
      const searchParams = new URLSearchParams(window.location.search);
      const redirectTo = searchParams.get("redirectTo");
      
      // Brief delay so cookies are committed before navigation
      await new Promise((r) => setTimeout(r, 200));
      
      if (onSuccess) {
        onSuccess();
        return;
      }
      setTimeout(() => {
        if (redirectTo) {
          const decodedRedirect = decodeURIComponent(redirectTo);
          router.push(decodedRedirect);
        } else {
          router.push("/dashboard");
        }
      }, 100);
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="min-w-0 p-4 sm:p-6">
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="mb-2 block text-base font-medium sm:text-sm">Email</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="mb-2 block text-base font-medium sm:text-sm">Password</label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="mt-4 space-y-2 text-center text-base sm:text-sm">
        <p>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-orange-500 hover:underline">
            Sign up
          </Link>
        </p>
        <p>
          <Link
            href="/reset-password"
            className="text-orange-500 hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </div>
    </Card>
  );
}


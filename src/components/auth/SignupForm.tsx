'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function SignupForm() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name.trim(),
            display_name: name.trim(),
          },
          // Disable email confirmation for testing (if enabled in Supabase)
          emailRedirectTo: undefined,
        },
      });

      if (error) {
        console.error("Signup error:", error);
        
        // Handle specific Supabase errors with user-friendly messages
        if (error.message.includes("User already registered")) {
          toast.error("This email is already registered. Please sign in instead.");
          router.push("/login");
          return;
        }
        
        if (error.message.includes("Database error")) {
          toast.error(
            "Database error: Please check your Supabase project settings. This is usually caused by database triggers or RLS policies."
          );
          console.error(
            "Supabase Database Error - Check:\n" +
            "1. Supabase Dashboard → Logs → Auth/Postgres\n" +
            "2. Database triggers on auth.users table\n" +
            "3. RLS policies on related tables\n" +
            "4. Database connection/status"
          );
          return;
        }
        
        toast.error(error.message || "Signup failed");
        return;
      }

      if (data.user) {
        toast.success("Account created! Redirecting...");
        
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

        // Small delay then redirect
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 100);
      }
    } catch (err) {
      console.error("Signup exception:", err);
      if (err instanceof Error) {
        if (err.message.includes("CORS") || err.message.includes("access control")) {
          toast.error(
            "CORS error: Please check your Supabase URL and CORS settings in your Supabase project dashboard."
          );
        } else {
          toast.error(err.message || "An unexpected error occurred");
        }
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Name</label>
          <Input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
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
        <div>
          <label className="mb-2 block text-sm font-medium">Password</label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">
            Confirm Password
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Sign up"}
        </Button>
      </form>

      <div className="mt-4 text-center text-sm">
        <p>
          Already have an account?{" "}
          <Link href="/login" className="text-orange-500 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </Card>
  );
}


"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";

interface FunnelSignupFormProps {
  guestSessionId: string;
  onComplete: () => void;
}

export default function FunnelSignupForm({
  guestSessionId,
  onComplete,
}: FunnelSignupFormProps) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const claimRecording = async (accessToken: string) => {
    try {
      await fetch("/api/public/shaky-voice/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ guest_session_id: guestSessionId }),
      });
    } catch {
      // Non-blocking — backend can reconcile later
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
            guest_session_id: guestSessionId,
          },
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          toast.error("This email is already registered. Try logging in.");
          return;
        }
        toast.error(error.message || "Signup failed");
        return;
      }

      if (data.session?.access_token) {
        await claimRecording(data.session.access_token);
      }

      try {
        await fetch("/api/auth/confirm-session", {
          method: "POST",
          credentials: "include",
        });
      } catch {}

      onComplete();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Your voice analysis is ready
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a free account to see your results
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="6+ characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600"
            disabled={loading}
          >
            {loading ? "Creating account..." : "See my voice analysis"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-orange-500 hover:underline">
            Log in
          </Link>
        </div>
      </Card>
    </div>
  );
}

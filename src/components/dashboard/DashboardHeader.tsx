"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DashboardHeader() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      toast.success("Logged out");
      router.push("/login");
    } catch (err) {
      console.error(err);
      toast.error("Logout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <h1 className="text-2xl font-bold">Willab</h1>
        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="text-sm text-muted-foreground">
              {userEmail}
            </span>
          )}
          <Link
            href="/change-password"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Change password
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </div>
    </header>
  );
}


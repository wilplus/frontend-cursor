"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DashboardHeader() {
  const router = useRouter();
  const supabase = createClient();
  const abandonCurrentSession = useSessionStore((s) => s.abandonCurrentSession);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    abandonCurrentSession();
    router.push("/dashboard");
  };

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
        <Link
          href="/dashboard"
          onClick={handleLogoClick}
          className="text-2xl font-bold hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          Willab
        </Link>
        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="text-sm text-muted-foreground">
              {userEmail}
            </span>
          )}
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


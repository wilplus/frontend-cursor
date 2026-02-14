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
      <div className="mx-auto flex max-w-4xl min-w-0 items-center justify-between gap-2 px-4 py-4 sm:px-8 sm:gap-4 lg:px-10">
        <Link
          href="/dashboard"
          className="shrink-0 text-xl font-bold hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded sm:text-2xl"
        >
          Willab
        </Link>
        <div className="flex min-w-0 shrink items-center gap-2 sm:gap-4">
          {userEmail && (
            <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block sm:max-w-[12rem] lg:max-w-[14rem]">
              {userEmail}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={loading}
            className="shrink-0"
          >
            {loading ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </div>
    </header>
  );
}


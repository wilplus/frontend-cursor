"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchAdminRecordings } from "@/lib/api/client";
import { toast } from "sonner";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

/**
 * Component that checks if the user is an admin.
 * If not, shows an error message and redirects to login.
 */
export default function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    setLoading(true);
    try {
      // Try to fetch admin recordings - if successful, user is admin
      await fetchAdminRecordings(1, 0);
      setIsAdmin(true);
    } catch (error: any) {
      console.error("Admin check failed:", error);
      
      // Check if it's a 403 (forbidden) or 401 (unauthorized)
      if (error.message?.includes("403") || error.message?.includes("Forbidden")) {
        setIsAdmin(false);
        toast.error("You don't have admin access");
      } else if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
        setIsAdmin(false);
        toast.error("Please log in to access admin dashboard");
        // Preserve current URL for redirect after login (including all query params)
        const currentUrl = window.location.pathname + window.location.search;
        const loginUrl = `/login?redirectTo=${encodeURIComponent(currentUrl)}`;
        console.log("[AdminAuthGuard] Redirecting to login, preserving URL:", currentUrl);
        setTimeout(() => {
          router.push(loginUrl);
        }, 2000);
      } else {
        // Other error - might be network issue, allow access but show warning
        console.warn("Could not verify admin status, allowing access:", error);
        setIsAdmin(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="p-6">
          <p className="text-muted-foreground text-center">Verifying admin access...</p>
        </Card>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access the admin dashboard. Only administrators can view this page.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/dashboard")} variant="outline">
              Go to Dashboard
            </Button>
            <Button onClick={() => router.push("/login")}>
              Log In
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

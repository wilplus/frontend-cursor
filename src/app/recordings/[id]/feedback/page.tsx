"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

/**
 * Feedback is sent only from the admin panel. This page redirects to the student
 * profile so the admin can use the Admin Feedback section at the top.
 */
export default function AdminFeedbackRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id");

  useEffect(() => {
    if (userId) {
      router.replace(`/admin/students/${userId}`);
    } else {
      router.replace("/admin/students");
    }
  }, [userId, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <p className="text-muted-foreground">Redirecting to admin panel…</p>
    </div>
  );
}

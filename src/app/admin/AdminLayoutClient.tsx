"use client";

import { usePathname, useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { createClient } from "@/lib/supabase/client";

export default function AdminLayoutClient({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const onLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  // The unified User Dashboard (/admin/users/**) ships its own sticky header
  // per the spec. Skip AdminShell's chrome there so we don't stack two
  // headers; auth is still enforced by /admin/layout.tsx upstream.
  const isUnifiedUserView = pathname?.startsWith("/admin/users");
  if (isUnifiedUserView) {
    return <>{children}</>;
  }

  return (
    <AdminShell email={email} onLogout={onLogout}>
      {children}
    </AdminShell>
  );
}

"use client";

import { useRouter } from "next/navigation";
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

  const onLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <AdminShell email={email} onLogout={onLogout}>
      {children}
    </AdminShell>
  );
}

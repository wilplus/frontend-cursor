import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login?redirectTo=" + encodeURIComponent("/admin"));
  }

  const email = session.user.email ?? null;

  return (
    <AdminLayoutClient email={email}>
      {children}
    </AdminLayoutClient>
  );
}

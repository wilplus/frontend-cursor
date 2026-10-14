import AdminMenu from "@/components/admin/AdminMenu";

/** Every admin page sits inside the admin menu (founder 2026-10-14). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminMenu>{children}</AdminMenu>;
}

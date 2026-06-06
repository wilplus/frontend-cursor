import type { Metadata } from "next";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";

export const metadata: Metadata = {
  title: "Change Password | WillpowerLab",
};

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mx-auto max-w-md">
          <h1 className="mb-2 text-2xl font-bold">Change password</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Set a new password for your account.
          </p>
          <ChangePasswordForm />
        </div>
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import UpdatePasswordForm from "@/components/auth/UpdatePasswordForm";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "Update Password | WillpowerLab",
};

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="flex justify-center">
            <Logo size="lg" />
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Set your new password below. You are not signed in yet — after saving, you’ll sign in with your new password.
          </p>
        </div>
        <Suspense fallback={
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        }>
          <UpdatePasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

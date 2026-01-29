import type { Metadata } from "next";
import { Suspense } from "react";
import UpdatePasswordForm from "@/components/auth/UpdatePasswordForm";

export const metadata: Metadata = {
  title: "Update Password | Willab",
};

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Willab</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your new password below
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

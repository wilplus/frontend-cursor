import type { Metadata } from "next";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password | willab - willpower lab 🎙️",
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">willab - willpower lab 🎙️</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reset your password
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}


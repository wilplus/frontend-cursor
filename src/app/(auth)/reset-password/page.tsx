import type { Metadata } from "next";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "Reset Password | WillpowerLab",
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="flex justify-center">
            <Logo size="lg" />
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reset your password
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}


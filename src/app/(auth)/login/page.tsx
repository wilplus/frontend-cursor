import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "Login | WillpowerLab",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full min-w-0 max-w-md">
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="flex justify-center">
            <Logo size="lg" />
          </h1>
          {/* No line under the logo (founder 2026-10-28, backend N232). */}
        </div>
        <LoginForm />
      </div>
    </div>
  );
}


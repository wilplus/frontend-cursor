import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";
import SignupSeen from "@/components/auth/SignupSeen";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "Sign Up | WillpowerLab",
};

export default function SignupPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="flex justify-center">
            <Logo size="lg" />
          </h1>
          {/* No line under the logo (founder 2026-10-28, backend N232). */}
        </div>
        <SignupForm />
        <SignupSeen />
      </div>
    </div>
  );
}


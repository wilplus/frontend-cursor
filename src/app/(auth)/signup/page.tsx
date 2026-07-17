import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";
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
          {/* Honest positioning (founder 2026-07-17): this screen follows the
              user's first recording, so "minutes away" is a promise we keep. */}
          <p className="mt-2 text-sm text-muted-foreground">
            Your ideal text is minutes away
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}


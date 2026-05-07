import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";
import WillabLogo from "@/components/WillabLogo";

export const metadata: Metadata = {
  title: "Sign Up | Willab",
};

export default function SignupPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="flex justify-center">
            <WillabLogo size="lg" />
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Turning stress into charisma
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}


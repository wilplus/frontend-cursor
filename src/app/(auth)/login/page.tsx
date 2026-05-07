import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";
import WillabLogo from "@/components/WillabLogo";

export const metadata: Metadata = {
  title: "Login | Willab",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full min-w-0 max-w-md">
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="flex justify-center">
            <WillabLogo size="lg" />
          </h1>
          <p className="mt-2 text-base text-muted-foreground sm:text-sm">
            Turning stress into charisma
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}


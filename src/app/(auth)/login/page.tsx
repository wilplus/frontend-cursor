import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login | willab - willpower lab 🎙️",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full min-w-0 max-w-md">
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">willab - willpower lab 🎙️</h1>
          <p className="mt-2 text-base text-muted-foreground sm:text-sm">
            willpower lab for your confidence on stage
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}


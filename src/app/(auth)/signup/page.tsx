import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Sign Up | willab - willpower lab 🎙️",
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">willab - willpower lab 🎙️</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            willpower lab for your confidence on stage
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}


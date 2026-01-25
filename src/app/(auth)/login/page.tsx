import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login | Willab",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Willab</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Communication coaching through interview practice
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}


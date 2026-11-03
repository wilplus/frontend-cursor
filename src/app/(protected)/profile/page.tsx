"use client";

import { useRouter } from "next/navigation";
import Profile from "@/components/willab/chats/Profile";

/** Your own profile (backend N366), opened from the top of the ☰ menu. Back
 *  returns to where you were, or to /chat when nothing is behind it. */
export default function ProfilePage() {
  const router = useRouter();
  const back = () => (window.history.length > 1 ? router.back() : router.push("/chat"));
  return (
    <main className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden">
      <Profile onBack={back} />
    </main>
  );
}

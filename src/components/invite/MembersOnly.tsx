"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import LoadingState from "@/components/willab/LoadingState";
import { useSignedIn } from "@/components/willab/useSignedIn";
import { getAccess, type Access } from "@/services/api/access";
import WaitingScreen from "./WaitingScreen";

/* -------------------------------------------------------------------------- */
/*  Members only (backend N471): the app is for signed-in members. Signed     */
/*  out, the app sends you to the first page (the guest path is off); on the */
/*  waitlist, you see "You're on the waitlist"; a member gets the app as it  */
/*  was. The coach's link opens as before: a coach is a member.              */
/* -------------------------------------------------------------------------- */

export default function MembersOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    if (signedIn === false) {
      const back = `${window.location.pathname}${window.location.search}`;
      router.replace(back.startsWith("/chat?") ? `/login?redirectTo=${encodeURIComponent(back)}` : "/");
      return;
    }
    if (signedIn !== true) return;
    let active = true;
    void getAccess().then((answer) => {
      if (active) setAccess(answer);
    });
    return () => {
      active = false;
    };
  }, [signedIn, router]);

  if (signedIn !== true || access === null) return <LoadingState placement="viewport" />;
  if (access === "waiting") return <WaitingScreen />;
  return <>{children}</>;
}

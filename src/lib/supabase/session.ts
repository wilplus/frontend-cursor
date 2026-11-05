import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/*  readSession — one read of the stored session at a time (2026-11-05)        */
/*                                                                            */
/*  supabase-js answers getSession() inside a lock shared by every tab        */
/*  (navigator.locks), one caller at a time, and each turn of that lock is a  */
/*  round trip to the browser and a task of its own. A /chat open asked it   */
/*  about seventy times: every useSignedIn, useUserId and useUserEmail, the   */
/*  menu, and every BFF call's Bearer (getAuthToken), most of them in the     */
/*  same moment. Measured on an emulated phone (4x CPU), the last of a burst  */
/*  waited 0.4 to 0.6 s for its turn, holding the lock for a millisecond:     */
/*  the list of chats waited on that queue, not on the network.               */
/*                                                                            */
/*  Callers that ask while a read is out now share it. The next ask after it  */
/*  has answered reads again, so a sign-in, a sign-out or a refreshed token   */
/*  is seen exactly as before; supabase-js still refreshes an expired token   */
/*  inside the read, once, for everyone waiting on it. Nothing is cached.    */
/* -------------------------------------------------------------------------- */

let inFlight: Promise<Session | null> | null = null;

/** The stored session, or null signed out. Rejects as getSession would. */
export function readSession(): Promise<Session | null> {
  if (!inFlight) {
    let read: Promise<Session | null>;
    try {
      read = createClient()
        .auth.getSession()
        .then(({ data }) => data.session ?? null);
    } catch (error) {
      return Promise.reject(error); // no client (missing env): as getSession's caller saw it
    }
    inFlight = read;
    const done = () => {
      if (inFlight === read) inFlight = null;
    };
    read.then(done, done);
  }
  return inFlight;
}

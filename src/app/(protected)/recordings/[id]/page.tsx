import { redirect } from "next/navigation";

/**
 * The old per-recording page is retired (WIL-78, founder 2026-10-19): it
 * showed speakers words per minute and a filler count (Never rule 1).
 * Nothing links here any more. Its id is a recording id, and the Ideal Text
 * opens by arc id, which only the backend can resolve, so an old bookmark
 * lands in the Lounge, where every Take's Ideal Text and feedback opens.
 */
export default function RetiredRecordingPage(): never {
  redirect("/chat");
}

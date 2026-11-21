import { redirect } from "next/navigation";

/** The old audit/transcript list is now the project conversation. */
export default function AuditsPage(): never {
  redirect("/chat");
}

import { redirect } from "next/navigation";

/** The old feedback/transcript screen is retired; feedback now opens from the
 * project conversation's exact Take. */
export default function RetiredFeedbackPage(): never {
  redirect("/chat");
}

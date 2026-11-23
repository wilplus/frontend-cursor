import type { ReactNode } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { aiGeneratedAttrs } from "@/lib/willab/aiGeneratedMark";
import AiGeneratedNote from "./AiGeneratedNote";
import OverlayCloseButton from "./OverlayCloseButton";
import { ConversationDocument } from "./chats/TakeConversation";

export default function IdealTextDocument({ name, take, menu, onClose, children }: {
  name?: string | null;
  take?: number | null;
  menu?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
}) {
  const title = useUiLocale() === "pl" ? "Idealny tekst" : "Ideal text";
  return (
    <ConversationDocument title={title} stickyHeader={Boolean(onClose)} actions={menu || onClose ? (
      <div className="flex items-center gap-1.5">
        {menu}
        {onClose ? <OverlayCloseButton onClick={onClose} /> : null}
      </div>
    ) : undefined}>
      <div {...aiGeneratedAttrs("ideal-text")} className="space-y-4">
        <AiGeneratedNote kind="ideal-text" name={name} take={take} />
        {children}
      </div>
    </ConversationDocument>
  );
}

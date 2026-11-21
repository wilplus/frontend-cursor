import { CHAT_FAILURE_BODY } from "@/lib/willab/projectChat";

export function ChatTurnRetry({ onRetry, disabled }: { onRetry: () => void; disabled: boolean }) {
  return (
    <div data-chat-turn-error role="alert" className="mr-auto max-w-[86%] rounded-[18px] bg-muted px-4 py-2.5 text-[15px]">
      {CHAT_FAILURE_BODY}
      <button type="button" disabled={disabled} onClick={onRetry} className="block py-1 underline disabled:opacity-50">
        Try again
      </button>
    </div>
  );
}

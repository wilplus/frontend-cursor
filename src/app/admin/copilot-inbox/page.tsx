import { Card } from "@/components/ui/card";

export default function AdminCopilotInboxPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Copilot Inbox</h1>
      <Card className="p-4 text-sm text-muted-foreground">
        Draft-first Copilot Inbox is enabled at the API layer in this repo.
        <br />
        UI implementation is tracked for the dedicated frontend delivery using:
        cohort stacks, student carousel, Block A/B editing, reason chips, and keyboard shortcuts.
      </Card>
    </div>
  );
}


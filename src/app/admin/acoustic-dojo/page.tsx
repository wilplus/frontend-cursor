import { Card } from "@/components/ui/card";

export default function AdminAcousticDojoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Acoustic Dojo</h1>
      <Card className="p-4 text-sm text-muted-foreground">
        Acoustic Dojo backend hooks are available in this repo:
        <br />
        audio-only next-clip fetch and label submission endpoints for stress/charisma + confidence.
      </Card>
    </div>
  );
}


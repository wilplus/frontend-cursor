"use client";

import { Card } from "@/components/ui/card";

export default function UploadingSpinner({ label }: { label: string }) {
  return (
    <Card className="p-6 border-0 bg-transparent shadow-none">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <h3 className="text-lg font-semibold">{label}</h3>
        <p className="text-sm text-muted-foreground">Please wait…</p>
      </div>
    </Card>
  );
}

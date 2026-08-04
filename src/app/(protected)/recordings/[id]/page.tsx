"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchRecording } from "@/lib/api/client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CompletedCard from "@/components/session/CompletedCard";
import LoadingState from "@/components/willab/LoadingState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { GetRecordingResponse } from "@/lib/api/types";

export default function RecordingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [recording, setRecording] = useState<GetRecordingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadRecording = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRecording(id);
        setRecording(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load recording";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadRecording();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <Card className="p-6">
            <LoadingState />
          </Card>
        </main>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <Card className="p-6">
            <div className="text-center space-y-4">
              <p className="text-destructive">{error || "Recording not found"}</p>
              <Button onClick={() => router.push("/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          ← Back to Dashboard
        </Button>
        <CompletedCard recording={recording} />
      </main>
    </div>
  );
}

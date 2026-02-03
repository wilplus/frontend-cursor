"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { fetchAdminRecordings } from "@/lib/api/client";
import type { RecordingForAdmin } from "@/lib/api/types";
import { toast } from "sonner";
import AdminRecordingsList from "@/components/admin/AdminRecordingsList";

export default function AdminRecordingsPage() {
  const [recordings, setRecordings] = useState<RecordingForAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const response = await fetchAdminRecordings(20, 0);
      setRecordings(response.recordings);
      setTotal(response.total || 0);
    } catch (error) {
      console.error("Failed to load recordings:", error);
      toast.error("Failed to load recordings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recordings</h1>
        <p className="text-muted-foreground mt-2">
          Review recordings and provide feedback to improve AI analysis quality
        </p>
      </div>
      <AdminRecordingsList initialRecordings={recordings} initialTotal={total} />
    </div>
  );
}

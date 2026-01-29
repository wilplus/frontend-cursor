"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthReady } from "@/hooks/useAuthReady";
import { fetchUserRecordings } from "@/lib/api/client";
import { fetchRecordingDetail } from "@/lib/api/client-recordings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { RecordingListItemLite, GetRecordingResponse } from "@/lib/api/types";
import { formatDistanceToNow } from "date-fns";

const LIMIT = 10;

export default function HistorySection() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<RecordingListItemLite[]>([]);
  const [details, setDetails] = useState<Map<string, GetRecordingResponse>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const authReady = useAuthReady();

  const loadRecordings = useCallback(async (currentOffset: number) => {
    if (currentOffset === 0) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      console.log(`[HistorySection] Fetching recordings: offset=${currentOffset}, limit=${LIMIT}`);
      const response = await fetchUserRecordings(LIMIT, currentOffset);
      
      console.log(`[HistorySection] Received response:`, {
        itemsCount: response?.items?.length || 0,
        total: response?.total,
        limit: response?.limit,
        offset: response?.offset,
        fullResponse: response,
      });
      
      // Store debug info
      setDebugInfo({
        response,
        timestamp: new Date().toISOString(),
        url: `/api/user/recordings?limit=${LIMIT}&offset=${currentOffset}`,
      });
      
      // Ensure items is always an array
      const items = response?.items || [];
      
      if (items.length === 0 && currentOffset === 0) {
        console.log("[HistorySection] No recordings found");
        console.log("[HistorySection] Full API response:", JSON.stringify(response, null, 2));
      }
      
      setRecordings((prev) =>
        currentOffset === 0 ? items : [...prev, ...items]
      );
      setHasMore(items.length === LIMIT);
      setOffset(currentOffset + items.length);

      // Fetch details for new items
      // Use functional update to access current details state
      setDetails((currentDetails) => {
        const newDetails = new Map(currentDetails);
        const itemsToFetch = items.filter((item) => !currentDetails.has(item.id));
        
        // Fetch details for items we don't have yet
        itemsToFetch.forEach((item) => {
          fetchRecordingDetail(item.id)
            .then((detail) => {
              setDetails((prev) => {
                const next = new Map(prev);
                next.set(item.id, detail);
                return next;
              });
            })
            .catch((err) => {
              console.error(`[HistorySection] Failed to fetch detail for ${item.id}:`, err);
              // Don't show toast for individual detail failures, just log
            });
        });
        
        return newDetails;
      });
    } catch (err) {
      console.error("[HistorySection] Failed to load recordings:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load recordings";
      setError(errorMessage);
      
      // Ensure recordings is always an array even on error
      if (currentOffset === 0) {
        setRecordings([]);
      }
      
      // Don't show error toast if it's a 401 (will redirect to login)
      if (err instanceof Error && !err.message.includes("401") && !err.message.includes("UNAUTHORIZED")) {
        toast.error(`Failed to load recordings: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) loadRecordings(0);
  }, [authReady, loadRecordings]);

  const handleLoadMore = () => {
    loadRecordings(offset);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading && (!recordings || recordings.length === 0)) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <p>Loading history...</p>
        </div>
      </Card>
    );
  }

  if (error && (!recordings || recordings.length === 0)) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">History</h3>
        <div className="text-center py-8 space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            onClick={() => loadRecordings(0)}
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!recordings || recordings.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">History</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? "Hide" : "Show"} Debug Info
          </Button>
        </div>
        
        {showDebug && debugInfo && (
          <div className="mb-4 p-4 bg-muted rounded-md text-xs font-mono overflow-auto max-h-96 space-y-4">
            <div>
              <p className="font-semibold mb-2">API Response Debug:</p>
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
            <div className="border-t pt-2">
              <p className="font-semibold mb-2">Debugging Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Open Browser DevTools (F12)</li>
                <li>Go to Console tab - look for [fetchUserRecordings] logs</li>
                <li>Go to Network tab - find the /api/user/recordings request</li>
                <li>Click on it and check the Response tab</li>
                <li>Check your Flask backend logs for errors</li>
              </ol>
            </div>
          </div>
        )}
        
        <div className="text-center py-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            No recordings yet. Start your first session to see it here.
          </p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>💡 Check the browser console (F12) for detailed logs.</p>
            <p>💡 Check the Network tab to see the API response.</p>
            <p>💡 Verify your Flask backend is returning recordings at <code>/user/recordings</code></p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log("[HistorySection] Manual refresh triggered");
              loadRecordings(0);
            }}
          >
            Refresh
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">History</h3>
      <div className="space-y-4">
        {(recordings || []).map((recording) => {
          const detail = details.get(recording.id);
          const date = new Date(recording.created_at);

          return (
            <Card
              key={recording.id}
              className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => router.push(`/recordings/${recording.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium">
                      {formatDistanceToNow(date, { addSuffix: true })}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(recording.duration)}
                    </span>
                  </div>

                  {detail ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          WPM: <span className="font-medium">{detail.metrics.wpm}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Fillers:{" "}
                          <span className="font-medium">
                            {detail.metrics.filler_count}
                          </span>
                        </span>
                      </div>
                      {detail.analysis.report && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {detail.analysis.report}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Loading details...
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </Card>
  );
}

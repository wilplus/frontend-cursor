"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAdminRecordings, getUserAdminContext } from "@/lib/api/client";
import type { RecordingForAdmin } from "@/lib/api/types";
import { toast } from "sonner";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";

interface AdminRecordingsListProps {
  initialRecordings?: RecordingForAdmin[];
  initialTotal?: number;
}

export default function AdminRecordingsList({
  initialRecordings = [],
  initialTotal = 0,
}: AdminRecordingsListProps) {
  const router = useRouter();
  const [recordings, setRecordings] = useState<RecordingForAdmin[]>(initialRecordings);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNeedsFeedback, setFilterNeedsFeedback] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [total, setTotal] = useState(initialTotal);
  const limit = 20;

  useEffect(() => {
    loadRecordings();
  }, [currentPage, filterNeedsFeedback]);

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const response = await fetchAdminRecordings(
        limit,
        currentPage * limit,
        filterNeedsFeedback || undefined
      );
      setRecordings(response.recordings);
      setTotal(response.total || 0);
    } catch (error) {
      console.error("Failed to load recordings:", error);
      toast.error("Failed to load recordings");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordingClick = (recording: RecordingForAdmin) => {
    router.push(`/recordings/${recording.recording_id}/feedback?user_id=${recording.user_id}`);
  };

  const filteredRecordings = recordings.filter((recording) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      recording.transcription_text?.toLowerCase().includes(query) ||
      recording.user_email?.toLowerCase().includes(query) ||
      recording.recording_id.toLowerCase().includes(query) ||
      recording.user_id.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by transcription, user email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={filterNeedsFeedback ? "default" : "outline"}
          onClick={() => {
            setFilterNeedsFeedback(!filterNeedsFeedback);
            setCurrentPage(0);
          }}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          {filterNeedsFeedback ? "Needs Feedback" : "All Recordings"}
        </Button>
      </div>

      {/* Recordings List */}
      {loading ? (
        <Card className="p-6">
          <p className="text-muted-foreground text-center">Loading recordings...</p>
        </Card>
      ) : filteredRecordings.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground text-center">
            {searchQuery
              ? "No recordings match your search."
              : filterNeedsFeedback
              ? "No recordings need feedback at this time."
              : "No recordings found."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRecordings.map((recording) => (
            <Card
              key={recording.recording_id}
              className="p-4 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => handleRecordingClick(recording)}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-medium">
                      {recording.user_email || `User ${recording.user_id.slice(0, 8)}`}
                    </p>
                    {recording.has_feedback && (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                        Has Feedback
                      </span>
                    )}
                    {!recording.has_feedback && filterNeedsFeedback && (
                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                        Needs Feedback
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-2">
                    <span>WPM: {recording.metrics?.wpm || "N/A"}</span>
                    <span>
                      Fillers: {typeof recording.metrics?.filler_count === "number" 
                        ? recording.metrics.filler_count 
                        : Object.keys(recording.metrics?.filler_breakdown || {}).length}
                    </span>
                    <span>
                      {new Date(recording.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {recording.transcription_text && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                      {recording.transcription_text}
                    </p>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/user/${recording.user_id}`);
                      }}
                    >
                      View User Context
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecordingClick(recording);
                      }}
                    >
                      {recording.has_feedback ? "Edit Feedback" : "Provide Feedback"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {currentPage * limit + 1} to {Math.min((currentPage + 1) * limit, total)} of {total} recordings
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1 || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

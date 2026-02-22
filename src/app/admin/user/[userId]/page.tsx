"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUserAdminContext, fetchAdminRecordings, updateUserAdminEmail, getAuthUserEmail } from "@/lib/api/client";
import type { UserAdminContext, RecordingForAdmin } from "@/lib/api/types";
import { toast } from "sonner";
import { ArrowLeft, Edit, FileText, Mail } from "lucide-react";
import Link from "next/link";

export default function UserContextPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<UserAdminContext | null>(null);
  const [userRecordings, setUserRecordings] = useState<RecordingForAdmin[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [emailAssigning, setEmailAssigning] = useState(false);
  const emailAssignAttempted = useRef(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  useEffect(() => {
    if (userId) emailAssignAttempted.current = false;
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const contextData = await getUserAdminContext(userId);
      setContext(contextData);

      setRecordingsLoading(true);
      try {
        const recordingsResponse = await fetchAdminRecordings(50, 0);
        const userRecs = recordingsResponse.recordings.filter(
          (r) => r.user_id === userId
        );
        setUserRecordings(userRecs);
      } catch (err) {
        console.error("Failed to load recordings:", err);
      } finally {
        setRecordingsLoading(false);
      }
    } catch (error) {
      console.error("Failed to load user context:", error);
      toast.error("Failed to load user context");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!context || !userId || emailAssignAttempted.current) return;
    emailAssignAttempted.current = true;
    let cancelled = false;
    (async () => {
      setEmailAssigning(true);
      try {
        const { email } = await getAuthUserEmail(userId);
        if (cancelled || !email?.trim()) {
          setEmailAssigning(false);
          return;
        }
        const updated = await updateUserAdminEmail(userId, email);
        if (!cancelled) setContext(updated);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to assign email from Auth:", err);
        }
      } finally {
        if (!cancelled) setEmailAssigning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, context]);

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">Loading user context...</p>
      </Card>
    );
  }

  if (!context) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">User context not found.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/recordings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Recordings
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">User Context</h1>
          <p className="text-muted-foreground mt-1">
            Admin feedback and context for user: <span className="font-mono text-sm">{userId}</span>
          </p>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5" />
          User email
        </h2>
        {emailAssigning ? (
          <p className="text-sm text-muted-foreground">Assigning email from Auth…</p>
        ) : context?.user_email ? (
          <p className="text-sm">
            <span className="font-mono">{context.user_email}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No email (or service role not configured)</p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Admin Feedback</h2>
            {userRecordings.length > 0 && (
              <Link href={`/admin/students/${userId}`}>
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Feedback
                </Button>
              </Link>
            )}
          </div>

          <div className="space-y-4">
            {context.general_notes ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">General Notes</p>
                <p className="text-sm whitespace-pre-wrap">{context.general_notes}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No general notes yet.</p>
            )}

            {context.custom_instructions ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Custom Instructions</p>
                <p className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded">
                  {context.custom_instructions}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No custom instructions yet.</p>
            )}

            {context.max_words && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Max Words</p>
                <p className="text-sm">{context.max_words}</p>
              </div>
            )}

            {context.specific_questions && context.specific_questions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Specific Questions</p>
                <ul className="space-y-2">
                  {context.specific_questions.map((q) => (
                    <li key={q.id} className="text-sm">
                      <span className="font-medium">[{q.question_type}]</span> {q.question_text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">User Recordings</h2>
          {recordingsLoading ? (
            <p className="text-sm text-muted-foreground">Loading recordings...</p>
          ) : userRecordings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recordings found for this user.</p>
          ) : (
            <div className="space-y-3">
              {userRecordings.map((recording) => (
                <div
                  key={recording.recording_id}
                  className="p-3 border rounded-lg hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-1">
                        {new Date(recording.created_at).toLocaleDateString()}
                      </p>
                      {recording.transcription_text && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {recording.transcription_text}
                        </p>
                      )}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>WPM: {recording.metrics?.wpm || "N/A"}</span>
                        <span>
                          Fillers:{" "}
                          {typeof recording.metrics?.filler_count === "number"
                            ? recording.metrics.filler_count
                            : Object.keys(recording.metrics?.filler_breakdown || {}).length}
                        </span>
                      </div>
                    </div>
                    <Link href={`/admin/students/${userId}`}>
                      <Button size="sm" variant="ghost">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

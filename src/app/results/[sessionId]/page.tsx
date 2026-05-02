"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SnippetCard from "@/components/results/SnippetCard";

interface Snippet {
  id: string;
  session_id: string;
  user_id: string;
  recording_id: string;
  start_offset_ms: number;
  duration_ms: number;
  audio_segment_path: string;
  snippet_type: string;
  admin_comment: string | null;
  admin_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/results/${sessionId}/snippets`);

        if (response.status === 401) {
          // Redirect to login if not authenticated
          router.push(`/login?redirectTo=/results/${sessionId}`);
          return;
        }

        if (response.status === 403) {
          setError("You do not have access to this session.");
          return;
        }

        if (response.status === 404) {
          setError("Session not found.");
          return;
        }

        if (!response.ok) {
          setError("Failed to load snippets.");
          return;
        }

        const data = await response.json();
        setSnippets(data.snippets || []);
      } catch (err) {
        console.error("Error fetching snippets:", err);
        setError("An error occurred while loading your snippets.");
      } finally {
        setLoading(false);
      }
    };

    fetchSnippets();
  }, [sessionId, router]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold">Your Charisma Moments</h1>
          <p className="text-muted-foreground">
            Here are the moments where you showed great communication.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
              <p className="mt-2 text-sm text-muted-foreground">
                Loading your snippets...
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => router.push("/")}
            >
              Back Home
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && snippets.length === 0 && (
          <div className="space-y-4 rounded-lg border border-dashed bg-muted/50 p-8 text-center">
            <p className="text-muted-foreground">
              No snippets have been added to your results yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Your coach will analyze your recording and add personalized feedback soon.
            </p>
          </div>
        )}

        {/* Snippets Grid */}
        {!loading && !error && snippets.length > 0 && (
          <div className="space-y-6">
            {snippets.map((snippet) => (
              <SnippetCard key={snippet.id} snippet={snippet} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

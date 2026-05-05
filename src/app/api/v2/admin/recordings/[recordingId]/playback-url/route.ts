import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken } from "@/app/api/getAuth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/v2/admin/recordings/[recordingId]/playback-url
 * Generate a signed Supabase Storage URL for the recording's audio file.
 * Returns { url: string, expires_in: number }.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { recordingId: string } }
) {
  try {
    const recordingId = params.recordingId;

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Fetch the recording row to get the storage_path
    const { data: recording, error: fetchError } = await supabase
      .from("recording_1")
      .select("id, storage_path, audio_url")
      .eq("id", recordingId)
      .single();

    if (fetchError || !recording) {
      return NextResponse.json(
        { code: "NOT_FOUND", error: "Recording not found" },
        { status: 404 }
      );
    }

    const storagePath = recording.storage_path;

    // If there's already a public URL, return it directly
    if (recording.audio_url && recording.audio_url.startsWith("http")) {
      return NextResponse.json({
        status: "ok",
        url: recording.audio_url,
        expires_in: null,
        source: "public_url",
      });
    }

    if (!storagePath) {
      return NextResponse.json(
        { code: "NO_PATH", error: "Recording has no storage path" },
        { status: 404 }
      );
    }

    // Try to create a signed URL from Supabase Storage
    // Try audio_recordings bucket first, then coach_feedback_videos
    const buckets = ["audio_recordings", "coach_feedback_videos"];
    let signedUrl: string | null = null;

    for (const bucket of buckets) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (!error && data?.signedUrl) {
        signedUrl = data.signedUrl;
        break;
      }
    }

    if (!signedUrl) {
      // Fall back to constructing a public URL
      const { data: publicUrlData } = supabase.storage
        .from("audio_recordings")
        .getPublicUrl(storagePath);

      signedUrl = publicUrlData?.publicUrl || null;
    }

    if (!signedUrl) {
      return NextResponse.json(
        { code: "URL_GENERATION_FAILED", error: "Could not generate playback URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      url: signedUrl,
      expires_in: 3600,
      source: "signed",
    });
  } catch (err) {
    console.error("Recording playback URL error:", err);
    return NextResponse.json(
      { code: "ERROR", error: "Internal server error" },
      { status: 500 }
    );
  }
}

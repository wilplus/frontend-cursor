import { recordingsDetailLimiter } from "../concurrencyLimiter";
import { fetchRecording } from "./client";
import type { GetRecordingResponse, UUID } from "./types";

export async function fetchRecordingDetail(
  id: UUID
): Promise<GetRecordingResponse> {
  return recordingsDetailLimiter.run(async () => {
    return fetchRecording(id);
  });
}

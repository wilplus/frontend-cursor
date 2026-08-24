import { callBackend } from "@/app/api/_lib/backend";

export async function POST(
  _request: Request,
  { params }: { params: { projectId: string; takeId: string } }
) {
  const projectId = encodeURIComponent(params.projectId);
  const takeId = encodeURIComponent(params.takeId);
  return callBackend(
    `/v2/projects/${projectId}/takes/${takeId}/send-to-coach`,
    { method: "POST" }
  );
}

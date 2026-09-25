import { callBackend } from "@/app/api/_lib/backend";

/* Ask for one project to be deleted, or cancel that request (P1, N8). The
   backend decides everything; this only forwards. */

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const projectId = encodeURIComponent(params.projectId);
  return callBackend(`/v2/projects/${projectId}/deletion-request`, {
    method: "POST",
    body: await request.text(),
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  const projectId = encodeURIComponent(params.projectId);
  return callBackend(`/v2/projects/${projectId}/deletion-request`, {
    method: "DELETE",
  });
}

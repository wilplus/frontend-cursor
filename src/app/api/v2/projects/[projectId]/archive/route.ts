import { callBackend } from "@/app/api/_lib/backend";

/* Archive one project, or bring it back (N14). The backend decides
   everything; this only forwards. */

export async function POST(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  const projectId = encodeURIComponent(params.projectId);
  return callBackend(`/v2/projects/${projectId}/archive`, { method: "POST" });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  const projectId = encodeURIComponent(params.projectId);
  return callBackend(`/v2/projects/${projectId}/archive`, { method: "DELETE" });
}

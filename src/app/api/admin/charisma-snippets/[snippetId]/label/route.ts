import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ snippetId: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const backend = getBackendUrl();
  const { snippetId } = await params;
  const res = await fetch(`${backend}/v2/admin/charisma-snippets/${snippetId}/label`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ snippetId: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backend = getBackendUrl();
  const { snippetId } = await params;
  const res = await fetch(`${backend}/v2/admin/charisma-snippets/${snippetId}/label`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}

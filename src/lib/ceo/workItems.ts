import type { CeoProjectKey } from "./domain";

export interface CeoAttachment {
  kind: "image" | "audio";
  data_url: string;
  name: string;
}

export type CeoTaskStatus = "active" | "done" | "archived";
export type CeoGenerationStatus = "pending" | "ready" | "failed" | "manual";

export interface CeoTask {
  id: string;
  project_key: CeoProjectKey;
  feature_id: string | null;
  bug_id: string | null;
  title: string;
  user_story: string | null;
  body: string;
  attachments: CeoAttachment[];
  priority: 1 | 2 | 3;
  order_key: number;
  status: CeoTaskStatus;
  generation_status: CeoGenerationStatus;
  manually_edited: boolean;
  created_at: string;
  updated_at: string;
  done_at: string | null;
  archived_at: string | null;
}

interface JsonBody {
  [key: string]: unknown;
}

async function json(response: Response): Promise<JsonBody> {
  const body = (await response.json().catch(() => ({}))) as JsonBody;
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Request failed (${response.status}).`
    );
  }
  return body;
}

function base(path: string, project: CeoProjectKey): string {
  return `/api/v2/admin/ceo/work-items/${path}?project=${project}`;
}

export async function createCeoBug(input: {
  project: CeoProjectKey;
  text: string;
  attachments: CeoAttachment[];
}): Promise<{ bugId: string; taskId: string }> {
  const body = await json(
    await fetch("/api/v2/admin/ceo/work-items/bugs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
  return { bugId: String(body.bug_id), taskId: String(body.task_id) };
}

export async function listCeoTasks(
  project: CeoProjectKey,
  view: CeoTaskStatus,
  featureId?: string | null
): Promise<CeoTask[]> {
  const query = new URLSearchParams({ project, view });
  if (featureId) query.set("feature_id", featureId);
  const body = await json(
    await fetch(`/api/v2/admin/ceo/work-items/tasks?${query}`, {
      cache: "no-store",
    })
  );
  return Array.isArray(body.tasks) ? (body.tasks as CeoTask[]) : [];
}

export async function createCeoTask(
  project: CeoProjectKey,
  input: Pick<CeoTask, "title" | "body"> &
    Partial<Pick<CeoTask, "user_story" | "priority" | "feature_id">>
): Promise<CeoTask> {
  const body = await json(
    await fetch("/api/v2/admin/ceo/work-items/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, ...input }),
    })
  );
  return body.task as CeoTask;
}

export async function updateCeoTask(
  project: CeoProjectKey,
  taskId: string,
  patch: Partial<
    Pick<CeoTask, "title" | "body" | "user_story" | "priority" | "feature_id">
  >
): Promise<CeoTask> {
  const body = await json(
    await fetch(base(`tasks/${taskId}`, project), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
  return body.task as CeoTask;
}

export async function actOnCeoTask(
  project: CeoProjectKey,
  taskId: string,
  action: "done" | "archive" | "restore"
): Promise<void> {
  await json(
    await fetch(base(`tasks/${taskId}/${action}`, project), { method: "POST" })
  );
}

export async function reorderCeoTask(
  project: CeoProjectKey,
  taskId: string,
  afterId: string | null
): Promise<void> {
  await json(
    await fetch(base(`tasks/${taskId}/reorder`, project), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ after_id: afterId }),
    })
  );
}

export async function deleteCeoTask(
  project: CeoProjectKey,
  taskId: string
): Promise<void> {
  await json(
    await fetch(`${base(`tasks/${taskId}`, project)}&confirmed=1`, {
      method: "DELETE",
    })
  );
}

export async function retryCeoBug(
  project: CeoProjectKey,
  bugId: string
): Promise<void> {
  await json(
    await fetch(base(`bugs/${bugId}/retry`, project), { method: "POST" })
  );
}

export function ceoTaskAgentText(task: CeoTask): string {
  return [
    `[P${task.priority}] ${task.title}`,
    task.user_story,
    task.body,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function moveCeoTask(
  tasks: CeoTask[],
  from: number,
  to: number
): CeoTask[] {
  if (from === to || from < 0 || to < 0 || from >= tasks.length || to >= tasks.length) {
    return tasks;
  }
  const next = [...tasks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

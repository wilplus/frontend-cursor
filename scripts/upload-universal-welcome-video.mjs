#!/usr/bin/env node
// One-off: upload a local video file as the Copilot "universal welcome video"
// shown to first-time / unassigned users on the homework step-0 screen.
//
// Run:
//   BACKEND_URL=https://api.example.com \
//   ADMIN_TOKEN=eyJ... \
//   node scripts/upload-universal-welcome-video.mjs /path/to/video.mov "Welcome to Willpower Lab"
//
// Mirrors src/lib/api/admin-client.ts uploadCopilotReferenceVideoWithProgress():
//   1) POST /v2/admin/copilot/reference-videos/upload-url      → signed R2 URL
//   2) PUT raw bytes to signed URL                             → store in R2
//   3) POST /v2/admin/copilot/reference-videos/register-from-storage
//      with { is_universal_video: true }                        → register + start transcription
//   4) (optional) poll /v2/admin/copilot/reference-videos/upload-jobs/{job_id}
//
// Requires Node 18+ (built-in fetch + Readable.toWeb for streaming upload).

import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { basename } from "node:path";

const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const FILE_PATH = process.argv[2] || "";
const TITLE = process.argv[3] || "Welcome to Willpower Lab";
const TAGS = process.env.REFERENCE_TAGS || "welcome,universal,onboarding";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);
const POLL_MAX_ATTEMPTS = Number(process.env.POLL_MAX_ATTEMPTS || 60);

if (!BACKEND_URL || !ADMIN_TOKEN || !FILE_PATH) {
  console.error(
    "Usage:\n" +
      "  BACKEND_URL=https://api.example.com ADMIN_TOKEN=eyJ... \\\n" +
      "    node scripts/upload-universal-welcome-video.mjs <path-to-video> [\"Title\"]\n"
  );
  process.exit(1);
}

let fileStat;
try {
  fileStat = statSync(FILE_PATH);
} catch (e) {
  console.error(`Cannot stat ${FILE_PATH}: ${e.message || e}`);
  process.exit(1);
}

const FILENAME = basename(FILE_PATH);
const CONTENT_TYPE = contentTypeFromName(FILENAME);

function contentTypeFromName(name) {
  if (/\.mov$/i.test(name)) return "video/quicktime";
  if (/\.mp4$/i.test(name)) return "video/mp4";
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.mkv$/i.test(name)) return "video/x-matroska";
  if (/\.m4v$/i.test(name)) return "video/x-m4v";
  return "application/octet-stream";
}

const ADMIN_HEADERS = {
  Authorization: `Bearer ${ADMIN_TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

async function step1RequestUploadUrl() {
  const res = await fetch(`${BACKEND_URL}/v2/admin/copilot/reference-videos/upload-url`, {
    method: "POST",
    headers: ADMIN_HEADERS,
    body: JSON.stringify({
      filename: FILENAME,
      file_size_bytes: fileStat.size,
      content_type: CONTENT_TYPE,
      storage_provider: "r2",
    }),
  });
  if (!res.ok) {
    throw new Error(`upload-url failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
  const json = await res.json();
  if (!json?.upload_url || !json?.storage_path) {
    throw new Error(`upload-url response missing fields: ${JSON.stringify(json)}`);
  }
  return {
    upload_url: String(json.upload_url),
    storage_path: String(json.storage_path),
    bucket: json.bucket ? String(json.bucket) : undefined,
    content_type: json.content_type ? String(json.content_type) : CONTENT_TYPE,
  };
}

async function step2PutToR2(uploadUrl, contentType) {
  // Stream the file so we don't buffer ~100MB in memory.
  const nodeStream = createReadStream(FILE_PATH);
  const webStream = Readable.toWeb(nodeStream);

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileStat.size),
    },
    body: webStream,
    // Required by undici for a ReadableStream request body on Node 18+.
    duplex: "half",
  });

  if (!res.ok) {
    throw new Error(`R2 PUT failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
}

async function step3Register({ storage_path, bucket }) {
  const res = await fetch(
    `${BACKEND_URL}/v2/admin/copilot/reference-videos/register-from-storage`,
    {
      method: "POST",
      headers: ADMIN_HEADERS,
      body: JSON.stringify({
        storage_path,
        storage_provider: "r2",
        bucket,
        track_progress: true,
        title: TITLE,
        reference_tags: TAGS,
        is_universal_video: true,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(
      `register-from-storage failed: HTTP ${res.status} ${await res.text().catch(() => "")}`
    );
  }
  const json = await res.json();
  if (!json?.job_id) {
    throw new Error(`register-from-storage missing job_id: ${JSON.stringify(json)}`);
  }
  return {
    job_id: String(json.job_id),
    poll_url: json.poll_url ? String(json.poll_url) : null,
    reference_video: json.reference_video ?? null,
  };
}

async function pollJob(jobId, pollUrl) {
  const url = pollUrl
    ? pollUrl.startsWith("http")
      ? pollUrl
      : `${BACKEND_URL}${pollUrl}`
    : `${BACKEND_URL}/v2/admin/copilot/reference-videos/upload-jobs/${encodeURIComponent(jobId)}`;

  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, Accept: "application/json" },
    });
    if (res.status === 404) {
      // Jobs table may not be present on some envs — not fatal.
      console.log("  (jobs table unavailable; skipping polling — upload already registered)");
      return null;
    }
    if (!res.ok) {
      throw new Error(`job poll failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);
    }
    const job = await res.json();
    const status = (job?.status || job?.stage || "").toString().toLowerCase();
    const pct = job?.progress_pct != null ? ` ${job.progress_pct}%` : "";
    console.log(`  attempt ${attempt}: ${status || "?"}${pct}`);
    if (["done", "completed", "succeeded", "success"].includes(status)) return job;
    if (["failed", "error"].includes(status)) {
      throw new Error(`transcription job failed: ${JSON.stringify(job)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.log("  (polling budget exhausted; video is registered, transcription may still be running)");
  return null;
}

(async () => {
  const mb = (fileStat.size / 1024 / 1024).toFixed(1);
  console.log(`Uploading ${FILENAME} (${mb} MB) as universal welcome video…`);
  console.log(`  backend=${BACKEND_URL}`);
  console.log(`  title="${TITLE}"  tags="${TAGS}"`);

  console.log("Step 1/3: requesting signed upload URL…");
  const uploadTarget = await step1RequestUploadUrl();
  console.log(`  ✔ bucket=${uploadTarget.bucket ?? "(default)"}  path=${uploadTarget.storage_path}`);

  console.log("Step 2/3: uploading file to R2…");
  await step2PutToR2(uploadTarget.upload_url, uploadTarget.content_type);
  console.log("  ✔ uploaded");

  console.log("Step 3/3: registering with is_universal_video=true…");
  const registered = await step3Register(uploadTarget);
  console.log(`  ✔ job_id=${registered.job_id}`);
  if (registered.reference_video?.id) {
    console.log(`  reference_video_id=${registered.reference_video.id}`);
  }

  console.log("Polling transcription job…");
  await pollJob(registered.job_id, registered.poll_url);

  console.log("\nDone. This video is now the universal welcome video.");
  console.log("First-time / unassigned users will see it on step 0.");
})().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});

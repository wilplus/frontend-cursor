/* A paste is stored and checked. Nothing here imports or runs it. */

import { PLUGIN_TYPES, type PluginDraft } from "./types";

const MAX_BYTES = 32 * 1024;

const BANNED: { pattern: RegExp; reason: string }[] = [
  { pattern: /\beval\s*\(/, reason: "eval" },
  { pattern: /\bexec\s*\(/, reason: "exec" },
  { pattern: /\bsubprocess\b/, reason: "subprocess" },
  { pattern: /\bfetch\s*\(/, reason: "network" },
  { pattern: /\bXMLHttpRequest\b/, reason: "network" },
  { pattern: /\bimport\s+(?:os|socket|http|urllib|requests)\b/, reason: "network" },
  { pattern: /\bfrom\s+["']react["']/, reason: "component" },
  { pattern: /<[A-Z][A-Za-z0-9]*(\s|\/|>)/, reason: "component" },
];

const MANIFEST_KEYS = ["id", "role", "interventionType", "hears", "step"] as const;

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function manifestOf(source: string): PluginDraft["manifest"] {
  const head = source.split("\n").slice(0, 30);
  const found: Record<string, string> = {};
  for (const line of head) {
    const match = /^(id|role|interventionType|hears|step):\s*(\S.*?)\s*$/.exec(line.replace(/^#+\s*/, "").replace(/^\/\/\s*/, ""));
    if (match) found[match[1]] = match[2];
  }
  if (!MANIFEST_KEYS.every((key) => found[key])) return null;
  return {
    id: found.id,
    role: found.role,
    interventionType: found.interventionType,
    hears: found.hears,
    step: found.step,
  };
}

/** Check a paste. Does not call import(), Function, or eval. */
export async function checkPlugin(source: string): Promise<PluginDraft> {
  const hash = await sha256(source);
  const reasons: string[] = [];
  if (new TextEncoder().encode(source).length > MAX_BYTES) reasons.push("too_long");
  for (const ban of BANNED) {
    if (ban.pattern.test(source)) reasons.push(ban.reason);
  }
  const manifest = manifestOf(source);
  if (!manifest) reasons.push("manifest");
  else {
    if (manifest.role !== "detector") reasons.push("role");
    if (!PLUGIN_TYPES.includes(manifest.interventionType as (typeof PLUGIN_TYPES)[number])) reasons.push("type");
    if (!manifest.step.startsWith("walk.") && !manifest.step.startsWith("shell.") && !manifest.step.startsWith("will.")) {
      reasons.push("screen");
    }
  }
  const status = reasons.length === 0 ? "checked" : reasons.includes("manifest") && reasons.length === 1 ? "draft" : "rejected";
  return { status, hash, source, reasons, manifest };
}

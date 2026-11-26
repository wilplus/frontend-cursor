import "server-only";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { backendTargetsLoopback } from "./backend";

export function localBaselineAvailable(): boolean {
  return process.env.NODE_ENV === "development" &&
    process.env.ISOLATED_BASELINE_PREVIEW === "1" && backendTargetsLoopback() &&
    isAbsolute(process.env.ISOLATED_BASELINE_TOKEN_FILE ?? "");
}

export function loopbackHost(host: string): boolean {
  try {
    const url = new URL(`http://${host}`);
    return !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function localBaselineToken(): Promise<string | null> {
  if (!localBaselineAvailable()) return null;
  try {
    const token = (await readFile(process.env.ISOLATED_BASELINE_TOKEN_FILE!, "utf8")).trim();
    return token && token.length <= 16_384 && !/\s/.test(token) ? token : null;
  } catch {
    return null;
  }
}

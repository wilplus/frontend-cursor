/* -------------------------------------------------------------------------- */
/*  Shared Playwright resolution for every e2e spec.                           */
/*                                                                            */
/*  Replaces the per-spec hardcoded machine paths (a /opt/node22 playwright    */
/*  import and a versioned chromium-1194 binary) that made the specs runnable  */
/*  on exactly one machine. Resolution order:                                  */
/*                                                                            */
/*    module  — project node_modules first, then the global npm root;         */
/*    browser — $PW_CHROMIUM if set (explicit binary override), otherwise     */
/*              Playwright's own registry (which honours                       */
/*              PLAYWRIGHT_BROWSERS_PATH and `npx playwright install`).        */
/*                                                                            */
/*  Every spec launches through launchChromium(); none of them may name a      */
/*  browser path.                                                              */
/* -------------------------------------------------------------------------- */

import { createRequire } from "node:module";
import { execSync } from "node:child_process";

/** Resolve playwright from the project first, then the global root. */
export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require("playwright");
  } catch {
    const globalRoot = execSync("npm root -g").toString().trim();
    return createRequire(`${globalRoot}/`)("playwright");
  }
}

/** Launch Chromium portably; extra launch options pass straight through. */
export async function launchChromium(options = {}) {
  const { chromium } = loadPlaywright();
  return chromium.launch(
    process.env.PW_CHROMIUM
      ? { executablePath: process.env.PW_CHROMIUM, ...options }
      : options
  );
}

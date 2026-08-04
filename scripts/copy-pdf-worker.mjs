// Copies the pdf.js worker that matches the installed pdfjs-dist into
// public/, so the FE serves it same-origin (workers can never load
// cross-origin, and the CSP worker-src only allows 'self'). Bundling it via
// `new URL(..., import.meta.url)` instead trips Next 14's Terser pass, which
// re-minifies emitted .mjs assets as scripts and rejects their module syntax
// — hence this copy. Runs on postinstall; the copy is gitignored.
// pdfSlides.tsx appends ?v=<pdfjs.version> so browser caches bust on upgrade.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const src = join(
  dirname(require.resolve("pdfjs-dist/package.json")),
  "build",
  "pdf.worker.min.mjs"
);
const dest = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "pdf.worker.min.mjs"
);
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] copied ${src} -> ${dest}`);

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Minimal vitest config. The only thing it adds over the defaults is the
 * `@/` → `src/` path alias (mirrors tsconfig `paths`), so tests can import
 * modules that value-import `@/…` at runtime (type-only `@/` imports were
 * already erased, which is why earlier tests passed without this).
 */
export default defineConfig({
  // tsconfig says jsx: "preserve" (Next.js compiles JSX itself). Vite's
  // transform honours that and leaves JSX in place, so any component test
  // that imports a file WITH JSX failed at import analysis — which is why,
  // until Phase 2, no test rendered an F1 surface. Compile JSX here.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    // e2e/ drives a real browser against a running dev server (see the header
    // of each spec). It is not a vitest suite and must not be collected as one.
    exclude: ["node_modules/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

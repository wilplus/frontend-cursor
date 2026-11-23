import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Match source aliases and keep component tests independent of deployed credentials. */
export default defineConfig({
  // tsconfig says jsx: "preserve" (Next.js compiles JSX itself). Vite's
  // transform honours that and leaves JSX in place, so any component test
  // that imports a file WITH JSX failed at import analysis — which is why,
  // until Phase 2, no test rendered an F1 surface. Compile JSX here.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    // Use a loopback endpoint for browser auth helpers in component tests.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon",
    },
    // DOM/animation suites share CPU with the app. Bound concurrency so a
    // busy workstation cannot starve their effects and five-second budget.
    maxWorkers: 2,
    // Nested checkouts have their own config and source aliases. Running them
    // with this checkout's aliases mixes two applications in one test suite.
    exclude: ["node_modules/**", "worktrees/**", ".codex-worktrees/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

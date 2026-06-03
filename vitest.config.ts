import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Minimal vitest config. The only thing it adds over the defaults is the
 * `@/` → `src/` path alias (mirrors tsconfig `paths`), so tests can import
 * modules that value-import `@/…` at runtime (type-only `@/` imports were
 * already erased, which is why earlier tests passed without this).
 */
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

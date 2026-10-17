import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: root },
      // The real `server-only` throws outside a React Server Components bundle,
      // and tests import server modules directly.
      { find: "server-only", replacement: `${root}test/server-only.ts` },
    ],
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", ".next/**", ".claude-config/**"],
  },
});

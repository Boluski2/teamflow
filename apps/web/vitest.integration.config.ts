import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./src/lib/tests/server-only.ts", import.meta.url),
      ),
    },
  },

  test: {
    environment: "node",

    include: [
      "src/**/*.integration.test.ts",
    ],

    setupFiles: [
      "./src/lib/tests/load-integration-env.ts",
    ],

    testTimeout: 30000,
    hookTimeout: 30000,
    clearMocks: true,
    restoreMocks: true,
  },
});
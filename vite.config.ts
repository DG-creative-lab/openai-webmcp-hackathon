import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4173 },
  test: {
    include: ["src/**/*.test.ts", "tests/adversarial/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: ["src/domain/evaluation.ts", "src/store/appStore.ts", "src/webmcp/registerTools.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 85,
        lines: 85,
      },
    },
  },
});

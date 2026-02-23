import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts", "./test/component-setup.ts"],
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/api/**"],
      exclude: ["**/*.d.ts", "**/node_modules/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});

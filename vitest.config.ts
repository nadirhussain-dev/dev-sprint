import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@content": path.resolve(__dirname, "content") } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});

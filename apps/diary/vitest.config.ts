import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
  resolve: {
    preserveSymlinks: true, // next.config의 symlinks:false와 같은 이유
    alias: { "@": path.resolve(__dirname, "src") },
  },
});

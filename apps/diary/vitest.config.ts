import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig의 jsx: preserve를 덮는다 — 테스트가 .tsx(페이지·컴포넌트)를 바로 부를 수 있게 (test/today-page.test.ts)
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: { include: ["test/**/*.test.ts"] },
  resolve: {
    preserveSymlinks: true, // next.config의 symlinks:false와 같은 이유
    alias: { "@": path.resolve(__dirname, "src") },
  },
});

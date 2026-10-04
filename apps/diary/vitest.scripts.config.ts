import path from "node:path";
import { defineConfig } from "vitest/config";

// 일회성 스크립트(이관 등)를 vitest로 돌린다. TS·경로 별칭·엔진 링크를 그대로 쓰기 위해서다.
export default defineConfig({
  test: { include: ["scripts/**/*.migrate.ts"], testTimeout: 120_000 },
  resolve: { preserveSymlinks: true, alias: { "@": path.resolve(__dirname, "src") } },
});

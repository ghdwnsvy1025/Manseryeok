import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    // 레거시 jest 테스트를 그대로 옮겨 와서 @jest/globals import를 vitest로 돌린다
    alias: { "@jest/globals": "vitest" },
  },
});

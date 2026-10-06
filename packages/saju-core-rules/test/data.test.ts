// 원본 아님 — data/키워드.ts 상수가 복사해 둔 키워드.json 과 한 글자도 다르지 않은지 확인.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import KW from "../src/data/키워드";

test("data/키워드.ts === data/키워드.json", () => {
  const json = JSON.parse(readFileSync(new URL("../src/data/키워드.json", import.meta.url), "utf8"));
  assert.deepEqual(KW, json);
});

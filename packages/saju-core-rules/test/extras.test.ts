// 원본: 사주 코어 core/test/extras.test.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). node:test → vitest 로만 바꿈. 기대값 수정 금지.
import { test } from "vitest";
import assert from "node:assert/strict";
import { parsePillars } from "../src/base";
import { balance, yongsin } from "../src/yongsin";
import { extraTags, johu } from "../src/extras";

const has = (chart: string, tag: string, target = "") => extraTags(parsePillars(chart)).some((t) => t.태그.startsWith(tag) && t.대상.includes(target));

test("부가태그: 타사 화면에 표시된 값 18개 재현 (부가태그_검증.py와 같은 목록)", () => {
  const A = "乙亥 丙戌 己丑 辛未", B = "甲戌 丁丑 癸卯 戊午", C = "甲戌 乙亥 甲寅 戊辰";
  const checks: [string, string, string][] = [
    [A, "백호", "월주"], [A, "공망", "시지"], [A, "삼형 완성", "丑戌未"], [A, "천라지망", ""], [A, "12신살 화개", "시지"], [A, "12신살 월살", "일지"], [A, "12신살 천살", "월지"], [A, "12신살 지살", "연지"],
    [B, "백호", "월주"], [B, "원진", "丑午"], [B, "귀문", "丑午"], [B, "형(일부)", "丑戌"], [B, "천을귀인", "일지"],
    [C, "원진", "辰亥"], [C, "천라지망", ""],
  ];
  for (const [c, t, where] of checks) assert.ok(has(c, t, where), `${c}: ${t} ${where}`);
});
test("조후.md 예 3개: 무난 0 / 한습 경향 −2 / 한습 경향 −3", () => {
  const j = (c: string) => { const p = parsePillars(c); return johu(p, yongsin(p, balance(p))); };
  assert.equal(j("乙亥 丙戌 己丑 辛未").점수, 0); assert.equal(j("乙亥 丙戌 己丑 辛未").온도, "무난");
  assert.equal(j("甲戌 丁丑 癸卯 戊午").점수, -2); assert.equal(j("甲戌 乙亥 甲寅 戊辰").점수, -3);
});

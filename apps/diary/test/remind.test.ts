import { describe, expect, test } from "vitest";
import { hourOf, isAllowedRemindHour, pickDue, remindMessage } from "@/lib/remind";

const sub = { endpoint: "https://push.example/abc" };
const c = (user_id: string, remind_at: string, enabled = true, web_push: unknown = sub) => ({ user_id, remind_at, enabled, web_push });

describe("저녁 알림 대상", () => {
  test("시각이 맞고, 켜져 있고, 구독이 있고, 오늘 안 쓴 사람만", () => {
    const list = [
      c("a", "21:00:00"),
      c("b", "22:00:00"),
      c("c", "21:00:00", false),
      c("d", "21:00:00", true, null),
      c("e", "21:00:00"),
    ];
    const due = pickDue(list, 21, new Set(["e"]));
    expect(due.map((d) => d.user_id)).toEqual(["a"]);
  });

  test("시각 파싱", () => {
    expect(hourOf("21:00:00")).toBe(21);
    expect(hourOf("9:30")).toBe(9);
    expect(hourOf("")).toBe(-1);
  });

  test("허용 시각 (지금은 21시 하나)", () => {
    expect(isAllowedRemindHour(21)).toBe(true);
    expect(isAllowedRemindHour(8)).toBe(false);
    expect(isAllowedRemindHour(22)).toBe(false);
  });

  test("문구에 내일 간지가 들어가고 금지어가 없다", () => {
    const m = remindMessage("임자");
    expect(m.body).toContain("임자일");
    expect(m.body).not.toMatch(/기운|흐름|두근/);
    expect(m.url).toBe("/write");
  });
});

import { describe, expect, it } from "vitest";
import { BLOCK, authTransition, cleanProps, hashUserId, isDevHost, lengthBucket, sanitize, scrubUrl } from "@/lib/analytics/core";

describe("이용 통계 — 개인 정보 속성 거르기 (바이럴 analytics.js와 같은 규칙)", () => {
  it("생년월일·시각 이름은 지우고 나머지는 남긴다", () => {
    const out = cleanProps({ birthYear: 1995, birth_month: 3, Day: 1, hour: 2, minute: 3, lunar_date: "x", 생년월일: "x", 생일: "x", 출생시각: "x", mood: "기쁨", length_bucket: "1-20" });
    expect(out).toEqual({ mood: "기쁨", length_bucket: "1-20" });
  });

  it("undefined 값은 빼고, 빈 입력은 빈 객체", () => {
    expect(cleanProps({ a: undefined, b: null, c: 0 })).toEqual({ b: null, c: 0 });
    expect(cleanProps(undefined)).toEqual({});
  });

  it("today도 day에 걸린다 — 날짜 종류는 when으로 적어야 한다", () => {
    expect(BLOCK.test("is_today")).toBe(true);
    expect(BLOCK.test("when")).toBe(false);
    expect(BLOCK.test("remind_at")).toBe(false);
  });

  it("sanitize는 중첩($set) 안까지 거르고 주소의 key= 비밀을 뺀다", () => {
    const out = sanitize({
      $current_url: "https://diary.example/stats?key=SECRET&x=1",
      $set: { birth_year: 1990, email_ok: true, $initial_current_url: "https://diary.example/?key=S" },
      list: ["a", "b"],
      n: 1,
    });
    expect(out).toEqual({
      $current_url: "https://diary.example/stats?x=1",
      $set: { email_ok: true, $initial_current_url: "https://diary.example/" },
      list: ["a", "b"],
      n: 1,
    });
  });
});

describe("scrubUrl", () => {
  it("key만 빼고 다른 쿼리·해시는 남긴다", () => {
    expect(scrubUrl("/stats?key=abc")).toBe("/stats");
    expect(scrubUrl("/stats?key=abc&a=1#top")).toBe("/stats?a=1#top");
    expect(scrubUrl("/me?view=grid&KEY=x")).toBe("/me?view=grid");
    expect(scrubUrl("/write?date=2026-10-01")).toBe("/write?date=2026-10-01");
    expect(scrubUrl("/")).toBe("/");
  });
});

describe("hashUserId", () => {
  it("SHA-256 앞 16자, 같은 입력은 같고 다른 입력은 다르다", async () => {
    const a = await hashUserId("00000000-0000-0000-0000-000000000001");
    const b = await hashUserId("00000000-0000-0000-0000-000000000002");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).toBe(await hashUserId("00000000-0000-0000-0000-000000000001"));
    expect(a).not.toBe(b);
    // 알려진 값: sha256("abc") = ba7816bf8f01cfea…
    expect(await hashUserId("abc")).toBe("ba7816bf8f01cfea");
  });
});

describe("lengthBucket · isDevHost", () => {
  it("길이 구간", () => {
    expect(lengthBucket(0)).toBe("0");
    expect(lengthBucket(1)).toBe("1-20");
    expect(lengthBucket(20)).toBe("1-20");
    expect(lengthBucket(21)).toBe("21-60");
    expect(lengthBucket(60)).toBe("21-60");
    expect(lengthBucket(61)).toBe("61+");
  });
  it("개발 호스트", () => {
    expect(isDevHost("localhost")).toBe(true);
    expect(isDevHost("127.0.0.1")).toBe(true);
    expect(isDevHost("app.localhost")).toBe(true);
    expect(isDevHost("diary.sajucow.com")).toBe(false);
  });
});

describe("authTransition — 세션 변화 → identify / reset / login_success", () => {
  const anon = { id: "aaaa", anon: true };
  const google = { id: "aaaa", anon: false }; // 익명에 Google을 붙이면 같은 user_id
  const other = { id: "bbbb", anon: false };

  it("익명 세션은 식별하지 않는다", () => {
    expect(authTransition(null, anon)).toEqual({});
    expect(authTransition(anon, { id: "cccc", anon: true })).toEqual({});
    expect(authTransition(null, null)).toEqual({});
  });

  it("처음 확인인데 이미 로그인돼 있으면 식별만 (추적을 켠 날 기존 사용자가 login_success로 잡히지 않게)", () => {
    expect(authTransition(null, google)).toEqual({ identify: "aaaa" });
  });

  it("익명 → 같은 id로 Google 연결 = link, 다른 id = fresh", () => {
    expect(authTransition(anon, google)).toEqual({ identify: "aaaa", loginSuccess: { mode: "link" } });
    expect(authTransition(anon, other)).toEqual({ identify: "bbbb", loginSuccess: { mode: "fresh" } });
  });

  it("같은 사람이 계속 로그인돼 있으면 식별만 반복 (이벤트 없음)", () => {
    expect(authTransition(google, google)).toEqual({ identify: "aaaa" });
  });

  it("로그아웃(Google → 익명/없음)은 reset", () => {
    expect(authTransition(google, anon)).toEqual({ reset: true });
    expect(authTransition(google, null)).toEqual({ reset: true });
  });

  it("다른 사람으로 바뀌면 reset 뒤 identify + fresh", () => {
    expect(authTransition(google, other)).toEqual({ reset: true, identify: "bbbb", loginSuccess: { mode: "fresh" } });
  });
});

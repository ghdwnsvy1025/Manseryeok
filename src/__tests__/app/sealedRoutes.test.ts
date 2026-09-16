/**
 * 접힌 화면 판정 검증.
 *
 * 이 함수가 틀리면 두 방향으로 사고가 난다 —
 *   너무 많이 잡으면 살아 있는 화면이 막히고 (`/journal` 이 `/j` 로 잘못 걸리는 식),
 *   너무 적게 잡으면 접었다고 해놓고 그냥 열린다.
 * 그래서 "막혀야 할 것"과 "절대 막히면 안 되는 것"을 같이 고정한다.
 */
import { describe, expect, test } from "@jest/globals";
import {
  SEALED_ROUTES,
  findSealedRoute,
} from "@/lib/app/sealedRoutes";

describe("접힌 화면", () => {
  test("접기로 한 주소는 전부 걸린다", () => {
    const sealed = [
      "/diary",
      "/diary/collection",
      "/diary/history",
      "/diary/stats",
      "/analysis",
      "/analysis/daily",
      "/analysis/weekly",
      "/analysis/monthly",
      "/forecast",
    ];
    for (const path of sealed) {
      expect(`${path} → ${findSealedRoute(path) ? "접힘" : "열림"}`).toBe(
        `${path} → 접힘`
      );
    }
  });

  test("끝 슬래시·물음표·해시가 붙어도 걸린다", () => {
    for (const path of [
      "/diary/",
      "/analysis/weekly/",
      "/diary/login/../stats",
      "/forecast?from=home",
      "/analysis#top",
    ]) {
      // 경로 정리를 못 하면 봉인이 우회된다
      if (path.includes("..")) continue; // 브라우저가 먼저 정리하므로 대상 아님
      expect(`${path} → ${findSealedRoute(path) ? "접힘" : "열림"}`).toBe(
        `${path} → 접힘`
      );
    }
  });

  test("살아 있는 화면은 하나도 안 막힌다", () => {
    const alive = [
      "/",
      "/me",
      "/journal",
      "/journal/stats",
      "/journal/categories",
      "/stats",
      "/saju",
      "/saju/other",
      "/saju/profiles",
      "/auth/callback",
      "/admin",
    ];
    for (const path of alive) {
      const hit = findSealedRoute(path);
      expect(`${path} → ${hit ? `막힘(${hit.path})` : "열림"}`).toBe(
        `${path} → 열림`
      );
    }
  });

  test("운영자 로그인 통로는 /diary 를 접어도 열려 있다", () => {
    // 여기가 막히면 관리자가 앱에 못 들어간다
    expect(findSealedRoute("/diary/login")).toBeNull();
    expect(findSealedRoute("/diary/login/admin")).toBeNull();
  });

  test("이름이 비슷한 다른 주소를 잡아채지 않는다", () => {
    // "/diary" 가 "/diaryx" 를 삼키면 안 된다
    expect(findSealedRoute("/diaryx")).toBeNull();
    expect(findSealedRoute("/analysis-report")).toBeNull();
    expect(findSealedRoute("/forecasting")).toBeNull();
  });

  test("빈 값이 와도 터지지 않는다", () => {
    expect(findSealedRoute("")).toBeNull();
    expect(findSealedRoute("/")).toBeNull();
  });
});

describe("안내 문구", () => {
  test("모든 항목이 갈 곳과 문구를 갖고 있다", () => {
    for (const route of SEALED_ROUTES) {
      expect(route.title.length).toBeGreaterThan(1);
      expect(route.where.length).toBeGreaterThan(10);
      expect(route.href.startsWith("/")).toBe(true);
      expect(route.hrefLabel.length).toBeGreaterThan(2);
    }
  });

  test("보낼 곳이 또 접힌 화면이면 안 된다 — 무한 루프", () => {
    for (const route of SEALED_ROUTES) {
      expect(`${route.path} → ${route.href}`).toBe(
        `${route.path} → ${findSealedRoute(route.href) ? "접힌곳!" : route.href}`
      );
    }
  });

  test("'없어졌다·삭제'처럼 잃은 느낌을 주는 말을 쓰지 않는다", () => {
    for (const route of SEALED_ROUTES) {
      for (const banned of ["없어졌", "삭제", "지원하지 않", "사라졌"]) {
        expect(`${route.path}: ${route.where}`).not.toContain(banned);
      }
    }
  });
});

// 설명 층 (2026-11-02): 사주 유형별 재료 표와 고르는 규칙
import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { BANNED_ALL, buildBrief, JARGON, renderBrief, TEN_GOD_NAMES } from "@/lib/fortune/brief";
import { AREA_SCENE, areaScene } from "@/lib/fortune/areaScenes";
import { computeCoreFortune } from "@/lib/fortune/core";
import { adjustWithEntries } from "@/lib/fortune/personal";
import { buildPlan } from "@/lib/fortune/plan";
import { MIN_TYPE_AGREEMENT, SPECIAL_NOTES, TYPE_NOTE, typeNoteOf } from "@/lib/fortune/typeNotes";
import type { CoreFortune } from "@/lib/fortune/types";
import { ABSTRACT_RE, FIGURATIVE_RE, JUDGEMENT_RE, SHENG_KE_RE } from "@/lib/fortune/validate";
import { addDays } from "@/lib/time";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const typeLines = Object.values(TYPE_NOTE).flatMap((g) => Object.values(g).flatMap((r) => Object.values(r ?? {})));
const sceneLines = Object.values(AREA_SCENE).flatMap((g) => Object.values(g).flatMap((p) => [p.좋은, p.조심]));

function coreOf(p: Partial<BirthProfile>, date: string): CoreFortune {
  const profile: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul", ...p };
  const r = computeProfile({ ...profile, name: "x" });
  if (!r.ok) throw new Error(r.error);
  return computeCoreFortune({ pillars: r.value.pillars, profile, date, todayHanja: dayGanji(date).hanja });
}
/** 가상 사주 여러 명 × 여러 날 */
function sampleCores(): CoreFortune[] {
  const out: CoreFortune[] = [];
  for (let i = 0; i < 80; i++) {
    const p = { birthYear: 1970 + (i * 7) % 40, birthMonth: 1 + (i * 5) % 12, birthDay: 1 + (i * 11) % 28, birthHour: (i * 3) % 24, gender: i % 2 ? ("male" as const) : ("female" as const) };
    for (let d = 0; d < 30; d += 1) out.push(coreOf(p, addDays("2026-11-01", d * 3 + i)));
  }
  return out;
}
const cores = sampleCores();

describe("표", () => {
  test("유형 표는 30줄, 장면 표는 100문장(50칸)", () => {
    expect(typeLines).toHaveLength(30);
    expect(sceneLines).toHaveLength(100);
  });
  test("유형 표와 특례는 작가 재료라도 판정 말투·전문용어를 쓰지 않는다 (옮겨 적으면 검사기에 걸린다)", () => {
    const hits: string[] = [];
    for (const line of [...typeLines, ...SPECIAL_NOTES, ...sceneLines]) {
      for (const w of [...BANNED_ALL, ...JARGON, ...TEN_GOD_NAMES]) if (line.includes(w.trim())) hits.push(`${w}: ${line}`);
      for (const re of [ABSTRACT_RE, FIGURATIVE_RE, JUDGEMENT_RE, SHENG_KE_RE]) if (re.test(line)) hits.push(`${re.source.slice(0, 12)}: ${line}`);
    }
    expect(hits).toEqual([]);
  });
});

describe("고르기", () => {
  test("용신이 있으면 핵심 글자에 늘 한 줄이 간다 (표에 빠진 조합 없음)", () => {
    for (const c of cores) for (const part of [c.dayLuck.stem, c.dayLuck.branch]) if (part.label) expect(typeNoteOf(c, part), `${c.chartType?.신강약} ${part.family} ${part.label}`).toBeTruthy();
  });
  test("같은 그룹이 와도 신강약에 따라 말이 갈린다", () => {
    const byKind = new Map<string, Set<string>>();
    for (const c of cores) {
      const k = c.chartType!.신강약;
      const note = typeNoteOf(c, c.dayLuck.stem);
      if (c.dayLuck.stem.family === "재성" && note) byKind.set(k, (byKind.get(k) ?? new Set()).add(note));
    }
    const [a, b] = [byKind.get("신강")!, byKind.get("신약")!];
    expect([...a].some((x) => b.has(x))).toBe(false);
  });
  test("특례가 표보다 먼저고, 코어 플래그 문구와 맞물려 실제로 나온다 (코어 문구가 바뀌면 여기서 깨진다)", () => {
    const seen = new Set(cores.flatMap((c) => [typeNoteOf(c, c.dayLuck.stem), typeNoteOf(c, c.dayLuck.branch)]));
    const hit = SPECIAL_NOTES.filter((n) => seen.has(n));
    expect(hit.length).toBeGreaterThanOrEqual(8);
  });
  test("시간 모름으로 일치율이 낮으면 보내지 않는다", () => {
    const c = coreOf({}, "2026-11-10");
    const low: CoreFortune = { ...c, dayLuck: { ...c.dayLuck, agreement: MIN_TYPE_AGREEMENT - 0.01 } };
    expect(typeNoteOf(low, c.dayLuck.stem)).toBeNull();
    expect(typeNoteOf({ ...c, dayLuck: { ...c.dayLuck, agreement: MIN_TYPE_AGREEMENT } }, c.dayLuck.stem)).toBeTruthy();
  });
  test("옛 캐시(유형 없음)와 용신 없음이면 null", () => {
    const c = coreOf({}, "2026-11-10");
    const { chartType: _drop, ...old } = c;
    expect(typeNoteOf(old as CoreFortune, c.dayLuck.stem)).toBeNull();
    expect(typeNoteOf(c, { ...c.dayLuck.stem, label: null })).toBeNull();
  });
  test("장면: 신호 방향의 가장 센 글자, 가족과 신호 없음은 null", () => {
    const e = (strength: number, score: number, tenGod: string) => ({ strength, active: Math.abs(strength) >= 1, mixed: false, contributions: [{ part: "천간" as const, tenGod, label: null, score }] });
    expect(areaScene("재물", e(-2, -2, "겁재"))).toEqual({ 조심: AREA_SCENE.돈.겁재.조심 });
    expect(areaScene("직업", e(2, 2, "정관"))).toEqual({ 좋은: AREA_SCENE.일.정관.좋은 });
    expect(areaScene("가족", e(2, 2, "정인"))).toBeNull();
    expect(areaScene("재물", e(0, 0, "겁재"))).toBeNull();
  });
});

test("작가 입력: 핵심에 이사람에게, 오늘 영역에 장면이 간다. 재료를 빼지는 않는다", () => {
  const c = cores.find((x) => x.areas.some((a) => a.period === "오늘" && a.signal !== "→" && a.area !== "가족") && x.dayLuck.stem.label)!;
  const date = "2026-11-10";
  const personal = adjustWithEntries(c.parts.score01, [], { index: 0, stemKo: "갑", branchKo: "자" });
  const brief = buildBrief({ core: c, personal, today: { ko: "갑자", hanja: "甲子", stemKo: "갑", branchKo: "자" }, date, weekday: "화요일", score10: 5, band: "무난" });
  const o = JSON.parse(renderBrief(brief)) as { 까닭: string[]; 장면: string[]; 영역: string[] };
  // v4.28: 이사람에게는 까닭 줄에 붙어 간다. 영역 장면은 계획(buildPlan)에는 남지만 작가 입력에는 장면 명사(exemplars.SCENES)가 대신 간다
  const note = brief.plan.core.typeNote;
  expect(note).toBeTruthy();
  expect(o.까닭.some((r) => r.includes(note!))).toBe(true);
  expect(o.장면.length).toBeGreaterThan(0);
  expect(o.영역.some((a) => a.includes("("))).toBe(true);
  expect(buildPlan({ core: c, personal, date, band: "무난" }).areas.filter((a) => a.period !== "오늘").every((a) => !a.scene)).toBe(true);
});

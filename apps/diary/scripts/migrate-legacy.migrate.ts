/**
 * 레거시(journal_entries · diary_entries · saju_profiles) → night_* 이관.
 *
 * 실행 (apps/diary 에서):
 *   npx vitest run --config vitest.scripts.config.ts                 # 점검만 (쓰지 않음)
 *   MIGRATE_APPLY=1 npx vitest run --config vitest.scripts.config.ts # 실제로 쓴다
 *
 * 입력은 0단계 백업 폴더(LEGACY_BACKUP_DIR, 기본 ../backup/2026-10-04_legacy)의 JSON이다. 운영 DB의 레거시 테이블은 읽지 않는다.
 * 규칙 (docs/REBUILD_PLAN.md 4절):
 *   - 익명 계정은 버린다
 *   - 같은 날 여러 행이면 updated_at이 가장 늦은 것
 *   - 행복도 = happiness_score ?? overall_satisfaction, 0은 1로
 *   - 기분은 새 앱 13개 목록에 있는 것만 3개까지. 구 일기의 감정 어휘는 표로 옮긴다
 *   - 구 diary_entries는 같은 날 journal이 없을 때만
 *   - 이미 새 앱에 있는 날은 건드리지 않는다 (앱 기록이 이긴다)
 *   - 사주 프로필은 사용자당 하나(is_primary 우선). 이미 새 프로필이 있으면 건너뛴다
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";
import { MOODS, type Mood } from "@/lib/entry";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type ProfileInput } from "@/lib/profile";
import type { CityId } from "@/lib/cities";

const ROOT = path.resolve(__dirname, "..");
const BACKUP = process.env.LEGACY_BACKUP_DIR ?? path.resolve(ROOT, "../../../backup/2026-10-04_legacy");
const APPLY = process.env.MIGRATE_APPLY === "1";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (line.startsWith("#") || i < 0) continue;
    out[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return out;
}
const table = <T,>(name: string): T[] => JSON.parse(readFileSync(path.join(BACKUP, "tables", `${name}.json`), "utf8")) as T[];

interface AuthUser { id: string; is_anonymous: boolean }
interface LegacyJournal { user_id: string; entry_date: string; updated_at: string; happiness_score: number | null; overall_satisfaction: number | null; mood_labels: string[] | null; mood_label: string | null; content: string | null }
interface LegacyDiary { user_id: string; date: string; updated_at: string; happiness_rating: number | null; emotions: string[] | null; content: string | null }
interface LegacyProfile { user_id: string; label: string | null; is_primary: boolean; updated_at: string; birth_date: string; birth_hour: number | null; birth_minute: number | null; birth_time_unknown: boolean; calendar_type: "solar" | "lunar"; is_leap_month: boolean; gender: "male" | "female"; location_name: string | null; pillars: { year?: { ganjiKo: string }; month?: { ganjiKo: string }; day?: { ganjiKo: string }; hour?: { ganjiKo: string } | null } | null }

/** 구 일기의 감정 → 새 기분 */
const OLD_EMOTION: Record<string, Mood> = {
  평범: "무덤덤", 편안: "평온", 만족: "뿌듯함", 우울: "우울함", 피곤: "지침", 외로움: "슬픔", 무덤덤: "무덤덤", 행복: "기쁨", 복잡함: "답답함",
};
const CITY_BY_NAME: Record<string, CityId> = { 서울: "seoul", 부산: "busan", 대구: "daegu", 인천: "incheon", 광주: "gwangju", 대전: "daejeon", 울산: "ulsan", 제주: "jeju" };

function clampHappiness(v: number | null | undefined): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(1, Math.min(10, Math.round(v)));
}
function moodsOf(list: (string | null | undefined)[]): Mood[] {
  const out: Mood[] = [];
  for (const m of list) {
    if (m && (MOODS as readonly string[]).includes(m) && !out.includes(m as Mood)) out.push(m as Mood);
    if (out.length === 3) break;
  }
  return out;
}
function noteOf(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t ? t.slice(0, 500) : null;
}

export interface EntryPlan { user_id: string; entry_date: string; happiness: number; moods: Mood[]; note: string | null; day_ganji_index: number; day_stem: string; day_branch: string; source: "legacy" }

export function planEntries(journal: LegacyJournal[], diary: LegacyDiary[], realUsers: Set<string>): { rows: EntryPlan[]; dropped: Record<string, number> } {
  const dropped: Record<string, number> = { 익명: 0, 행복도없음: 0, 구일기_겹침: 0 };
  const byKey = new Map<string, LegacyJournal>();
  for (const e of journal) {
    if (!realUsers.has(e.user_id)) { dropped.익명++; continue; }
    const k = `${e.user_id}|${e.entry_date}`;
    const prev = byKey.get(k);
    if (!prev || e.updated_at > prev.updated_at) byKey.set(k, e);
  }
  const rows: EntryPlan[] = [];
  const toRow = (user_id: string, entry_date: string, happiness: number | null, moods: Mood[], note: string | null): EntryPlan | null => {
    if (happiness === null) { dropped.행복도없음++; return null; }
    const g = dayGanji(entry_date);
    return { user_id, entry_date, happiness, moods, note, day_ganji_index: g.index, day_stem: g.stemKo, day_branch: g.branchKo, source: "legacy" };
  };
  for (const e of byKey.values()) {
    const r = toRow(e.user_id, e.entry_date, clampHappiness(e.happiness_score ?? e.overall_satisfaction), moodsOf(e.mood_labels?.length ? e.mood_labels : [e.mood_label]), noteOf(e.content));
    if (r) rows.push(r);
  }
  for (const d of diary) {
    if (!realUsers.has(d.user_id)) { dropped.익명++; continue; }
    if (byKey.has(`${d.user_id}|${d.date}`)) { dropped.구일기_겹침++; continue; }
    const r = toRow(d.user_id, d.date, clampHappiness(d.happiness_rating), moodsOf((d.emotions ?? []).map((x) => OLD_EMOTION[x] ?? x)), noteOf(d.content));
    if (r) rows.push(r);
  }
  return { rows, dropped };
}

export function planProfiles(profiles: LegacyProfile[], realUsers: Set<string>) {
  const byUser = new Map<string, LegacyProfile>();
  for (const p of profiles) {
    if (!realUsers.has(p.user_id)) continue;
    const prev = byUser.get(p.user_id);
    if (!prev || (p.is_primary && !prev.is_primary) || (p.is_primary === prev.is_primary && p.updated_at > prev.updated_at)) byUser.set(p.user_id, p);
  }
  const out: { user_id: string; input: ProfileInput; legacyPillars: string[] }[] = [];
  for (const p of byUser.values()) {
    const [y, m, d] = p.birth_date.split("-").map(Number);
    const cityName = Object.keys(CITY_BY_NAME).find((n) => (p.location_name ?? "").includes(n)) ?? "서울";
    const unknown = p.birth_time_unknown || p.birth_hour === null;
    out.push({
      user_id: p.user_id,
      input: {
        name: (p.label ?? "").trim() || "나",
        gender: p.gender,
        calendar: p.calendar_type,
        isLeapMonth: Boolean(p.is_leap_month),
        birthYear: y!, birthMonth: m!, birthDay: d!,
        birthHour: unknown ? null : p.birth_hour,
        birthMinute: unknown ? null : (p.birth_minute ?? 0),
        city: CITY_BY_NAME[cityName]!,
      },
      legacyPillars: [p.pillars?.year?.ganjiKo, p.pillars?.month?.ganjiKo, p.pillars?.day?.ganjiKo, p.pillars?.hour?.ganjiKo ?? null].map((x) => x ?? "-"),
    });
  }
  return out;
}

describe("레거시 이관", () => {
  test(APPLY ? "실제 이관" : "점검 (쓰지 않음)", async () => {
    const users = JSON.parse(readFileSync(path.join(BACKUP, "auth_users.json"), "utf8")) as AuthUser[];
    const real = new Set(users.filter((u) => !u.is_anonymous).map((u) => u.id));
    const { rows, dropped } = planEntries(table<LegacyJournal>("journal_entries"), table<LegacyDiary>("diary_entries"), real);
    const profiles = planProfiles(table<LegacyProfile>("saju_profiles"), real);

    // 사주 재계산이 레거시 저장값과 같은지 (계산 기준이 같다는 증거)
    let pillarMismatch = 0;
    const computed = profiles.map((p) => {
      const c = computeProfile(p.input);
      if (!c.ok) throw new Error(`프로필 계산 실패 ${p.user_id.slice(0, 8)}: ${c.error}`);
      const mine = [c.value.pillars.year.ko, c.value.pillars.month.ko, c.value.pillars.day.ko, c.value.pillars.hour?.ko ?? "-"];
      if (mine.join() !== p.legacyPillars.join()) { pillarMismatch++; console.log("  네 기둥 불일치", p.user_id.slice(0, 8), "레거시", p.legacyPillars.join(" "), "재계산", mine.join(" ")); }
      return { ...p, computed: c.value };
    });

    console.log(`\n기록 ${rows.length}건 (사용자 ${new Set(rows.map((r) => r.user_id)).size}명), 버림 ${JSON.stringify(dropped)}`);
    console.log(`프로필 ${profiles.length}명, 네 기둥 불일치 ${pillarMismatch}`);
    console.log(`행복도 분포 ${JSON.stringify(rows.reduce((a, r) => ((a[r.happiness] = (a[r.happiness] ?? 0) + 1), a), {} as Record<number, number>))}`);
    expect(rows.length).toBeGreaterThan(80);
    expect(pillarMismatch).toBe(0);

    if (!APPLY) { console.log("MIGRATE_APPLY=1 이 아니라 쓰지 않았어요."); return; }

    const env = loadEnv();
    const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const userIds = [...new Set([...rows.map((r) => r.user_id), ...profiles.map((p) => p.user_id)])];

    // 1) 사용자 행
    const now = new Date().toISOString();
    for (const id of userIds) {
      const { error } = await sb.from("night_profiles").upsert({ user_id: id, migrated_from_legacy: now }, { onConflict: "user_id" });
      if (error) throw new Error(`night_profiles ${id.slice(0, 8)}: ${error.message}`);
    }
    // 2) 사주 프로필 — 이미 있으면 건너뜀
    const { data: existing } = await sb.from("night_saju_profiles").select("user_id").in("user_id", userIds);
    const has = new Set((existing ?? []).map((r) => r.user_id as string));
    let insertedProfiles = 0;
    for (const p of computed) {
      if (has.has(p.user_id)) continue;
      const i = p.input;
      const { error } = await sb.from("night_saju_profiles").insert({
        user_id: p.user_id, name: i.name, gender: i.gender, calendar: i.calendar, is_leap_month: i.isLeapMonth,
        birth_year: i.birthYear, birth_month: i.birthMonth, birth_day: i.birthDay, birth_hour: i.birthHour, birth_minute: i.birthMinute,
        city: i.city, pillars: p.computed.pillars, engine_version: p.computed.engineVersion,
      });
      if (error) throw new Error(`night_saju_profiles ${p.user_id.slice(0, 8)}: ${error.message}`);
      insertedProfiles++;
    }
    // 3) 기록 — 같은 날이 이미 있으면 그대로 둔다
    const { error: e3, data: inserted } = await sb
      .from("night_entries")
      .upsert(rows, { onConflict: "user_id,entry_date", ignoreDuplicates: true })
      .select("id");
    if (e3) throw new Error(`night_entries: ${e3.message}`);
    console.log(`\n썼어요: 사용자 ${userIds.length}, 프로필 ${insertedProfiles} (건너뜀 ${has.size}), 기록 ${inserted?.length ?? 0} (중복 건너뜀 ${rows.length - (inserted?.length ?? 0)})`);
  }, 120_000);
});

// 운영 숫자 (v3.17, 2026-10-10 로드맵 2번 "측정"). 새 추적 없이 이미 있는 테이블에서 날짜별로 센다.
// - 방문: night_fortunes(사용자 × 날짜에 한 행, 오늘 화면을 열면 생긴다). 생년월일을 넣은 사람만 잡힌다.
// - 신규: night_saju_profiles.created_at(한국 날짜)
// - 기록: night_entries.created_at(쓴 날 기준 — 과거 날짜를 채워 쓴 것도 쓴 날로 센다)
// - 투표: night_fortune_feedback.fortune_date / 공유: night_share_events.created_at
// 화면에는 합계만 보인다. 사용자 ID는 서버 안에서 "같은 사람인가"를 셀 때만 쓰고 밖으로 나가지 않는다.
import { addDays } from "./time";

export interface MetricRows {
  /** fortune_date (YYYY-MM-DD) */
  visits: { user_id: string; day: string }[];
  /** 가입(생년월일 저장) 한국 날짜 */
  signups: { user_id: string; day: string }[];
  /** 기록을 쓴 한국 날짜 */
  records: { user_id: string; day: string }[];
  votes: { day: string }[];
  shares: { day: string }[];
}

export interface DayMetric {
  day: string;
  visitors: number;
  newUsers: number;
  recorders: number;
  records: number;
  votes: number;
  /** 투표 / 방문자, 0~100 정수. 방문 0이면 null */
  voteRate: number | null;
  shares: number;
}

export interface Retention {
  /** 가입 날 기준 묶음 크기 */
  cohort: number;
  /** 다음 날 다시 온 비율 (0~100). 아직 다음 날이 안 왔거나 묶음이 0이면 null */
  d1: number | null;
  /** 7일째 다시 온 비율 */
  d7: number | null;
}

const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((100 * a) / b) : null);

/** 오늘 포함 최근 days일(최신이 위) 날짜별 숫자 */
export function dailyMetrics(rows: MetricRows, today: string, days = 14): DayMetric[] {
  const out: DayMetric[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, -i);
    const visitors = new Set(rows.visits.filter((v) => v.day === day).map((v) => v.user_id)).size;
    const recs = rows.records.filter((r) => r.day === day);
    const votes = rows.votes.filter((v) => v.day === day).length;
    out.push({
      day,
      visitors,
      newUsers: new Set(rows.signups.filter((s) => s.day === day).map((s) => s.user_id)).size,
      recorders: new Set(recs.map((r) => r.user_id)).size,
      records: recs.length,
      votes,
      voteRate: pct(votes, visitors),
      shares: rows.shares.filter((s) => s.day === day).length,
    });
  }
  return out;
}

/**
 * 재방문율: 기간 안에 가입한 사람들이 가입 다음 날(D1) · 7일째(D7)에 오늘 화면을 열었나.
 * 그 날이 아직 오지 않은 사람은 분모에서 뺀다.
 */
export function retention(rows: MetricRows, today: string): Retention {
  const visitSet = new Set(rows.visits.map((v) => `${v.user_id}|${v.day}`));
  const firstSignup = new Map<string, string>();
  for (const s of rows.signups) if (!firstSignup.has(s.user_id) || s.day < firstSignup.get(s.user_id)!) firstSignup.set(s.user_id, s.day);
  let d1n = 0, d1d = 0, d7n = 0, d7d = 0;
  for (const [uid, day] of firstSignup) {
    const n1 = addDays(day, 1), n7 = addDays(day, 7);
    if (n1 <= today) {
      d1d++;
      if (visitSet.has(`${uid}|${n1}`)) d1n++;
    }
    if (n7 <= today) {
      d7d++;
      if (visitSet.has(`${uid}|${n7}`)) d7n++;
    }
  }
  return { cohort: firstSignup.size, d1: pct(d1n, d1d), d7: pct(d7n, d7d) };
}

/** timestamptz 문자열 → 한국 날짜 YYYY-MM-DD */
export function kstDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

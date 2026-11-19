import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { dailyMetrics, kstDay, retention, type MetricRows } from "@/lib/metrics";
import { addDays, todayKST } from "@/lib/time";
import { stateIntensity } from "@/lib/stats/states";
import type { States } from "@/lib/entry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "운영 숫자", robots: { index: false, follow: false } };

/**
 * 운영 숫자 화면 (v3.17, 로드맵 2번). 주소 `/stats?key=…` — key가 환경변수 STATS_KEY와 같을 때만 열린다(아니면 404).
 * 합계만 보여 준다. 사용자 ID·기록 내용은 화면에 나오지 않는다. 숫자 정의는 lib/metrics.ts 머리 주석.
 */
const PAGE = 1000;

/** PostgREST 기본 1000행 제한을 넘겨 다 받는다 */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  const secret = process.env.STATS_KEY;
  if (!secret || key !== secret) notFound();

  const today = todayKST();
  const fromDay = addDays(today, -35);
  const fromIso = `${addDays(fromDay, -1)}T15:00:00Z`; // 한국 fromDay 0시
  const sb = adminClient();

  const [visits, signups, records, votes, shares, totalUsers, totalRecords, stateRows, masters] = await Promise.all([
    fetchAll<{ user_id: string; fortune_date: string }>((a, b) => sb.from("night_fortunes").select("user_id, fortune_date").not("user_id", "is", null).gte("fortune_date", fromDay).range(a, b)),
    fetchAll<{ user_id: string; created_at: string }>((a, b) => sb.from("night_saju_profiles").select("user_id, created_at").gte("created_at", fromIso).range(a, b)),
    fetchAll<{ user_id: string; created_at: string }>((a, b) => sb.from("night_entries").select("user_id, created_at").gte("created_at", fromIso).range(a, b)),
    fetchAll<{ fortune_date: string }>((a, b) => sb.from("night_fortune_feedback").select("fortune_date").gte("fortune_date", fromDay).range(a, b)),
    // 0004 마이그레이션 전이면 테이블이 없다 — 빈 배열로
    fetchAll<{ created_at: string }>((a, b) => sb.from("night_share_events").select("created_at").gte("created_at", fromIso).range(a, b)).catch(() => []),
    sb.from("night_saju_profiles").select("user_id", { count: "exact", head: true }),
    sb.from("night_entries").select("id", { count: "exact", head: true }),
    // 있었던 일 세기 (2026-11-20, 뒤에서만 재기): 상태를 고른 기록 전부와 그 사람의 일간. 0007 적용 전이면 빈 배열
    fetchAll<{ user_id: string; day_stem: string; day_branch: string; states: States | null }>((a, b) => sb.from("night_entries").select("user_id, day_stem, day_branch, states").not("states", "is", null).range(a, b)).catch(() => []),
    fetchAll<{ user_id: string; pillars: { day?: { stem?: string } } | null }>((a, b) => sb.from("night_saju_profiles").select("user_id, pillars").range(a, b)).catch(() => []),
  ]);
  const masterOf = new Map(masters.flatMap((p) => (p.pillars?.day?.stem ? [[p.user_id, p.pillars.day.stem] as [string, string]] : [])));
  const intensity = stateIntensity(
    stateRows.flatMap((r) => {
      const dm = masterOf.get(r.user_id);
      return dm ? [{ entry_date: "", day_stem: r.day_stem, day_branch: r.day_branch, states: r.states, dayMaster: dm }] : [];
    }),
  );
  const fx = (x: number | null) => (x === null ? "-" : x.toFixed(2));

  const rows: MetricRows = {
    visits: visits.map((v) => ({ user_id: v.user_id, day: v.fortune_date })),
    signups: signups.map((s) => ({ user_id: s.user_id, day: kstDay(s.created_at) })),
    records: records.map((r) => ({ user_id: r.user_id, day: kstDay(r.created_at) })),
    votes: votes.map((v) => ({ day: v.fortune_date })),
    shares: shares.map((s) => ({ day: kstDay(s.created_at) })),
  };
  const days = dailyMetrics(rows, today, 14);
  const ret = retention(rows, today);
  const week = days.slice(0, 7);
  const sum = (k: "visitors" | "newUsers" | "records" | "votes" | "shares") => week.reduce((a, d) => a + d[k], 0);

  return (
    <main className="flex flex-col gap-5 pb-10">
      <header>
        <h1 className="font-serif text-[24px]">운영 숫자</h1>
        <p className="mt-1 text-sm text-muted">{today} 기준. 합계만 보여요.</p>
      </header>

      <section className="card-frame card-paper p-5">
        <h2 className="text-[15px] font-bold">전체</h2>
        <dl className="kv mt-2">
          <div className="kv__row">
            <dt>가입한 사람(생년월일 저장)</dt>
            <dd>{totalUsers.count ?? 0}명</dd>
          </div>
          <div className="kv__row">
            <dt>전체 기록</dt>
            <dd>{totalRecords.count ?? 0}건</dd>
          </div>
        </dl>
      </section>

      <section className="card-frame card-paper p-5">
        <h2 className="text-[15px] font-bold">재방문 (최근 35일 가입 {ret.cohort}명)</h2>
        <dl className="kv mt-2">
          <div className="kv__row">
            <dt>다음 날 다시 옴</dt>
            <dd>{ret.d1 === null ? "아직" : `${ret.d1}%`}</dd>
          </div>
          <div className="kv__row">
            <dt>7일째 다시 옴 (목표 30%)</dt>
            <dd>{ret.d7 === null ? "아직" : `${ret.d7}%`}</dd>
          </div>
        </dl>
      </section>

      <section className="card-frame card-paper p-5">
        <h2 className="text-[15px] font-bold">최근 7일 합계</h2>
        <dl className="kv mt-2">
          <div className="kv__row">
            <dt>방문(사람×날)</dt>
            <dd>{sum("visitors")}</dd>
          </div>
          <div className="kv__row">
            <dt>새로 온 사람</dt>
            <dd>{sum("newUsers")}명</dd>
          </div>
          <div className="kv__row">
            <dt>기록</dt>
            <dd>{sum("records")}건</dd>
          </div>
          <div className="kv__row">
            <dt>운세 투표</dt>
            <dd>{sum("votes")}번</dd>
          </div>
          <div className="kv__row">
            <dt>공유</dt>
            <dd>{sum("shares")}번</dd>
          </div>
        </dl>
      </section>

      <section className="card-frame card-paper p-5">
        <h2 className="text-[15px] font-bold">날짜별 (최근 14일)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-right text-[13px] tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-1 text-left font-normal">날짜</th>
                <th className="font-normal">방문</th>
                <th className="font-normal">신규</th>
                <th className="font-normal">기록</th>
                <th className="font-normal">투표율</th>
                <th className="font-normal">공유</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-t border-line/40">
                  <td className="py-1.5 text-left">{d.day.slice(5).replace("-", "/")}</td>
                  <td>{d.visitors}</td>
                  <td>{d.newUsers}</td>
                  <td>{d.records}</td>
                  <td>{d.voteRate === null ? "-" : `${d.voteRate}%`}</td>
                  <td>{d.shares}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-muted">방문은 오늘 화면을 연 사람 수예요(생년월일을 넣은 사람만). 기록은 쓴 날 기준이에요.</p>
      </section>

      <section className="card-frame card-paper p-5">
        <h2 className="text-[15px] font-bold">있었던 일 세기 (상태를 고른 기록 {stateRows.length}건)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-right text-[13px] tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-1 text-left font-normal">축</th>
                <th className="font-normal">전체</th>
                <th className="font-normal">그 기운 온 날</th>
                <th className="font-normal">다른 날</th>
                <th className="font-normal">차이</th>
              </tr>
            </thead>
            <tbody>
              {intensity.map((r) => (
                <tr key={r.axis} className="border-t border-line/40">
                  <td className="py-1.5 text-left">{r.label}</td>
                  <td>
                    {fx(r.all.mean)} ({r.all.n})
                  </td>
                  <td>{r.group ? `${fx(r.on.mean)} (${r.on.n})` : "-"}</td>
                  <td>{r.group ? `${fx(r.off.mean)} (${r.off.n})` : "-"}</td>
                  <td>{r.diff === null ? "-" : `${r.diff > 0 ? "+" : ""}${r.diff.toFixed(2)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          세기는 고른 단계 그대로 1~3이에요(좋고 나쁨이 아니라 얼마나 드러났나). 괄호는 날 수. 차이가 +면 운세가 말한 기운이 온 날에 그 일이 실제로 더 있었다는 뜻이고, 양쪽 다 5일 이상일 때만 내요.
        </p>
      </section>
    </main>
  );
}

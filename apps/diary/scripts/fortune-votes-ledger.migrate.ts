// 2026-11-17 기록 반영 설계 Q9(앱 주인 "추천대로"): 맞아요/아니에요는 만드는 사람이 보는 품질 신호 — 원문을 쌓고 주 1회 묶어 본다.
// 운영 DB를 읽기만 한다(쓰기 없음). 사용자 ID·기록 내용은 남기지 않는다 — "주인" / "사용자 1, 2…"로만. 비밀값은 출력하지 않는다.
// 실행 (apps/diary): npx vitest run --config vitest.scripts.config.ts scripts/fortune-votes-ledger.migrate.ts
//   결과: 사주 일기/피드백/투표/투표_원문.md (아니에요 전부, 최근부터) · 투표_주별.md (주마다 맞아요·아니에요·이유·갈래)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createClient } from "@supabase/supabase-js";

const OUT = path.resolve(__dirname, "../../../../피드백/투표");
const OWNER_PREFIX = "1aa4bbd3";
const REASON = { content: "내용이 안 맞았어요", obvious: "너무 뻔했어요", awkward: "문장이 어색했어요" } as Record<string, string>;
type Vote = { user_id: string; fortune_date: string; vote: 1 | -1; reason?: string | null };
type Fortune = { user_id: string; fortune_date: string; headline: string | null; band: string | null; sf: string | null; bf: string | null; ver: string | null };

/** 월요일 시작 주 — "2026-11-16 주" */
function weekOf(d: string): string {
  const t = new Date(d + "T00:00:00Z"); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day); return t.toISOString().slice(0, 10);
}

test("투표 원장", async () => {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const all = async <T,>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> => {
    const out: T[] = [];
    for (let a = 0; ; a += 1000) { const { data, error } = await q(a, a + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break; }
    return out;
  };
  let votes: Vote[];
  try { votes = await all<Vote>((a, b) => sb.from("night_fortune_feedback").select("user_id, fortune_date, vote, reason").order("fortune_date").range(a, b)); }
  catch { votes = await all<Vote>((a, b) => sb.from("night_fortune_feedback").select("user_id, fortune_date, vote").order("fortune_date").range(a, b)); }
  const from = votes[0]?.fortune_date ?? "2026-01-01";
  const fortunes = await all<Fortune>((a, b) => sb.from("night_fortunes").select("user_id, fortune_date, headline:content->>headline, band:content->>band, sf:content->core->dayLuck->stem->>family, bf:content->core->dayLuck->branch->>family, ver:content->metrics->>promptVersion").not("user_id", "is", null).gte("fortune_date", from).range(a, b));
  const fx = new Map(fortunes.map((f) => [`${f.user_id}|${f.fortune_date}`, f]));
  const names = new Map<string, string>();
  const who = (id: string) => { if (id.startsWith(OWNER_PREFIX)) return "주인"; if (!names.has(id)) names.set(id, `사용자 ${names.size + 1}`); return names.get(id)!; };
  for (const v of votes) who(v.user_id);   // 처음 투표한 순서로 번호

  const no = votes.filter((v) => v.vote === -1).sort((a, b) => (a.fortune_date < b.fortune_date ? 1 : -1));
  const raw = [`# 운세 투표 — "아니에요" 원문 (${new Date().toISOString().slice(0, 10)} 기준, 최근부터)`, "", "운영 DB를 읽기만 해서 만든다(scripts/fortune-votes-ledger.migrate.ts). 사용자 ID는 남기지 않는다.", "",
    "| 날 | 누구 | 이유 | 단계 | 그날 성격(천간·지지) | 제목 | 글 판본 |", "|---|---|---|---|---|---|---|",
    ...no.map((v) => { const f = fx.get(`${v.user_id}|${v.fortune_date}`); return `| ${v.fortune_date} | ${who(v.user_id)} | ${v.reason ? REASON[v.reason] ?? v.reason : "고르지 않음"} | ${f?.band ?? "-"} | ${f?.sf ?? "?"}·${f?.bf ?? "?"} | ${(f?.headline ?? "(운세 없음)").replace(/\|/g, "/")} | ${f?.ver ?? "-"} |`; })];

  const weeks = new Map<string, Vote[]>();
  for (const v of votes) { const w = weekOf(v.fortune_date); weeks.set(w, [...(weeks.get(w) ?? []), v]); }
  const sum = [`# 운세 투표 — 주별 (${new Date().toISOString().slice(0, 10)} 기준)`, "", "맞아요/아니에요는 운세를 자동으로 바꾸지 않는다 — 만드는 사람이 읽는 품질 신호(기록 반영 설계 Q2·Q9).", "",
    "| 주(월요일) | 맞아요 | 아니에요 | 이유: 내용 · 뻔함 · 문장 · 안 고름 | 아니에요가 많은 성격 갈래 |", "|---|---|---|---|---|"];
  for (const [w, vs] of [...weeks].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
    const n = vs.filter((v) => v.vote === -1);
    const r = (k: string | null) => n.filter((v) => (v.reason ?? null) === k).length;
    const fam: Record<string, number> = {};
    for (const v of n) { const f = fx.get(`${v.user_id}|${v.fortune_date}`); for (const x of new Set([f?.sf, f?.bf].filter(Boolean) as string[])) fam[x] = (fam[x] ?? 0) + 1; }
    const top = Object.entries(fam).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, c]) => `${k} ${c}`).join(" · ") || "-";
    sum.push(`| ${w} | ${vs.length - n.length} | ${n.length} | ${r("content")} · ${r("obvious")} · ${r("awkward")} · ${r(null)} | ${top} |`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, "투표_원문.md"), raw.join("\n") + "\n", "utf8");
  writeFileSync(path.join(OUT, "투표_주별.md"), sum.join("\n") + "\n", "utf8");
  console.log(`투표 ${votes.length} · 아니에요 ${no.length} · 사람 ${names.size + (votes.some((v) => v.user_id.startsWith(OWNER_PREFIX)) ? 1 : 0)}`);
  console.log(sum.join("\n"));
}, 120_000);

// v5 (2026-11-14) 단락 사전으로 쓴 글 — 미리보기와 시안.
//   기본(모델 호출 없음): 앱 주인 프로필로 날짜마다 (1) 사전에서 무엇을 골랐는지 (2) 편집자에게 가는 입력 (3) 사전 단락만으로 엮은 글을 남긴다.
//   V5_WRITE=1: 편집자(모델)가 실제로 엮는다 — 모델 호출 = 비용. 앱 주인 확인 뒤에만 돌린다.
// 실행 (apps/diary):
//   npx vitest run --config vitest.scripts.config.ts scripts/fortune-v5-sample.migrate.ts
//   V5_WRITE=1 SAMPLE_DATES=2026-12-01,2026-12-02 npx vitest run --config vitest.scripts.config.ts scripts/fortune-v5-sample.migrate.ts
//   기본값: 프로필 = 피드백/사주바탕/프로필_주인.json, 점수·단계 = 피드백/11.10_재설계_시안/D12_주인_계획.json(없는 날은 계산값), 결과 = 피드백/11.14_v5_시안/
//   .env.local의 ANTHROPIC_API_KEY만 읽고 값은 출력하지 않는다.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { buildBrief, TEN_GOD_PLAIN, type BriefInput, type RecentFortune } from "@/lib/fortune/brief";
import { v5Fallback, type V5Material, type V5Part } from "@/lib/fortune/compose";
import { sealsOf, type FortuneSeal } from "@/lib/fortune/seals";
import { computeCoreFortune } from "@/lib/fortune/core";
import { generateFortuneText } from "@/lib/fortune/llm";
import { bandOf, toTenPoint } from "@/lib/fortune/personal";
import { renderBriefV5 } from "@/lib/fortune/v5";
import { recallOf, recordLineOf, type RecallEntry } from "@/lib/fortune/recall";
import { checkDraft, joinBody, type Draft } from "@/lib/fortune/validate";
import { dayGanji } from "@/lib/ganji";
import type { BirthProfile, PillarsSnapshot } from "@/lib/profile";

const ROOT = path.resolve(__dirname, "..");
const DIARY = path.resolve(ROOT, "../../..");
const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const daySeedOf = (d: string): number => Math.round(Date.parse(d + "T00:00:00Z") / 86400000);
const DEFAULT_DATES = Array.from({ length: 14 }, (_, i) => `2026-12-${String(i + 1).padStart(2, "0")}`).join(",");

function loadEnv(): void {
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (line.startsWith("#") || i < 0) continue;
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
}

type Plans = Record<string, { date: string; score: number; band: "좋음" | "무난" | "주의" }>;
type Saved = { date: string; ganji: string; score: number; band: string; source: string; attempts: number; patches: number; issues: string[][]; usage: { input: number; output: number; cacheRead: number; cacheWrite: number }; cost: number; fallback?: string; text: { headline: string; body: string; do: string; dont: string }; bodySentences?: string[]; split?: number; lastDraft?: { headline: string; body: string[] }; promptVersion: string; material: V5Material; seals?: FortuneSeal[]; record?: { key: string; text: string }; madeAt: string };

const FACE = { use: "잘 쓸 때", strong: "세질 때", both: "잘 쓸 때 + 부담" } as const;
const partLine = (p: V5Part): string => `${p.자리} ${p.tenGod}(${TEN_GOD_PLAIN[p.tenGod].짧게}) · ${FACE[p.face]}`;

test("v5 단락 사전 글감 미리보기 / 시안", async () => {
  const write = process.env.V5_WRITE === "1";
  if (write) { loadEnv(); if (!process.env.ANTHROPIC_API_KEY) throw new Error(".env.local에 ANTHROPIC_API_KEY가 필요합니다"); }
  const profilePath = process.env.BASIS_PROFILE ?? path.join(DIARY, "피드백/사주바탕/프로필_주인.json");
  // 2026-11-17 기록 반영 시안: 기록(고른 값만) JSON — 있으면 날마다 기록 한 줄(recall.ts recordLineOf)을 글감에 넣는다
  const entries: RecallEntry[] = process.env.BASIS_ENTRIES && existsSync(process.env.BASIS_ENTRIES) ? JSON.parse(readFileSync(process.env.BASIS_ENTRIES, "utf8")) : [];
  const plansPath = process.env.BASIS_PLANS ?? path.join(DIARY, "피드백/11.10_재설계_시안/D12_주인_계획.json");
  const out = process.env.V5_OUT ?? path.join(DIARY, "피드백/11.14_v5_시안");
  const dates = (process.env.SAMPLE_DATES ?? DEFAULT_DATES).split(",");
  const maxAttempts = Number(process.env.SAMPLE_ATTEMPTS ?? 3);
  const PRICE_IN = Number(process.env.SAMPLE_PRICE_IN ?? 3), PRICE_OUT = Number(process.env.SAMPLE_PRICE_OUT ?? 15);
  mkdirSync(path.join(out, "시안"), { recursive: true });

  const prof = JSON.parse(readFileSync(profilePath, "utf8")) as { pillars: PillarsSnapshot; profile: BirthProfile | null };
  const plans: Plans = existsSync(plansPath) ? Object.fromEntries((JSON.parse(readFileSync(plansPath, "utf8")) as Plans[string][]).map((p) => [p.date, p])) : {};

  const md: string[] = ["# v5 글감 미리보기 — 단락 사전에서 고른 것과 사전만으로 엮은 글 (모델 호출 없음)", "", `만든 날 ${new Date().toISOString().slice(0, 10)} · 프로필 ${path.basename(profilePath)} · 날짜 ${dates[0]} ~ ${dates.at(-1)}`, "",
    "날마다 (1) 코드가 사전에서 고른 단락, (2) 사전 문장만 순서대로 이은 글(모델이 실패했을 때 화면에 나갈 글)을 적었다. 편집자(모델)가 엮은 글은 `나란히.md`에 있다.", ""];
  const recent: RecentFortune[] = [];   // 앞 날짜에 쓴 글을 다음 날의 "최근 글"로 넘긴다 (같은 끝인사·제목을 피하게)
  let usd = 0;
  for (const date of dates) {
    const g = dayGanji(date);
    const core = computeCoreFortune({ pillars: prof.pillars, profile: prof.profile, date, todayHanja: g.hanja });
    const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
    const plan = plans[date];
    const score10 = plan?.score ?? toTenPoint(core.parts.score01);
    const band = plan?.band ?? bandOf(score10);
    const personal = { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: core.parts.score01, shift: 0 };
    const record = entries.length ? recordLineOf(recallOf(entries, date, [core.dayLuck.stem.family, core.dayLuck.branch.family], prof.pillars.day.stem), recent.filter((x) => daySeedOf(date) - daySeedOf(x.date) <= 7).flatMap((x) => (x.recordKey ? [x.recordKey] : []))) : null;
    const input: BriefInput = { recordLine: record?.text ?? null, core, personal, today: { ko: g.ko, hanja: g.hanja, stemKo: g.stemKo, branchKo: g.branchKo }, date, weekday: WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]!, score10, band, recent: [...recent], dayMaster: prof.pillars.day.stem, v5: true };
    const brief = buildBrief(input);
    const m = brief.v5!;
    const fb = v5Fallback(m);
    const fbDraft: Draft = { headline: fb.headline, body: [...fb.first, ...fb.second], split: fb.first.length, areaLines: [], do: fb.do, dont: fb.dont };
    const fbIssues = checkDraft(fbDraft, brief, { minBody: 3 });
    const fallback = { headline: fb.headline, body: joinBody(fbDraft.body, fbDraft.split), do: fb.do, dont: fb.dont };

    md.push(`## ${date} · ${g.ko}일 · ${score10} ${band}`, "");
    md.push(`- 기록 한 줄: ${record ? `${record.text} (${record.key})` : "없음"}`, "");
    md.push(`- 중심: ${partLine(m.core)}`, m.other ? `- 곁: ${partLine(m.other)}` : `- 겹침: 같은 십신이 두 번`, `- 둘 사이: ${m.core.family}+${m.other?.family ?? m.core.family}${m.연결문 ? " · 편·정 연결문 있음" : ""}`,
      `- 닿는 자리: ${m.자리 ? `${m.자리.pos}지 ${m.자리.kind}` : "없음"}${core.relations.hits.length ? ` (코어가 본 것: ${core.relations.hits.map((h) => `${h.pos}지 ${h.kind}`).join(", ")})` : ""}`,
      "");
    md.push(`**사전만으로 엮은 글**${fbIssues.length ? ` — 검사에 걸림: ${fbIssues.map((i) => i.msg).join(" / ")}` : ""}`, "", `> **${fb.headline}**`, ">", `> ${fb.first.join(" ")}`, ">", `> ${fb.second.join(" ")}`, ">", `> 하면: ${fb.do} / 피해요: ${fb.dont}`, "");
    md.push("<details><summary>편집자에게 가는 입력</summary>", "", "```json", JSON.stringify(JSON.parse(renderBriefV5(brief)), null, 1), "```", "</details>", "");

    let lines = fbDraft.body, headline = fb.headline, actions = [fb.do, fb.dont];
    if (write) {
      const r = await generateFortuneText(input, fallback, { maxAttempts, reviewModel: null });
      const cost = (r.usage.input + r.usage.cacheWrite * 1.25 + r.usage.cacheRead * 0.1) / 1e6 * PRICE_IN + r.usage.output / 1e6 * PRICE_OUT;
      usd += cost;
      const split = r.bodySentences && r.text.body.includes("\n\n") ? r.text.body.split("\n\n")[0]!.split(/(?<=[.!?])\s+/).length : undefined;
      const seals = sealsOf(m, r.source === "llm" ? r.text.headline : fb.headline, recent.slice(0, 7).flatMap((x) => x.seals ?? []));
      const saved: Saved = { date, ganji: g.ko, score: score10, band, source: r.source, attempts: r.attempts, patches: r.patches, issues: r.issues, usage: r.usage, cost, ...(r.metrics.fallback ? { fallback: r.metrics.fallback } : {}), text: r.text, bodySentences: r.bodySentences, ...(split ? { split } : {}), lastDraft: r.lastDraft, promptVersion: r.metrics.promptVersion, material: m, seals, ...(record ? { record } : {}), madeAt: new Date().toISOString() };
      writeFileSync(path.join(out, "시안", `${date}.json`), JSON.stringify(saved, null, 1), "utf8");
      if (r.source === "llm" && r.bodySentences) { lines = r.bodySentences; headline = r.text.headline; actions = [r.text.do, r.text.dont]; }
    }
    const daySeals = sealsOf(m, headline, recent.slice(0, 7).flatMap((x) => x.seals ?? [])).map((s) => s.word);
    recent.unshift({ date, headline, start: lines.slice(0, 2).join(" "), lines, actions, seals: daySeals, ...(record ? { recordKey: record.key } : {}) });
  }
  writeFileSync(path.join(out, "글감_미리보기.md"), md.join("\n"), "utf8");

  if (write) {
    const all = readdirSync(path.join(out, "시안")).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(path.join(out, "시안", f), "utf8")) as Saved);
    const cell = (s: string) => s.replace(/\|/g, "／").replace(/\n+/g, "<br><br>");
    const side: string[] = ["# v5 시안 — 사전만으로 엮은 글과 편집자(모델)가 엮은 글을 나란히", "", `마지막으로 쓴 날 ${new Date().toISOString().slice(0, 10)} · 날짜 ${all.map((s) => s.date).join(", ")}`, ""];
    for (const s of all) {
      const fb = v5Fallback(s.material);
      side.push(`## ${s.date} · ${s.ganji}일 · ${s.score} ${s.band}`, "", `| 사전만으로 | 편집자가 엮은 글 (${s.source === "llm" ? `모델, 호출 ${s.attempts}회` : `사전 글로 떨어짐 — ${s.fallback ?? ""}`}) |`, "|---|---|",
        `| **${cell(fb.headline)}** | **${cell(s.text.headline)}** |`, `| ${cell(`${fb.first.join(" ")}\n\n${fb.second.join(" ")}`)} | ${cell(s.text.body)} |`, `| 하면: ${cell(fb.do)}<br>피해요: ${cell(fb.dont)} | 하면: ${cell(s.text.do)}<br>피해요: ${cell(s.text.dont)} |`, "");
      if (s.issues.some((xs) => xs.length)) side.push(`검사에 걸렸던 것: ${s.issues.map((xs, i) => `${i + 1}회차 ${xs.length ? xs.join(" / ") : "통과"}`).join(" → ")}`, "");
      side.push(`토큰 in ${s.usage.input} (cache w ${s.usage.cacheWrite} r ${s.usage.cacheRead}) out ${s.usage.output} · 추정 ${s.cost.toFixed(3)}달러`, "");
    }
    side.push("---", `이번 실행 추정 비용 ${usd.toFixed(3)}달러 · 전체 ${all.reduce((n, s) => n + s.cost, 0).toFixed(3)}달러 (단가 in ${PRICE_IN} / out ${PRICE_OUT} 달러/백만 토큰 가정)`);
    writeFileSync(path.join(out, "나란히.md"), side.join("\n"), "utf8");
    console.log(`v5 시안 ${dates.length}편 · 추정 ${usd.toFixed(3)}달러`);
  } else console.log(md.filter((l) => l.startsWith("## ") || l.startsWith("- ") || l.startsWith("**사전만")).join("\n"));
}, 900_000);

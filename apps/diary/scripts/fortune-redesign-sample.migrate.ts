// v4.27 (2026-11-10) 재설계 시안 — 앱 주인 프로필로 날짜마다 새 입력·지시로 글을 실제로 쓴다 (모델 호출 = 비용).
//   운영 글(v4.21)과 나란히 놓은 markdown을 만들어 앱 주인이 원장 방식으로 읽는다. 배포 판정은 그 읽기만으로 한다.
// 실행 (apps/diary):
//   SAMPLE_DATES=2026-12-01,2026-12-02,2026-12-03 BASIS_PLANS=<D12 계획 json> npx vitest run --config vitest.scripts.config.ts scripts/fortune-redesign-sample.migrate.ts
//   기본값: 프로필 = 피드백/사주바탕/프로필_주인.json, 운영 글 = 피드백/11.10_재설계_시안/운영글.json, 결과 = 피드백/11.10_재설계_시안/
//   SAMPLE_ATTEMPTS(기본 3 = 초안 + 수리 2라운드). .env.local의 ANTHROPIC_API_KEY만 읽고 값은 출력하지 않는다.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { buildBrief, renderBrief } from "@/lib/fortune/brief";
import { generateFortuneText } from "@/lib/fortune/llm";
import { templateInputFromCore, templateText } from "@/lib/fortune/text";
import { EXEMPLARS } from "@/lib/fortune/exemplars";
import { ownerInputs } from "./fortune-ledger-check.migrate";

const ROOT = path.resolve(__dirname, "..");
const DIARY = path.resolve(ROOT, "../../..");

function loadEnv(): void {
  for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (line.startsWith("#") || i < 0) continue;
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
}

type ProdText = { date: string; headline: string; sentences: string[]; doText: string; dontText: string; score: number; band: string };

test("v4.27 재설계 시안 쓰기", async () => {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) throw new Error(".env.local에 ANTHROPIC_API_KEY가 필요합니다");
  const profilePath = process.env.BASIS_PROFILE ?? path.join(DIARY, "피드백/사주바탕/프로필_주인.json");
  const out = process.env.BASIS_CHECK_OUT ?? path.join(DIARY, "피드백/11.10_재설계_시안");
  const dates = (process.env.SAMPLE_DATES ?? "2026-12-01,2026-12-02,2026-12-03,2026-12-04,2026-12-05,2026-12-06,2026-12-07").split(",");
  const prodPath = path.join(out, "운영글.json");
  const prod: Record<string, ProdText> = existsSync(prodPath) ? Object.fromEntries((JSON.parse(readFileSync(prodPath, "utf8")) as ProdText[]).map((t) => [t.date, t])) : {};
  const maxAttempts = Number(process.env.SAMPLE_ATTEMPTS ?? 3);
  // 추정 단가(달러/백만 토큰). 실제 청구와 다를 수 있다 — 자릿수 확인용
  const PRICE_IN = Number(process.env.SAMPLE_PRICE_IN ?? 3), PRICE_OUT = Number(process.env.SAMPLE_PRICE_OUT ?? 15);

  const dir = path.join(out, "시안");
  mkdirSync(dir, { recursive: true });
  type Saved = { date: string; ganji: string; score: number; band: string; source: string; attempts: number; patches: number; issues: string[][]; usage: { input: number; output: number; cacheRead: number; cacheWrite: number }; cost: number; fallback?: string; text: { headline: string; body: string; do: string; dont: string }; bodySentences?: string[]; split?: number; lastDraft?: { headline: string; body: string[] }; plan: unknown; brief: unknown; madeAt: string };
  let usd = 0;
  for (const { date, input } of ownerInputs({ profilePath, plansPath: process.env.BASIS_PLANS, dates })) {
    const brief = buildBrief(input);
    const fallback = templateText(templateInputFromCore(input.core), input.personal, input.today);
    const r = await generateFortuneText(input, fallback, { maxAttempts, reviewModel: null });
    const cost = (r.usage.input + r.usage.cacheWrite * 1.25 + r.usage.cacheRead * 0.1) / 1e6 * PRICE_IN + r.usage.output / 1e6 * PRICE_OUT;
    usd += cost;
    const split = r.bodySentences && r.text.body.includes("\n\n") ? r.text.body.split("\n\n")[0]!.split(/(?<=[.!?])\s+/).length : undefined;
    const saved: Saved = { date, ganji: input.today.ko, score: input.score10, band: input.band, source: r.source, attempts: r.attempts, patches: r.patches, issues: r.issues, usage: r.usage, cost, ...(r.metrics.fallback ? { fallback: r.metrics.fallback } : {}), text: r.text, bodySentences: r.bodySentences, ...(split ? { split } : {}), lastDraft: r.lastDraft, plan: r.plan, brief: JSON.parse(renderBrief(brief)), madeAt: new Date().toISOString() };
    writeFileSync(path.join(dir, `${date}.json`), JSON.stringify(saved, null, 1), "utf8");
  }
  // 나란히.md — 시안/ 폴더에 있는 날짜 전부로 다시 만든다 (한 날만 다시 써도 나머지가 지워지지 않게)
  const all = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Saved);
  const md: string[] = ["# 재설계 시안 — 운영 글(v4.21) · 앱 주인이 쓴 글 · 시안을 나란히", "", `마지막으로 쓴 날 ${new Date().toISOString().slice(0, 10)} · 날짜 ${all.map((s) => s.date).join(", ")} · 호출 상한 ${maxAttempts}`, "", "가운데가 앱 주인이 지적에 직접 쓴 글(본보기). 시안은 그 글을 본보기로 받아 새 입력으로 쓴 글이다. 점수·단계는 같다(판정 층은 안 건드렸다).", ""];
  const owner = (date: string) => { const e = EXEMPLARS.find((x) => x.date === date); return e ? { headline: e.출력.headline ?? "(제목 없음)", body: [...e.출력.first, ...e.출력.second].join(" "), do: e.출력.do ?? "(없음)", dont: e.출력.dont ?? "(없음)" } : null; };
  const cell = (s: string) => s.replace(/\|/g, "／").replace(/\n+/g, "<br><br>");
  for (const s of all) {
    const p = prod[s.date];
    md.push(`## ${s.date} · ${s.ganji}일 · ${s.score} ${s.band}`, "");
    const o = owner(s.date);
    md.push(`| 운영 v4.21 | 앱 주인이 쓴 글 | 시안 (${s.source === "llm" ? `모델, 호출 ${s.attempts}회` : `템플릿으로 떨어짐 — ${s.fallback ?? ""}`}) |`, "|---|---|---|");
    md.push(`| **${p ? cell(p.headline) : "-"}** | **${o ? cell(o.headline) : "(본보기 없음)"}** | **${cell(s.text.headline)}** |`);
    md.push(`| ${p ? cell(p.sentences.join(" ")) : "-"} | ${o ? cell(o.body) : "-"} | ${cell(s.text.body)} |`);
    md.push(`| 하면: ${p ? cell(p.doText) : "-"}<br>피해요: ${p ? cell(p.dontText) : "-"} | 하면: ${o ? cell(o.do) : "-"}<br>피해요: ${o ? cell(o.dont) : "-"} | 하면: ${cell(s.text.do)}<br>피해요: ${cell(s.text.dont)} |`, "");
    if (s.issues.some((xs) => xs.length)) md.push(`검사에 걸렸던 것: ${s.issues.map((xs, i) => `${i + 1}회차 ${xs.length ? xs.join(" / ") : "통과"}`).join(" → ")}`, "");
    if (s.source !== "llm" && s.lastDraft) md.push(`마지막 모델 초안(검사 미통과): ${s.lastDraft.headline} / ${s.lastDraft.body.join(" ")}`, "");
    md.push(`토큰 in ${s.usage.input} (cache w ${s.usage.cacheWrite} r ${s.usage.cacheRead}) out ${s.usage.output} · 추정 ${s.cost.toFixed(3)}달러`, "");
  }
  md.push(`---`, `이번 실행 추정 비용 ${usd.toFixed(3)}달러 · 전체 ${all.reduce((n, s) => n + s.cost, 0).toFixed(3)}달러 (단가 in ${PRICE_IN} / out ${PRICE_OUT} 달러/백만 토큰 가정)`);
  writeFileSync(path.join(out, "나란히.md"), md.join("\n"), "utf8");
  console.log(md.filter((l) => dates.some((d) => l.includes(d)) || l.startsWith("|") || l.startsWith("검사") || l.startsWith("토큰") || l.startsWith("이번")).join("\n"));
}, 600_000);

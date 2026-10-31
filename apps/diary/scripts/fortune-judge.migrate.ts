// 운세 A/B 평가 (v4.20, 2026-10-31). fortune-ab30.migrate.ts가 만든 A.json·B.json을 같은 (사람, 날짜)끼리 짝지어
// 평가 모델(Opus 5.5, 글쓴 모델과 다름)에게 순서를 섞어 함께 보여 준다(어느 쪽이 A인지 모른다). 기준은 두 판본이 같은 사주 계획(핵심·보조·맥락·영역).
// 글 간 반복(날짜 사이·같은 날 사람 사이)과 행동 갈래 쏠림(v4.21)은 코드가 잰다. 실행: npx vitest run --config vitest.scripts.config.ts scripts/fortune-judge.migrate.ts
// v4.21: JUDGE_OLD·JUDGE_NEW로 비교할 두 판본을 고른다(기본 A·B). 결과는 judge_{OLD}{NEW}.json (A·B는 예전대로 judge.json). 결과 칸 이름 A·B는 "옛·새"라는 뜻
import { test } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { tokenOverlap } from "@/lib/fortune/validate";

const DIR = "C:/Users/HongJunpyo/Desktop/사주 앱/사주 일기/피드백/v420측정";
const MODEL = "claude-opus-5-5";
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }; // Opus 5.5 $/1M (캐시 쓰기 1.25배)
const LIMIT = Number(process.env.JUDGE_LIMIT ?? 1e9);
const OLD = process.env.JUDGE_OLD ?? "A", NEW = process.env.JUDGE_NEW ?? "B";
const OUT = OLD === "A" && NEW === "B" ? "judge.json" : `judge_${OLD}${NEW}.json`;

type Row = { person: string; date: string; source: string; score: number; band: string; headline: string; bodySentences: string[] | null; body: string; do: string; dont: string; areas: { period: string; area: string; signal: string; line: string }[]; brief: string; attempts: number; cost: number; ms: number };

const SYSTEM = `당신은 일기 앱 "오늘의 운세" 글을 평가하는 편집자입니다. 같은 사람의 같은 날 운세 두 편(글1·글2)과, 그날 사주 계산이 정한 "기준 계획"을 받습니다. 두 글은 같은 계획에서 서로 다른 방식으로 쓰였습니다. 어느 쪽이 어떤 방식인지는 알려 주지 않습니다.

글마다 1~5점(5가 가장 좋음)으로 매깁니다.
- 의미충실: 계획의 핵심 뜻과 오늘 읽기(도움이 되는 쪽인지, 필요 이상으로 세지기 쉬운 쪽인지), 보조·맥락·영역 신호를 왜곡하지 않고 전하는가. 보조를 핵심의 원인이나 결과처럼 지어 이으면 낮게. 계획과 반대 방향이거나 계획에 없는 주제가 중심이면 낮게.
- 문맥: 앞 문장에서 뒤 문장으로 가는 까닭이 보이는가. 비약, 갑작스러운 결론, 끊김이 있으면 낮게.
- 명확: "그것·그럴 땐" 같은 지시어와 행동의 대상이 분명한가. 무엇을 하라는지 한 번 읽어 알 수 있는가.
- 실용: 하면 좋아요·피해요가 오늘 실제로 할 수 있는 구체 행동이고, 계획의 뜻에서 나왔는가. 아무 날에나 맞는 말이면 낮게.
그리고 센다.
- 지어냄: 계획에 없는 시간대·요일·장소·사건·사람을 새로 만든 곳의 수 (일반적인 생활 행동 수준의 예는 지어냄이 아님).
- 결과약속: 행동의 결과를 예언하거나 보장한 문장의 수 ("그러면 결과가 빨리 나와요", "반응이 좋아요" 등. "해 볼 만해요", "마음이 편해요"는 아님).
- 칸반복: 본문·하면 좋아요·피해요가 사실상 같은 조언을 되풀이하면 true.
마지막으로 어느 글이 사용자에게 더 나은지 고른다(1, 2, 같음)와 그 까닭 한 줄.
평가는 한국어로, 짧게.`;

const ITEM = { type: "object", additionalProperties: false, required: ["의미충실", "문맥", "명확", "실용", "지어냄", "결과약속", "칸반복", "문제"], properties: { 의미충실: { type: "integer" }, 문맥: { type: "integer" }, 명확: { type: "integer" }, 실용: { type: "integer" }, 지어냄: { type: "integer" }, 결과약속: { type: "integer" }, 칸반복: { type: "boolean" }, 문제: { type: "string" } } };
const SCHEMA = { type: "object", additionalProperties: false, required: ["글1", "글2", "더나은", "까닭"], properties: { 글1: ITEM, 글2: ITEM, 더나은: { type: "string", enum: ["1", "2", "같음"] }, 까닭: { type: "string" } } };

/** 두 판본에 공통인 사주 계획만 (방향·말투·피할것·날짜는 판본마다 달라 뺀다) */
function basePlan(brief: string): string {
  const j = JSON.parse(brief) as Record<string, unknown>;
  const keep = ["단계", "핵심", "보조", "맥락", "영역", "참고"];
  return JSON.stringify(Object.fromEntries(Object.entries(j).filter(([k]) => keep.includes(k))));
}
const show = (r: Row) => [`제목: ${r.headline}`, `본문: ${(r.bodySentences ?? [r.body]).join(" ")}`, `하면 좋아요: ${r.do}`, `피해요: ${r.dont}`, ...(r.areas.length ? [`영역: ${r.areas.map((a) => `${a.period} ${a.area}${a.signal}${a.line ? ` ${a.line}` : ""}`).join(" / ")}`] : [])].join("\n");
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

test("judge", async () => {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 4 });
  const A = (JSON.parse(readFileSync(`${DIR}/${OLD}.json`, "utf8")) as { rows: Row[] }).rows;
  const B = (JSON.parse(readFileSync(`${DIR}/${NEW}.json`, "utf8")) as { rows: Row[] }).rows;
  const pairs = A.map((a) => ({ a, b: B.find((b) => b.person === a.person && b.date === a.date)! })).filter((p) => p.b).slice(0, LIMIT);

  let cost = 0;
  const results: Record<string, unknown>[] = [];
  const queue = [...pairs];
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const swap = hash(p.a.person + p.a.date) % 2 === 1;   // 글1이 B인 짝
      const [one, two] = swap ? [p.b, p.a] : [p.a, p.b];
      const user = `기준 계획: ${basePlan(p.b.brief)}\n\n[글1]\n${show(one)}\n\n[글2]\n${show(two)}`;
      try {
        const res = await client.messages.create({
          model: MODEL, max_tokens: 4000,
          output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA as Record<string, unknown> } },
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
        });
        const u = res.usage;
        cost += (u.input_tokens * PRICE.input + u.output_tokens * PRICE.output + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) / 1e6;
        if (res.stop_reason === "refusal") { results.push({ person: p.a.person, date: p.a.date, error: "refusal" }); continue; }
        const text = res.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
        const j = JSON.parse(text) as { 글1: Record<string, unknown>; 글2: Record<string, unknown>; 더나은: string; 까닭: string };
        const better = j.더나은 === "같음" ? "같음" : (j.더나은 === "1") !== swap ? "A" : "B";
        results.push({ person: p.a.person, date: p.a.date, A: swap ? j.글2 : j.글1, B: swap ? j.글1 : j.글2, 더나은: better, 까닭: j.까닭 });
        console.log(p.a.person, p.a.date, "→", better, `$${cost.toFixed(3)}`);
      } catch (e) {
        results.push({ person: p.a.person, date: p.a.date, error: e instanceof Error ? e.message : String(e) });
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  // ---- 코드가 재는 반복 ----
  const rep = (rows: Row[]) => {
    const people = [...new Set(rows.map((r) => r.person))];
    let doRep = 0, headRep = 0, n = 0;
    for (const who of people) {
      const mine = rows.filter((r) => r.person === who).sort((x, y) => (x.date < y.date ? -1 : 1));
      mine.forEach((r, i) => {
        const prev7 = mine.slice(Math.max(0, i - 7), i);
        n++;
        if (prev7.some((q) => tokenOverlap(r.do, q.do) >= 0.5 || tokenOverlap(r.dont, q.dont) >= 0.5)) doRep++;
        if (prev7.some((q) => tokenOverlap(r.headline, q.headline) >= 0.5)) headRep++;
      });
    }
    const dates = [...new Set(rows.map((r) => r.date))];
    let cross = 0, pairsN = 0;
    for (const d of dates) {
      const same = rows.filter((r) => r.date === d);
      for (let i = 0; i < same.length; i++) for (let k = i + 1; k < same.length; k++) { cross += tokenOverlap((same[i]!.bodySentences ?? [same[i]!.body]).join(" "), (same[k]!.bodySentences ?? [same[k]!.body]).join(" ")); pairsN++; }
    }
    const sentences = rows.map((r) => (r.bodySentences ?? []).length);
    // v4.21 (ChatGPT 3차 18항): 행동 갈래 쏠림 — 단계마다 그 갈래가 글(본문·하면·피해요)에 나온 비율. 한 갈래가 주의의 대부분이면 새 병목
    const FAMILY: Record<string, RegExp> = { 범위줄이기: /범위|줄여|줄이/, 새로벌이지않기: /벌이/, 하나만고르기: /하나만|하나부터|하나를 골|한 가지만/, 미루기: /미뤄|미루|묵혀|뒤로/, 확인하기: /확인|살펴|따져/, 마무리하기: /마무리|매듭|끝내/ };
    const family = Object.fromEntries(["주의", "무난", "좋음"].map((band) => {
      const xs = rows.filter((r) => r.band === band);
      return [band, { n: xs.length, ...Object.fromEntries(Object.entries(FAMILY).map(([k, re]) => [k, +(xs.filter((r) => re.test([...(r.bodySentences ?? [r.body]), r.do, r.dont].join(" "))).length / Math.max(1, xs.length)).toFixed(2)])) }];
    }));
    return {
      갈래: family, "하면·피해요가 최근 7일과 겹친 비율": +(doRep / n).toFixed(3), "제목이 최근 7일과 겹친 비율": +(headRep / n).toFixed(3), "같은 날 사람끼리 본문 겹침 평균": +(cross / pairsN).toFixed(3), "본문 문장 수 평균": +(sentences.reduce((a, b) => a + b, 0) / rows.length).toFixed(2) };
  };

  const ok = results.filter((r) => !r.error) as { A: Record<string, number | boolean>; B: Record<string, number | boolean>; 더나은: string }[];
  const avg = (v: "A" | "B", k: string) => +(ok.reduce((s, r) => s + Number(r[v][k]), 0) / ok.length).toFixed(2);
  const keys = ["의미충실", "문맥", "명확", "실용", "지어냄", "결과약속", "칸반복"];
  const sum = {
    비교: `${OLD}(A칸) vs ${NEW}(B칸)`, 평가: ok.length, 실패: results.length - ok.length, 평가비용: +cost.toFixed(3),
    A: Object.fromEntries(keys.map((k) => [k, avg("A", k)])), B: Object.fromEntries(keys.map((k) => [k, avg("B", k)])),
    더나은: { A: ok.filter((r) => r.더나은 === "A").length, B: ok.filter((r) => r.더나은 === "B").length, 같음: ok.filter((r) => r.더나은 === "같음").length },
    반복: { A: rep(A), B: rep(B) },
  };
  writeFileSync(`${DIR}/${OUT}`, JSON.stringify({ 요약: sum, results }, null, 2));
  console.log("요약", JSON.stringify(sum));
}, 3_600_000);

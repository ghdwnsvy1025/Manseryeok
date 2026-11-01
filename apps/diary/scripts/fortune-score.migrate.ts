// 운세 한 편씩 채점 (2026-11-01). fortune-ab30.migrate.ts가 만든 {SCORE_LABEL}.json의 글을 한 편씩 그날 계획과 대조해
// 평가 모델(Opus 5.5, 글쓴 모델과 다름)이 절대 점수를 매긴다. 쌍 비교(fortune-judge)와 달리 판본 하나의 기준선이 된다.
// 실행: SCORE_LABEL=D12 npx vitest run --config vitest.scripts.config.ts scripts/fortune-score.migrate.ts → score_{LABEL}.json
import { test } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const DIR = "C:/Users/HongJunpyo/Desktop/사주 앱/사주 일기/피드백/v420측정";
const MODEL = "claude-opus-5-5";
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }; // Opus 5.5 $/1M (캐시 쓰기 1.25배)
const LABEL = process.env.SCORE_LABEL ?? "D12";
const LIMIT = Number(process.env.SCORE_LIMIT ?? 1e9);

type Row = { person: string; date: string; source: string; band: string; headline: string; bodySentences: string[] | null; body: string; do: string; dont: string; brief: string };

const SYSTEM = `당신은 일기 앱 "오늘의 운세" 글을 평가하는 편집자입니다. 운세 한 편과, 그날 사주 계산이 정한 "기준 계획"을 받습니다.
계획의 칸: 단계(좋음·무난·주의), 핵심(뜻·오늘 읽기·생활 표현 후보), 보조(함께 나타날 수 있는 두 번째 신호 — 핵심과의 관계는 정해져 있지 않다), 맥락(이달·올해 운, 있을 때만), 영역(생활 영역과 화살표, 뜻은 화면에 따로 보인다) 또는 행동대상(v4.22: 하면·피해요가 향할 생활 영역 — 본문에 없어도 된다).

1~5점(5가 가장 좋음):
- 의미충실: 핵심의 뜻과 오늘 읽기의 방향, 보조·맥락·영역을 왜곡하지 않고 전하는가. 반대 방향이거나 계획에 없는 주제가 중심이면 낮게.
- 문맥: 앞 문장에서 뒤 문장으로 가는 까닭이 보이는가. 표현을 나열만 하거나, 갑자기 다른 신호로 넘어가거나, 비약이 있으면 낮게.
- 명확: 지시어와 행동의 대상이 분명하고 한 번 읽어 이해되는가.
- 실용: 하면 좋아요·피해요가 오늘 할 수 있는 구체 행동이고 핵심(또는 보조·영역)의 뜻에서 나왔는가. 아무 날에나 맞는 말이면 낮게.
세는 것:
- 지어냄: 계획에 없는 시간대·요일·장소·사건·사람을 새로 만든 곳의 수(일반적인 생활 행동 수준의 예는 아님).
- 결과약속: 행동의 결과를 예언·보장한 문장 수("해 볼 만해요", "마음이 편해요"는 아님).
예/아니오:
- 칸반복: 본문·하면 좋아요·피해요 가운데 둘 이상이 사실상 같은 조언·같은 말.
- 보조인과: 보조(또는 영역)를 핵심의 원인이나 결과처럼 지어 이었다("그러다 보면", "그 마음이 세지는 만큼 말이 엇갈려요").
- 영역되풀이: 본문 문장이 영역(또는 행동대상)의 뜻을 거의 그대로 옮겼다(화면에 같은 말이 따로 보인다).
- 행동누락: 하면·피해요가 핵심의 뜻과 무관하고 보조·영역만 다룬다.
마지막으로 가장 고치고 싶은 문장 하나(없으면 빈 문자열)와 문제 한 줄. 한국어로 짧게.`;

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["의미충실", "문맥", "명확", "실용", "지어냄", "결과약속", "칸반복", "보조인과", "영역되풀이", "행동누락", "고칠문장", "문제"],
  properties: {
    의미충실: { type: "integer" }, 문맥: { type: "integer" }, 명확: { type: "integer" }, 실용: { type: "integer" },
    지어냄: { type: "integer" }, 결과약속: { type: "integer" },
    칸반복: { type: "boolean" }, 보조인과: { type: "boolean" }, 영역되풀이: { type: "boolean" }, 행동누락: { type: "boolean" },
    고칠문장: { type: "string" }, 문제: { type: "string" },
  },
};

/** 작가가 받은 계획 가운데 사주 계획만 (피할것·숫자는 뺀다) */
function basePlan(brief: string): string {
  const j = JSON.parse(brief) as Record<string, unknown>;
  const keep = ["단계", "핵심", "보조", "맥락", "영역", "행동대상", "참고"];
  return JSON.stringify(Object.fromEntries(Object.entries(j).filter(([k]) => keep.includes(k))));
}
const show = (r: Row) => [`제목: ${r.headline}`, `본문: ${(r.bodySentences ?? [r.body]).join(" ")}`, `하면 좋아요: ${r.do}`, `피해요: ${r.dont}`].join("\n");

test("score", async () => {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 4 });
  const rows = (JSON.parse(readFileSync(`${DIR}/${LABEL}.json`, "utf8")) as { rows: Row[] }).rows.slice(0, LIMIT);

  let cost = 0;
  const results: Record<string, unknown>[] = [];
  const queue = [...rows];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      try {
        const res = await client.messages.create({
          model: MODEL, max_tokens: 3000,
          output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA as Record<string, unknown> } },
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: `기준 계획: ${basePlan(r.brief)}\n\n[운세]\n${show(r)}` }],
        });
        const u = res.usage;
        cost += (u.input_tokens * PRICE.input + u.output_tokens * PRICE.output + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) / 1e6;
        if (res.stop_reason === "refusal") { results.push({ person: r.person, date: r.date, error: "refusal" }); continue; }
        const text = res.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
        results.push({ person: r.person, date: r.date, band: r.band, source: r.source, ...(JSON.parse(text) as Record<string, unknown>) });
        console.log(r.person, r.date, `$${cost.toFixed(3)}`);
      } catch (e) {
        results.push({ person: r.person, date: r.date, error: e instanceof Error ? e.message : String(e) });
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  const ok = results.filter((r) => !r.error) as Record<string, number | boolean | string>[];
  const avg = (k: string, xs = ok) => +(xs.reduce((s, r) => s + Number(r[k]), 0) / Math.max(1, xs.length)).toFixed(2);
  const rate = (k: string, xs = ok) => +(xs.filter((r) => r[k] === true).length / Math.max(1, xs.length)).toFixed(2);
  const part = (xs: typeof ok) => ({ n: xs.length, 의미충실: avg("의미충실", xs), 문맥: avg("문맥", xs), 명확: avg("명확", xs), 실용: avg("실용", xs), 지어냄: avg("지어냄", xs), 결과약속: avg("결과약속", xs), 칸반복: rate("칸반복", xs), 보조인과: rate("보조인과", xs), 영역되풀이: rate("영역되풀이", xs), 행동누락: rate("행동누락", xs) });
  const sum = {
    판본: LABEL, 평가: ok.length, 실패: results.length - ok.length, 평가비용: +cost.toFixed(3),
    전체: part(ok),
    단계별: Object.fromEntries(["좋음", "무난", "주의"].map((b) => [b, part(ok.filter((r) => r.band === b))])),
    사람별: Object.fromEntries([...new Set(ok.map((r) => String(r.person)))].map((p) => [p, part(ok.filter((r) => r.person === p))])),
  };
  writeFileSync(`${DIR}/score_${LABEL}.json`, JSON.stringify({ 요약: sum, results }, null, 2));
  console.log("요약", JSON.stringify(sum.전체));
}, 3_600_000);

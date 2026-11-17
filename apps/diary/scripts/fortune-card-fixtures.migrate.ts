// 2026-11-14 운세 카드 시험(명세 38) — 스크린샷용 카드 재료. 모델 호출 없음.
//   앱 주인 프로필 × v5 시안(피드백/11.14_v5_시안/시안/<날짜>.json)으로 FortuneCard에 그대로 넣을 FortuneContent를 만든다.
//   제목·본문·하면·피해요는 v5 시안 글, 점수·단계는 시안에 적힌 값(운영 기록), 인장은 seals.ts가 그날 글감에서 고른 것.
// 실행 (apps/diary): npx vitest run --config vitest.scripts.config.ts scripts/fortune-card-fixtures.migrate.ts
//   결과: 피드백/11.14_v5_시안/카드재료.json (배열, 날짜순)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { composeV5, type V5Material } from "@/lib/fortune/compose";
import { sealsOf } from "@/lib/fortune/seals";
import type { FortuneContent } from "@/lib/fortune/types";
import type { BirthProfile, PillarsSnapshot } from "@/lib/profile";

const DIARY = path.resolve(__dirname, "../../../..");

test("운세 카드 시험 재료", async () => {
  const { computeFortune } = await import("@/lib/fortune");
  const dir = process.env.V5_OUT ?? path.join(DIARY, "피드백/11.14_v5_시안");
  const prof = JSON.parse(readFileSync(process.env.BASIS_PROFILE ?? path.join(DIARY, "피드백/사주바탕/프로필_주인.json"), "utf8")) as { pillars: PillarsSnapshot; profile: BirthProfile | null };
  type Saved = { date: string; score: number; band: FortuneContent["band"]; text: { headline: string; body: string; do: string; dont: string }; bodySentences?: string[]; material: V5Material };
  const out: FortuneContent[] = [];
  const used: string[][] = [];   // 앞 날들의 인장 (최근 7일을 피한다)
  for (const f of readdirSync(path.join(dir, "시안")).filter((x) => x.endsWith(".json")).sort()) {
    const s = JSON.parse(readFileSync(path.join(dir, "시안", f), "utf8")) as Saved;
    const base = await computeFortune({ date: s.date, pillars: prof.pillars, profile: prof.profile, entries: [], recent: [] }, { useModel: false });
    // 글감은 지금 코드로 다시 고른다(저장된 material에는 새 칸이 없을 수 있다)
    out.push({ ...base, score: s.score, band: s.band, headline: s.text.headline, body: s.text.body, ...(s.bodySentences ? { bodySentences: s.bodySentences } : {}), do: s.text.do, dont: s.text.dont, source: "llm", seals: sealsOf(composeV5({ core: base.core!, band: s.band, date: s.date }), s.text.headline, used.slice(-7).flat()), generatedAt: "2026-11-14T00:00:00.000Z" });
    used.push((out.at(-1)!.seals ?? []).map((x) => x.word));
  }
  writeFileSync(path.join(dir, "카드재료.json"), JSON.stringify(out, null, 1), "utf8");
  console.log(out.map((c) => `${c.date} ${c.band} ${c.score} | ${c.headline} | 인장: ${(c.seals ?? []).map((x) => `${x.word}(${x.tone === "good" ? "좋" : "조"})`).join(" · ")}`).join("\n"));
}, 120_000);

// v4.27 (2026-11-10) 작가 입력 재설계 확인 — 모델 호출 없음.
//   (1) 앱 주인 프로필로 12-01~07(또는 BASIS_DATES) 하루마다 작가에게 가는 JSON(renderBrief)을 그대로 남긴다.
//   (2) 앱 주인이 지적 원장에 고쳐 쓴 12-01·12-02 글을 새 검사기에 넣어 무엇이 걸리는지 본다 — 옛 검사기는 이 글을 통과시키지 못했다("기운…들어오", "재물 기운").
// 실행 (apps/diary):
//   BASIS_PROFILE=<프로필 json> BASIS_PLANS=<D12 계획 json> npx vitest run --config vitest.scripts.config.ts scripts/fortune-ledger-check.migrate.ts
//   기본값: 프로필 = 피드백/사주바탕/프로필_주인.json, 결과 = 피드백/11.10_재설계_시안/
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { angleInputFor } from "@/lib/fortune/angle";
import { buildBrief, renderBrief, type BriefInput } from "@/lib/fortune/brief";
import { computeCoreFortune } from "@/lib/fortune/core";
import { bandOf, toTenPoint } from "@/lib/fortune/personal";
import { checkDraft, normalizeDraft } from "@/lib/fortune/validate";
import { dayGanji } from "@/lib/ganji";
import type { BirthProfile, PillarsSnapshot } from "@/lib/profile";

const ROOT = path.resolve(__dirname, "..");
const DIARY = path.resolve(ROOT, "../../..");
const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

/** 앱 주인이 원장에 고쳐 쓴 글 (notes 원문 그대로, 문장만 나눔). 검사기가 이 글을 어떻게 보는지 본다 */
export const OWNER_DRAFTS: Record<string, { headline: string; first: string[]; second: string[]; do: string; dont: string }> = {
  "2026-12-01": {
    headline: "고집이 강해지는 날",
    first: [
      "오늘은 어떤 일이든 주체적으로 내가 선택하려는 성질이 강해져요.",
      "그래서 다른 사람들과 합의하기보다 내 생각을 강하게 주장하게되고, 그렇게 행동을 해도 상관없다고 생각이 들어요.",
      "누군가 나의 생각에 합리적으로 반박해도 그냥 내 의견에 토를 달지 않았으면 좋겠어.. 라고 생각이 들 수 있어요.",
      "한편, 고집이 강해지는 기운도 들어오지만 여유로운 마음으로 조급해지지 않고 차분하게 생활을 할 수 있는 기운도 같이 들어오기 때문에, 나의 독단적인 생각들을 주변사람들에게 유연하고 합리적으로 설명할 수 있을 수 있어서 좋은 점도 있어요.",
    ],
    second: [
      "그래도 여기서 주의해야할 부분은 분명 엇갈리는 지점이 있을 꺼에요.",
      "그 부분만 능청스럽게 넘기면 오히려 사람들에게 유능하다고 들을 수 있는 날이에요.",
      "그리고 재물의 기운이 약하기 때문에 갑자기 돈이 나갈 일이 생긴다거나, 나에게, 다른 사람들에게 밥이나 무언가를 사고 싶다는 생각이 들 수 있어요.",
      "즉, 돈이 새어나갈 수 있는 날이기 때문에 쓸 데에는 쓰되, 지나친 사용은 자제하면 괜찮습니다.",
    ],
    do: "말 하기 전에 꼭 생각을 정리해서 말해보세요.",
    dont: "다른 사람의 생각을 무조건 이해하라는 건 아니고, 일리가 있다고 생각해주세요.",
  },
  "2026-12-02": {
    headline: "경쟁심이 올라오는 오늘, 그 강한 에너지를 생산적인 활동에 쏟으세요",
    first: [
      "주변 사람들이 성취해내는 것을 보면, 나도 당장 뭔가 해내야할 것 같은 조바심이 들 수 있는 하루에요.",
      "그러다 보니 다른 일을 차치해두고 하나의 목표를 향해 모든 시간과 돈을 쏟아부으려는 심리가 강해져요.",
      "당연히 이런 에너지가 긍정적으로 풀리면 결과물을 빠르게 얻을 수 있을 수 있지만, 스포츠카처럼 달리다보면 사고가 날 수도 있어요.",
      "예를 들어 사람들과의 소통에서 급발진을 하게되어서 사이가 틀어질 수 있게되는 것이죠.",
    ],
    second: [
      "또한 반대로 내가 만든 결과를 누가 가로채거나 내 결과보다 더 좋은 결과를 낸 사람이 있어 내 생각에 비해 작은 칭찬만 돌아올 수도 있죠.",
      "하지만, 뭐든간에 나의 능력을 발휘하기 아주 좋은 날이기 때문에 사람들과 트러블 일어나는 지점만 능구렁이처럼 빠져나가며 일에 몰두한다면 분명 빛을 발할 수 있는 날이에요.",
      "오늘 하루 응원하겠습니다.",
    ],
    do: "지르고 싶은 마음이 들면 그 힘을 일에 쏟아 보세요.",
    dont: "말이 거칠게 나가려 할 때 그대로 뱉지 않아요.",
  },
};

type Plans = Record<string, { date: string; score: number; band: "좋음" | "무난" | "주의" }>;

export function ownerInputs(opts: { profilePath: string; plansPath?: string; dates: string[] }): { date: string; input: BriefInput }[] {
  const prof = JSON.parse(readFileSync(opts.profilePath, "utf8")) as { pillars: PillarsSnapshot; profile: BirthProfile | null };
  const plans: Plans = opts.plansPath && existsSync(opts.plansPath) ? Object.fromEntries(Object.values(JSON.parse(readFileSync(opts.plansPath, "utf8")) as Plans[string][]).map((p) => [p.date, p])) : {};
  return opts.dates.map((date) => {
    const g = dayGanji(date);
    const core = computeCoreFortune({ pillars: prof.pillars, profile: prof.profile, date, todayHanja: g.hanja });
    const [y, m, d] = date.split("-").map(Number) as [number, number, number];
    const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
    // 점수·단계는 운영 기록(D12)을 그대로 쓴다 — 기록 보정(±0.8)이 든 값. 없으면 기록 없음으로 계산
    const plan = plans[date];
    const score10 = plan?.score ?? toTenPoint(core.parts.score01);
    const band = plan?.band ?? bandOf(score10);
    const personal = { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: core.parts.score01, shift: 0 };
    const { angle, quietNotes } = angleInputFor({ date, pillars: prof.pillars, profile: prof.profile, entries: [] }, core, band);
    const input: BriefInput = { core, personal, today: { ko: g.ko, hanja: g.hanja, stemKo: g.stemKo, branchKo: g.branchKo }, date, weekday, score10, band, recent: [], angle, quietNotes, dayMaster: prof.pillars.day.stem };
    return { date, input };
  });
}

test("v4.27 작가 입력 미리보기 + 앱 주인 글 검사", () => {
  const profilePath = process.env.BASIS_PROFILE ?? path.join(DIARY, "피드백/사주바탕/프로필_주인.json");
  const plansPath = process.env.BASIS_PLANS;
  const out = process.env.BASIS_CHECK_OUT ?? path.join(DIARY, "피드백/11.10_재설계_시안");
  const dates = (process.env.BASIS_DATES ?? "2026-12-01,2026-12-02,2026-12-03,2026-12-04,2026-12-05,2026-12-06,2026-12-07").split(",");
  mkdirSync(out, { recursive: true });

  const md: string[] = ["# v4.27 작가 입력 미리보기 (앱 주인 프로필, 모델 호출 없음)", "", `만든 날 ${new Date().toISOString().slice(0, 10)} · 프로필 ${path.basename(profilePath)} · 계획 ${plansPath ? path.basename(plansPath) : "(없음 — 기록 없음으로 계산)"}`, "", "작가(AI)에게 user 메시지로 가는 JSON 그대로다. 글에는 십신 이름 등 원어가 나오면 검사기가 막는다.", ""];
  const check: string[] = ["# 앱 주인이 고쳐 쓴 글을 새 검사기(v4.27)에 넣은 결과", "", "옛 검사기(v4.26)는 \"기운…들어오\"(판정 문장), \"재물 기운\"(비유), 문장 수 등으로 이 글을 막았다. 새 검사기가 아직 거는 것만 아래에 적는다.", ""];
  for (const { date, input } of ownerInputs({ profilePath, plansPath, dates })) {
    const brief = buildBrief(input);
    const json = renderBrief(brief);
    writeFileSync(path.join(out, `입력_${date}.json`), JSON.stringify(JSON.parse(json), null, 1), "utf8");
    md.push(`## ${date} · ${input.today.ko}일 · ${input.score10} ${input.band}`, "", "```json", JSON.stringify(JSON.parse(json), null, 1), "```", "");
    const od = OWNER_DRAFTS[date];
    if (od) {
      const draft = normalizeDraft(od)!;
      const issues = checkDraft(draft, brief).filter((i) => i.code !== "exemplar_copy");   // v4.28: 이 글이 곧 본보기라 베낌 검사는 뺀다
      check.push(`## ${date} — ${issues.length ? `${issues.length}건` : "통과"}`, "", `본문 ${draft.body.length}문장(둘째 문단 시작 ${draft.split ?? "-"})`, "");
      for (const i of issues) check.push(`- ${i.msg}`);
      check.push("");
    }
  }
  writeFileSync(path.join(out, "작가입력_미리보기.md"), md.join("\n"), "utf8");
  writeFileSync(path.join(out, "주인글_검사.md"), check.join("\n"), "utf8");
  console.log(check.join("\n"));
  console.log(`\n→ ${out}`);
});

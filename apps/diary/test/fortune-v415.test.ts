// v4.15 (2026-10-23): 사주 코어의 블록 방식 — 본문 네 블록(근거·원리/성향·사례·처방), 사실표(sheet), 사례 무대(stage, 최근 7일 회피), 코어 말투 규칙 검사.
import { describe, expect, it } from "vitest";
import { buildBrief, recentFromRows, renderBrief, stageOf, STAGES, daySeed } from "@/lib/fortune/brief";
import { computeCoreFortune } from "@/lib/fortune/core";
import { FORTUNE_EXAMPLES, joinBlocks, type FortuneBlock } from "@/lib/fortune/examples";
import { OUTPUT_SCHEMA, SYSTEM, trimTail } from "@/lib/fortune/llm";
import { adjustWithEntries, bandOf, toTenPoint } from "@/lib/fortune/personal";
import { templateInputFromCore, templateText } from "@/lib/fortune/text";
import { LIMITS, mandatedStems, overusedWords, validateBlocks, validateFortuneText, type ModelText } from "@/lib/fortune/validate";
import { visibleAreas } from "@/lib/fortune/visible";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const P: BirthProfile = { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1994, birthMonth: 1, birthDay: 28, birthHour: 12, birthMinute: 0, city: "seoul" };
function inputFor(date: string, recent: ReturnType<typeof recentFromRows> = []) {
  const prof = computeProfile({ ...P, name: "t" });
  if (!prof.ok) throw new Error(prof.error);
  const g = dayGanji(date);
  const core = computeCoreFortune({ pillars: prof.value.pillars, profile: P, date, todayHanja: g.hanja });
  const personal = adjustWithEntries(core.parts.score01, [], { index: g.index, stemKo: g.stemKo, branchKo: g.branchKo });
  const score10 = toTenPoint(personal.score);
  return { core, personal, today: { ko: g.ko, hanja: g.hanja, stemKo: g.stemKo, branchKo: g.branchKo }, date, weekday: "금요일", score10, band: bandOf(score10), recent };
}
const briefFor = (date: string, recent?: ReturnType<typeof recentFromRows>) => buildBrief(inputFor(date, recent));

/** 예시 1편(좋음·돈 무대)을 그 무대·기운 이름의 brief로 검사하는 기준 글 */
const EX = FORTUNE_EXAMPLES[0]!;
function okText(): ModelText & { blocks: FortuneBlock[] } {
  return { headline: "오늘만의 새 제목", blocks: EX.text.blocks.map((b) => ({ ...b })), body: EX.text.body, areas: [], do: "장바구니를 비우기 전에 한 번 더 들여다봐요.", dont: "큰돈 드는 결제는 내일로 미뤄요." };
}
function briefLike(): ReturnType<typeof buildBrief> {
  const b = briefFor("2026-10-24");
  return { ...b, areas: [], today: { ...b.today, tenGods: EX.tenGods }, sheet: { ...b.sheet, today: "편관 = 압박과 책임, 식신 = 표현과 여유" }, stage: STAGES.find((s) => s.name === EX.stage)!, recent: [] };
}

describe("v4.15 브리프 — 사실표와 무대", () => {
  it("sheet(내게 필요한 기운·오늘 뜻·맞는지)와 stage(이름·what·hints)가 들어간다", () => {
    const b = briefFor("2026-10-24");
    expect(b.sheet.me).toMatch(/^내게 필요한 기운은 .+\(.+\)이에요\.$|^태어난 시간을 몰라/);
    expect(b.sheet.today).toMatch(/[가-힣]{2} = .+/);
    expect(b.sheet.fit).toMatch(/맞는 편|보통|안 맞는 편|판단 보류/);
    expect(STAGES.map((s) => s.name)).toContain(b.stage.name);
    expect(b.stage.hints.length).toBeGreaterThan(3);
    expect(b.rules.body).toContain(`무대 "${b.stage.name}"`);
    expect(b.rules.body).toContain("이달은 본문에 쓰지 않기");
    expect(b.rules.context).toContain("areas의 이달 줄에서만");
  });

  it("무대는 날짜로 돌고, 최근 7일 무대는 피하며, 여덟 날이면 전부 다르다", () => {
    const seed = daySeed("2026-10-24");
    expect(stageOf(seed, []).name).toBe(STAGES[seed % STAGES.length]!.name);
    const avoid = STAGES.slice(0, 7).map((s) => s.name);
    expect(stageOf(seed, avoid).name).toBe(STAGES[7]!.name);
    // 실제 흐름: 날마다 앞 날의 무대를 recent에 넣으면 8일 동안 겹치지 않는다
    const used: string[] = [];
    let rows: { fortune_date: string; content: { headline: string; body: string; stage: string } }[] = [];
    for (let k = 0; k < 8; k++) {
      const date = `2026-11-${String(k + 1).padStart(2, "0")}`;
      const b = briefFor(date, recentFromRows(rows.slice(-7)));
      used.push(b.stage.name);
      rows.push({ fortune_date: date, content: { headline: `h${k}`, body: "x. y.", stage: b.stage.name } });
    }
    expect(new Set(used).size).toBe(8);
    // 겹침 검사·프롬프트용 recent는 3일만, 무대 회피는 7일
    const b = briefFor("2026-11-09", recentFromRows(rows.slice(-7)));
    expect(b.recent).toHaveLength(3);
    expect(b.avoidStages).toHaveLength(7);
    expect(b.avoidStages).not.toContain(b.stage.name);
  });

  it("recentFromRows가 stage를 옮기고, 없는 옛 캐시는 그냥 없다", () => {
    const r = recentFromRows([
      { fortune_date: "2026-10-23", content: { headline: "h", body: "a. b.", stage: "돈" } },
      { fortune_date: "2026-10-22", content: { headline: "h2", body: "a. b." } },
    ]);
    expect(r[0]!.stage).toBe("돈");
    expect(r[1]!.stage).toBeUndefined();
  });
});

describe("v4.15 블록 — 스키마·합치기·예시", () => {
  it("OUTPUT_SCHEMA는 body 대신 blocks(kind·text)를 받고, joinBlocks는 앞 둘·뒤 둘을 두 문단으로", () => {
    expect(OUTPUT_SCHEMA.required).toContain("blocks");
    expect(OUTPUT_SCHEMA.required).not.toContain("body");
    const body = joinBlocks([{ kind: "근거", text: "하나." }, { kind: "성향", text: "둘." }, { kind: "사례", text: "셋." }, { kind: "처방", text: "넷." }]);
    expect(body).toBe("하나. 둘.\n\n셋. 넷.");
  });

  it("예시 세 편은 블록 4개(근거·원리/성향·사례·처방)이고 순서가 서로 다르며 본문에 이달이 없다", () => {
    const orders = FORTUNE_EXAMPLES.map((e) => e.text.blocks.map((b) => b.kind).join("→"));
    expect(new Set(orders).size).toBeGreaterThan(1);
    for (const e of FORTUNE_EXAMPLES) {
      expect(e.text.blocks).toHaveLength(4);
      expect(e.text.blocks[0]!.kind).not.toBe("처방");
      expect(e.text.body).not.toMatch(/이달/);
      expect(e.text.body).toBe(joinBlocks(e.text.blocks));
    }
    expect(SYSTEM).toContain("[블록 — 본문은 네 블록입니다");
    expect(SYSTEM).toContain("예를 들면");
    expect(SYSTEM).not.toContain("이달 기운 한 줄: brief.month.line");
  });
});

describe("v4.15 블록 검사 (validateBlocks)", () => {
  const brief = briefLike();
  const ok = okText();

  it("기준 글은 통과하고, 옛 꼴(blocks 없음)은 블록 검사를 건너뛴다", () => {
    expect(validateBlocks(ok.blocks, brief)).toEqual([]);
    expect(validateFortuneText(ok, brief).filter((i) => !i.startsWith("예시"))).toEqual([]);
    expect(validateBlocks(undefined, brief)).toEqual([]);
  });

  it("개수·종류·처방 자리", () => {
    expect(validateBlocks(ok.blocks.slice(0, 3), brief)[0]).toMatch(/blocks가 3개/);
    const twoCases = ok.blocks.map((b, i) => (i === 1 ? { kind: "사례" as const, text: "예를 들면 돈을 쓰는 일이 두 번 나오는 문장이에요." } : b));
    expect(validateBlocks(twoCases, brief).some((i) => i.includes("블록 종류가"))).toBe(true);
    const first = [ok.blocks[3]!, ok.blocks[0]!, ok.blocks[1]!, ok.blocks[2]!];
    expect(validateBlocks(first, brief)).toContain("처방이 첫 블록 (처방은 근거·원리·사례 뒤에)");
  });

  it("사례: '예를 들면'으로 시작하고 무대 낱말이 있어야 하며 넘겨짚지 않는다", () => {
    const noStart = ok.blocks.map((b) => (b.kind === "사례" ? { ...b, text: "미뤄 둔 공과금을 내는 일이 평소보다 쉽게 손에 잡혀요." } : b));
    expect(validateBlocks(noStart, brief).some((i) => i.includes('"예를 들면"으로 시작하지 않음'))).toBe(true);
    const noStage = ok.blocks.map((b) => (b.kind === "사례" ? { ...b, text: "예를 들면 미뤄 둔 일 하나가 평소보다 쉽게 손에 잡히는 날이에요." } : b));
    expect(validateBlocks(noStage, brief).some((i) => i.includes('무대 "돈" 낱말이 없음'))).toBe(true);
    const presume = ok.blocks.map((b) => (b.kind === "사례" ? { ...b, text: "예를 들면 돈 정리를 미뤄 둔 적 있으시죠, 오늘은 그게 손에 잡혀요." } : b));
    expect(validateBlocks(presume, brief).some((i) => i.includes("넘겨짚는 말"))).toBe(true);
  });

  it("코어 말투: 결과 약속·되받기·정의문·비유·내부 말투·문장 길이·같은 낱말·이달", () => {
    const sub = (kind: FortuneBlock["kind"], text: string) => ok.blocks.map((b) => (b.kind === kind ? { ...b, text } : b));
    expect(validateBlocks(sub("처방", "그러면 저녁에 남은 돈이 얼마인지 바로 보이게 돼요."), brief).some((i) => i.includes("결과를 약속"))).toBe(true);
    expect(validateBlocks(sub("처방", "정리가 끝난 저녁에 남은 돈을 적어 두면 마음이 한결 편해져요."), brief).some((i) => i.includes("처방 뒤의 결과 약속"))).toBe(true);
    expect(validateBlocks(sub("성향", "앞에서 본 그 마음이 오늘은 하나씩 끝내고 싶은 쪽으로 움직여요."), brief).some((i) => i.includes("되받는 말"))).toBe(true);
    expect(validateBlocks(sub("성향", "압박과 책임을 합쳐 편관이라 해요, 그래서 오늘은 일을 끝내고 싶어져요."), brief).some((i) => i.includes("정의문"))).toBe(true);
    expect(validateBlocks(sub("성향", "볕이 드는 자리처럼 오늘은 하나씩 끝내고 싶은 마음이 앞서요."), brief).some((i) => i.includes("비유 낱말"))).toBe(true);
    expect(validateBlocks(sub("성향", "판정으로 나와요, 오늘은 하나씩 끝내고 싶은 마음이 앞서는 날이에요."), brief).some((i) => i.includes("속으로 쓰는 말"))).toBe(true);
    expect(validateBlocks(sub("성향", "짧아요."), brief).some((i) => i.includes(`${LIMITS.sentenceMin}자 이상`))).toBe(true);
    expect(validateBlocks(sub("성향", "오늘은 해야 할 일이 무겁게 느껴지기보다 하나씩 차근차근 끝내고 싶은 마음이 앞서는 날이라 손에 잡히는 것부터 하나씩 해 나가는 편이 훨씬 마음이 편해요."), brief).some((i) => i.includes(`${LIMITS.sentenceMax}자 안`))).toBe(true);
    expect(validateBlocks(sub("성향", "첫 문장이에요 길게요. 둘째 문장도 길게 써요 네. 셋째 문장은 하나 더 있어요 네."), brief).some((i) => i.includes("3문장"))).toBe(true);
    expect(validateBlocks(sub("성향", "마음이 마음을 마음에 마음으로 마음 때문에 흔들리는 날이에요."), brief).some((i) => i.includes("같은 낱말 되풀이"))).toBe(true);
    expect(validateBlocks(sub("성향", "이달 무술월은 수월한 편이라 오늘도 하나씩 끝내고 싶어져요."), brief)).toContain("본문에 이달 운 (이달은 areas의 이달 줄에서만)");
    expect(overusedWords("마음이 마음을 마음에 마음으로 쓰기", 3)).toEqual(["마음…×4"]);
    expect(overusedWords("오늘 오늘 오늘 오늘 오늘")).toEqual([]);   // 오늘은 세지 않는다
  });
});

describe("v4.15 이달 줄·템플릿", () => {
  it("visibleAreas: 이달 줄은 매일, 올해 줄은 그 운 문장이 있는 날만", () => {
    const areas = [{ period: "오늘" as const }, { period: "이달" as const }, { period: "올해" as const }];
    expect(visibleAreas(areas, []).map((a) => a.period)).toEqual(["오늘", "이달"]);
    expect(visibleAreas(areas, ["올해 운 丙午은 보통이에요."]).map((a) => a.period)).toEqual(["오늘", "이달", "올해"]);
  });
  it("템플릿 본문에도 이달 한 줄이 없다 (이름 문장·맞는지 문장은 그대로)", () => {
    const { core, personal, today } = inputFor("2026-10-24");
    const t = templateText(templateInputFromCore(core), personal, today);
    expect(t.body).not.toMatch(/이달/);
    expect(t.body).toMatch(/오늘은 .+이 (함께 오는|아주 센) 날이에요\./);
  });
});

describe("v4.15 2차 — 공식 문장 되풀이 막기 (1차 말뭉치 2026-10-23)", () => {
  it("recent는 날짜 내림차순으로 3일만, lines는 검사기용이라 모델에 보내는 JSON에는 없다", () => {
    const rows = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"].map((d) => ({ fortune_date: d, content: { headline: `h${d}`, body: "첫 문장이에요. 둘째 문장이에요.", stage: "집" } }));
    const b = briefFor("2026-11-06", recentFromRows(rows));   // 오름차순으로 넘겨도
    expect(b.recent.map((r) => r.date)).toEqual(["2026-11-05", "2026-11-04", "2026-11-03"]);
    expect(b.recent[0]!.lines).toEqual(["첫 문장이에요.", "둘째 문장이에요."]);
    expect(renderBrief(b)).not.toContain("lines");
    expect(renderBrief(b)).toContain("\"say\"");
  });

  it("sheet.say — 이름 꼴·맞는지 꼴이 날짜로 돈다", () => {
    const forms = new Set(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((d) => briefFor(d).sheet.say.name));
    expect(forms.size).toBeGreaterThan(1);
  });

  it("블록 문장이 최근 3일 본문 문장과 60% 이상 겹치면 탈락", () => {
    const brief = briefLike();
    const ok = okText();
    const ground = ok.blocks.find((b) => b.kind === "근거")!.text.split(/(?<=\.)\s+/)[1]!;   // "둘 다 내게 모자란 금, 그러니까 …"
    const withRecent = { ...brief, recent: [{ date: "2026-10-23", headline: "다른 제목", start: "x. y.", lines: ["아무 말이에요.", ground] }] };
    expect(validateBlocks(ok.blocks, withRecent).some((i) => i.includes("최근(2026-10-23) 문장과 겹침"))).toBe(true);
    expect(validateBlocks(ok.blocks, { ...brief, recent: [{ date: "2026-10-23", headline: "다른 제목", start: "x. y.", lines: ["전혀 다른 문장이 하나 있어요."] }] })).toEqual([]);
  });

  it("do·dont·영역 줄은 '~요'로 끝나야 한다 (꼬리 글자 'eta'·'」' 차단)", () => {
    const brief = briefLike();
    const ok = okText();
    expect(validateFortuneText({ ...ok, dont: "큰돈 드는 결제는 내일로 미뤄요.eta" }, brief).some((i) => i.startsWith('dont가 "~요"로 끝나지 않음'))).toBe(true);
    expect(validateFortuneText({ ...ok, do: "장바구니를 비우기 전에 한 번 더 들여다봐요.」" }, brief).some((i) => i.startsWith('do가 "~요"로 끝나지 않음'))).toBe(true);
  });
});

describe("v4.15 3차 — 2차 말뭉치에서 나온 것", () => {
  it("sheet.say.name은 오늘 이름으로 조립한 실제 구절이고 날마다 꼴이 다르다", () => {
    const b = briefFor("2026-11-01");
    const names = b.today.tenGods.split("·");
    for (const n of names) expect(b.sheet.say.name).toContain(n);
    expect(b.sheet.say.fit).not.toMatch(/넘치는 쪽|모자란 쪽/);   // 추상어 금칙에 걸리는 꼴을 주지 않는다
  });

  it("최근 겹침은 꼭 쓰는 말(이름·뜻·필요한 기운)을 빼고 잰다 — 같은 십신이 다시 온 날의 근거 문장은 통과", () => {
    const brief = briefLike();
    const ok = okText();
    const ground = ok.blocks.find((b) => b.kind === "근거")!.text.split(/(?<=\.)\s+/)[0]!;   // "오늘 임술일에는 압박과 책임을 뜻하는 편관과 …"
    const near = ground.replace("임술일", "임자일");
    const recent = [{ date: "2026-10-23", headline: "다른 제목", start: "x. y.", lines: [near] }];
    expect(validateBlocks(ok.blocks, { ...brief, recent })).toEqual([]);
    expect(trimTail("큰돈 드는 결제는 내일로 미뤄요.1")).toBe("큰돈 드는 결제는 내일로 미뤄요.");
    expect(trimTail("잡지 않아요.。")).toBe("잡지 않아요.");
    expect(trimTail("지 않아요.」」")).toBe("지 않아요.");
    expect(trimTail("새로 사지 않아요.placeholder")).toBe("새로 사지 않아요.");
    expect(trimTail("그대로 유지. 필드 아님).")).toBe("그대로 유지. 필드 아님).");
  });

  it("같은 낱말 세기에서 오늘 기운의 뜻(혼자 생각 → '생각')은 빼고 센다", () => {
    const b = briefFor("2026-11-04");
    const text = "생각이 생각을 생각에 생각으로 많아져요.";
    expect(overusedWords(text, 3, mandatedStems({ sheet: { ...b.sheet, today: "편인 = 혼자 생각" } }))).toEqual([]);
    expect(overusedWords(text, 3)).toEqual(["생각…×4"]);
  });
});

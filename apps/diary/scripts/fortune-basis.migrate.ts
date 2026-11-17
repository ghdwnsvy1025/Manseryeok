// 운세 지적 원장용 "사주 바탕" 뽑기 (2026-11-08). 앱 주인 명식과 날짜별 일진·십신·라벨·충합·영역을 쉬운 말로 적어 JSON으로 남긴다.
// 모델 호출 없음. 운영 DB 안 읽음(앱 주인 사주는 2026-10-23 채팅의 1995-10-25 양력 남 시간 모름 — fortune-corpus.ts E 프로필과 같다).
// 실행 (apps/diary): BASIS_START=2026-12-01 BASIS_DAYS=14 BASIS_OUT=<폴더> npx vitest run --config vitest.scripts.config.ts scripts/fortune-basis.migrate.ts
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { DEFAULT_POWER_METHOD, balance, luck, luckRelations, relations, toCorePillars } from "@saju/core-rules";
import { getTenGod, type StemHanja } from "@saju/engine";
import { computeCoreFortune, resolveYongsin } from "@/lib/fortune/core";
import { adjustWithEntries, bandOf, toTenPoint } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile, type PillarsSnapshot } from "@/lib/profile";

const OWNER: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1995, birthMonth: 10, birthDay: 25, birthHour: null, birthMinute: null, city: "seoul" };

const STEM_KO: Record<string, string> = { 甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무", 己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계" };
const STEM_EL: Record<string, string> = { 甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수" };
const STEM_YY: Record<string, string> = { 甲: "양", 乙: "음", 丙: "양", 丁: "음", 戊: "양", 己: "음", 庚: "양", 辛: "음", 壬: "양", 癸: "음" };
const BR_KO: Record<string, string> = { 子: "자", 丑: "축", 寅: "인", 卯: "묘", 辰: "진", 巳: "사", 午: "오", 未: "미", 申: "신", 酉: "유", 戌: "술", 亥: "해" };
const BR_EL: Record<string, string> = { 子: "수", 丑: "토", 寅: "목", 卯: "목", 辰: "토", 巳: "화", 午: "화", 未: "토", 申: "금", 酉: "금", 戌: "토", 亥: "수" };
const BR_ANIMAL: Record<string, string> = { 子: "쥐", 丑: "소", 寅: "호랑이", 卯: "토끼", 辰: "용", 巳: "뱀", 午: "말", 未: "양", 申: "원숭이", 酉: "닭", 戌: "개", 亥: "돼지" };
const EL_WORD: Record<string, string> = { 목: "나무", 화: "불", 토: "흙", 금: "쇠", 수: "물" };
/** 지지 정기(본기) 천간 — 지지의 십신은 이 글자로 센다 */
const MAIN_STEM: Record<string, string> = { 子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬" };

/** 십신 → 쉬운 말 (내 일간과의 관계 + 마음·행동) */
const TEN_GOD_PLAIN: Record<string, { 관계: string; 뜻: string }> = {
  비견: { 관계: "나와 같은 오행, 같은 음양", 뜻: "내 생각과 내 방식이 세진다. 고집, 독립심, 혼자 하려는 마음" },
  겁재: { 관계: "나와 같은 오행, 음양은 다름", 뜻: "경쟁심과 추진력. 남과 겨루거나 내 것을 뺏기는 느낌, 돈이 새기 쉬움" },
  식신: { 관계: "내가 낳는 오행, 같은 음양", 뜻: "표현하고 즐기는 힘. 말이 많아지고 여유가 생김, 먹고 만들고 베푸는 쪽" },
  상관: { 관계: "내가 낳는 오행, 음양은 다름", 뜻: "날카로운 말과 재치. 틀을 깨고 튀는 쪽, 윗사람과 부딪히기 쉬움" },
  편재: { 관계: "내가 다스리는 오행, 같은 음양", 뜻: "기회와 확장. 바깥 활동, 큰 돈이 오가고 씀씀이가 커짐" },
  정재: { 관계: "내가 다스리는 오행, 음양은 다름", 뜻: "차곡차곡 챙기는 힘. 실속, 안정된 수입, 꼼꼼함" },
  편관: { 관계: "나를 다스리는 오행, 같은 음양", 뜻: "압박과 책임. 긴장, 밀어붙이는 일, 몸이 힘들 수 있음" },
  정관: { 관계: "나를 다스리는 오행, 음양은 다름", 뜻: "약속과 역할. 규칙, 명예, 해야 할 일을 지키는 쪽" },
  편인: { 관계: "나를 낳는 오행, 같은 음양", 뜻: "혼자 생각. 직관, 외골수, 식신을 막아 입맛과 여유가 줄 수 있음" },
  정인: { 관계: "나를 낳는 오행, 음양은 다름", 뜻: "배움과 쉼. 보호받음, 공부, 느긋해짐" },
};
const GROUP_PLAIN: Record<string, string> = { 비겁: "비겁(나와 같은 기운: 비견·겁재)", 식상: "식상(내가 낳는 기운: 식신·상관)", 재성: "재성(내가 다스리는 기운: 편재·정재)", 관성: "관성(나를 다스리는 기운: 편관·정관)", 인성: "인성(나를 낳는 기운: 편인·정인)" };
const ROLE_PLAIN: Record<string, string> = {
  용: "용신 — 내게 가장 필요한 기운. 오면 반갑다",
  희: "희신 — 용신을 돕는 기운. 오면 좋다",
  한: "한신 — 좋고 나쁨이 뚜렷하지 않은 기운. 그 성격대로 드러난다",
  구: "구신 — 용신을 방해하는 기운. 무리하면 지친다",
  기: "기신 — 내게 이미 넘치는 기운. 더 오면 과해진다",
};
const POS_LIFE: Record<string, string> = { 연지: "오래된 인연·바깥", 월지: "집안·일터", 일지: "나와 가까운 사람·배우자", 시지: "앞으로의 계획·자녀" };
const AREA_WORD: Record<string, string> = { 대인: "사람", 재물: "돈", 직업: "일", 학업: "배움", 연애: "연애", 가족: "가족", 건강: "몸" };

const addDays = (d: string, n: number) => { const [y, m, dd] = d.split("-").map(Number) as [number, number, number]; return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10); };
const gjKo = (gj: string) => STEM_KO[gj[0]!]! + BR_KO[gj[1]!]!;
const stemWord = (ch: string) => `${STEM_KO[ch]}(${ch}, ${STEM_YY[ch]}의 ${EL_WORD[STEM_EL[ch]!]})`;
const brWord = (ch: string) => `${BR_KO[ch]}(${ch}, ${BR_ANIMAL[ch]}, ${EL_WORD[BR_EL[ch]!]})`;

test("fortune basis: 앱 주인 명식 + 날짜별 일진·십신", () => {
  const START = process.env.BASIS_START ?? "2026-12-01", DAYS = Number(process.env.BASIS_DAYS ?? 14);
  const OUT = process.env.BASIS_OUT ?? path.resolve(__dirname, "..", "..", "..", "..", "피드백", "사주바탕");
  mkdirSync(OUT, { recursive: true });
  const plansPath = process.env.BASIS_PLANS;   // D12 등에서 뽑은 {date, plan, brief, score, band}[] (있으면 "코드가 고른 것"을 붙인다)
  const plans: Record<string, { plan: { core: { part: string; tenGod: string; read: string }; support: { kind: string; text: string } | null }; brief: { 핵심: { 뜻: string; 오늘: string; 표현: string[] }; 보조: { 뜻: string; 오늘: string; 표현: string[] } | null }; score: number; band: string }> = {};
  if (plansPath && existsSync(plansPath)) for (const r of JSON.parse(readFileSync(plansPath, "utf8"))) plans[r.date] = r;

  // BASIS_PROFILE: fortune-basis-profile.migrate.ts가 남긴 {pillars, profile} (운영 프로필). 없으면 OWNER 가정값
  let pillars: PillarsSnapshot;
  let owner: BirthProfile = OWNER; let source = "가정값(1995-10-25 시간 모름)";
  const profPath = process.env.BASIS_PROFILE;
  if (profPath && existsSync(profPath)) { const j = JSON.parse(readFileSync(profPath, "utf8")); pillars = j.pillars; owner = j.profile; source = "운영 프로필"; }
  else { const prof = computeProfile({ ...OWNER, name: "주인" }); if (!prof.ok) throw new Error(prof.error); pillars = prof.value.pillars; }
  const birthLine = `${owner.birthYear}-${String(owner.birthMonth).padStart(2, "0")}-${String(owner.birthDay).padStart(2, "0")} ${owner.calendar === "solar" ? "양력" : "음력"}, ${owner.gender === "male" ? "남" : "여"}, ${owner.city}, ${owner.birthHour == null ? "태어난 시간 모름" : `${owner.birthHour}시 ${owner.birthMinute ?? 0}분`} (${source})`;
  const p = toCorePillars(pillars);
  const dayStem = p[2][0]!;
  const b = balance(p, DEFAULT_POWER_METHOD);
  const { y, votes, agreement } = resolveYongsin(p, b);
  if (!y) throw new Error("용신 없음");

  // ---- 명식 (한 번) ----
  const pillarLine = (name: string, pl: { stem: string; branch: string; ko: string } | null) => pl ? `${name} ${pl.ko}(${pl.stem}${pl.branch}): 위 ${stemWord(pl.stem)} · 아래 ${brWord(pl.branch)}` : `${name} 모름 (태어난 시간을 몰라 비움)`;
  const groupPct = Object.entries(b.그룹퍼센트).sort((a, c) => c[1] - a[1]).map(([g, v]) => `${g} ${v}%`).join(", ");
  const elPct = Object.entries(b.판정용퍼센트).sort((a, c) => c[1] - a[1]).map(([e, v]) => `${e}(${EL_WORD[e]}) ${v}%`).join(", ");
  const roles = Object.entries(y.역할).map(([g, r]) => `${g}=${r}`).join(", ");
  /** 화면 그리기용 구조값 (글 설명과 별개) */
  const stemObj = (ch: string) => ({ 한글: STEM_KO[ch], 한자: ch, 오행: STEM_EL[ch], 음양: STEM_YY[ch], 십신: ch === dayStem ? "나" : getTenGod(dayStem as StemHanja, ch as StemHanja) });
  const brObj = (ch: string) => ({ 한글: BR_KO[ch], 한자: ch, 오행: BR_EL[ch], 동물: BR_ANIMAL[ch], 정기: STEM_KO[MAIN_STEM[ch]!], 십신: getTenGod(dayStem as StemHanja, MAIN_STEM[ch] as StemHanja) });
  const pillarObj = (자리: string, pl: { stem: string; branch: string; ko: string } | null) => pl ? { 자리, 간지한글: pl.ko, 간지한자: pl.stem + pl.branch, 천간: stemObj(pl.stem), 지지: brObj(pl.branch) } : { 자리, 없음: true };
  const chart = {
    사람: "주인", 생년월일: birthLine,
    구조: {
      기둥: [pillarObj("시", pillars.hour), pillarObj("일", pillars.day), pillarObj("월", pillars.month), pillarObj("연", pillars.year)],
      일간: stemObj(dayStem),
      오행퍼센트: b.판정용퍼센트, 그룹퍼센트: b.그룹퍼센트, 역할: y.역할, 인비: b.인비, 신강약: b.신강약, 경계: b.경계, 중심기운: b.중심기운,
      용신: { 그룹: y.용신그룹, 오행: y.용신오행 },
    },
    명식: [pillarLine("연주", pillars.year), pillarLine("월주", pillars.month), pillarLine("일주", pillars.day), pillarLine("시주", pillars.hour)],
    일간: `${stemWord(dayStem)} — 이 글자가 '나'다. 오늘 글자가 어떤 십신인지는 전부 이 글자 기준`,
    세력: { 오행: elPct, 그룹: groupPct, 인비: `${b.인비}% (비겁+인성)` },
    신강약: `${b.신강약}${b.경계 ? " (경계)" : ""} · 중심 기운 ${b.중심기운}${b.혼합 ? ` (${b.혼합}과 섞임)` : ""}`,
    용신: { 그룹: y.용신그룹, 오행: y.용신오행, 역할: roles, 근거: y.근거, 방식: y.방식, ...(p[3] ? {} : { 시간모름: `12개 시주 중 ${votes}개가 같은 판정 → 유불리 폭 ${Math.round(agreement * 100)}%` }) },
    쉬운말: [
      `나는 ${stemWord(dayStem)} 일간이다.`,
      `원국은 ${b.신강약}이고 ${GROUP_PLAIN[b.중심기운]}이 ${b.그룹퍼센트[b.중심기운]}%로 가장 세다. 그래서 ${b.중심기운} 기운이 더 오는 날은 "과함"(기신)으로 본다.`,
      `내게 필요한 기운(용신)은 ${GROUP_PLAIN[y.용신그룹]}, 오행으로는 ${y.용신오행}(${EL_WORD[y.용신오행]}). 이 기운이 오는 날이 수월하다.`,
      `그룹별 역할: ${Object.entries(y.역할).map(([g, r]) => `${g}은 ${r}`).join(", ")}. (용=가장 필요, 희=돕는, 한=중립, 구=방해, 기=이미 넘침)`,
      ...(p[3] ? [] : [`시간을 몰라 시주가 없다. 12가지 시주를 다 넣어 봐서 ${votes}개가 같은 용신이 나왔고, 코어는 그 비율(${Math.round(agreement * 100)}%)만큼만 유불리를 반영한다.`]),
    ],
  };
  writeFileSync(path.join(OUT, "명식_주인.json"), JSON.stringify({ chart }, null, 1), "utf8");
  console.log(JSON.stringify(chart, null, 1));

  // ---- 날짜별 ----
  const rel = relations(p, b, y);
  for (let k = 0; k < DAYS; k++) {
    const date = addDays(START, k);
    const today = dayGanji(date);
    const g = today.hanja;
    const core = computeCoreFortune({ pillars, profile: owner, date, todayHanja: g });
    const l = luck(p, g, b, y);
    const lr = luckRelations(p, g, b, y, rel);
    const personal = adjustWithEntries(core.parts.score01, [], { index: today.index, stemKo: today.stemKo, branchKo: today.branchKo });
    const score10 = toTenPoint(personal.score), band = bandOf(score10);

    const partPlain = (pt: typeof l.천간, where: "천간" | "지지") => {
      const ch = pt.글자; const tg = TEN_GOD_PLAIN[pt.십신]!;
      const word = where === "천간" ? stemWord(ch) : brWord(ch);
      return {
        글자: word, 오행: pt.오행, 십신: pt.십신, 그룹: pt.그룹, 라벨: pt.라벨, 점수: pt.점수, 판정: pt.판정,
        한글: where === "천간" ? STEM_KO[ch] : BR_KO[ch], 한자: ch, ...(where === "천간" ? { 음양: STEM_YY[ch] } : { 동물: BR_ANIMAL[ch], 정기: STEM_KO[MAIN_STEM[ch]!] }),
        관계말: tg.관계, 뜻: tg.뜻, 라벨말: ROLE_PLAIN[pt.라벨],
        설명: `${where} ${word}는 내 일간 ${STEM_KO[dayStem]}(${EL_WORD[STEM_EL[dayStem]!]})에게 ${tg.관계} → ${pt.십신}. ${tg.뜻}. 내 사주에서 ${pt.그룹}은 ${ROLE_PLAIN[pt.라벨]}. (점수 ${pt.점수 > 0 ? "+" : ""}${pt.점수})`,
      };
    };
    const stem = partPlain(l.천간, "천간"), branch = partPlain(l.지지, "지지");
    const 관계: string[] = [];
    for (const c of lr.충) 관계.push(`오늘 지지 ${BR_KO[g[1]!]}가 내 ${c.자리} ${BR_KO[c.상대]}와 충(부딪힘). ${POS_LIFE[c.자리] ?? c.자리} 쪽이 흔들린다. 방향 ${c.방향}, 세기 ${c.강도}${c.위축 ? `, ${BR_KO[c.위축]}(${BR_EL[c.위축]}) 기운이 위축` : ""}`);
    for (const h of lr.합) if (h.단계 !== "불성립") 관계.push(`오늘 지지가 내 글자와 ${h.종류}(${h.글자.split("").map((x) => BR_KO[x]).join("")}, ${h.단계}${h.오행 ? `, ${h.오행}으로 모임` : ""}). ${h.근거}. 코어는 합을 점수에 넣지 않고 표시만 한다`);
    for (const h of core.relations.hits) if (h.kind === "복음") 관계.push(`오늘 지지 ${BR_KO[h.chars]}가 내 ${h.pos}지와 같은 글자(복음). 그 자리 일이 되풀이되기 쉽다`);
    const 영역 = core.areas.map((a) => `${a.period} ${AREA_WORD[a.area]}(${a.area}) ${a.signal} — ${a.why}`);
    const 오늘영역전부 = core.todayAreaProfile ? Object.entries(core.todayAreaProfile).filter(([, v]) => v.contributions.length).map(([n, v]) => `${AREA_WORD[n]}(${n}) 합 ${v.strength}${v.active ? " ●" : ""}${v.mixed ? " (방향 섞임)" : ""}: ${v.contributions.map((c) => `${c.part} ${c.tenGod}/${c.label ?? "-"} ${c.score > 0 ? "+" : ""}${c.score}`).join(", ")}`) : [];
    const ctx = core.context;
    const ctxLine = (name: string, it?: { 간지: string; 판정: string | null; 플래그?: string[]; clash?: { 강도: number; 최고경보: boolean } }) => it ? `${name} ${gjKo(it.간지)}(${it.간지}): ${it.판정 ?? "판정 보류"}${it.clash ? ` · 오늘과 충(세기 ${it.clash.강도}${it.clash.최고경보 ? ", 최고경보" : ""})` : ""}${it.플래그?.length ? ` · 플래그: ${it.플래그.join("; ")}` : ""}` : `${name} 없음`;
    const pl = plans[date];
    const 관계구조 = [
      ...lr.충.map((c) => ({ 종류: "충", 내자리: c.자리, 내글자: BR_KO[c.상대], 오늘글자: BR_KO[g[1]!], 방향: c.방향, 세기: c.강도, 생활: POS_LIFE[c.자리] ?? c.자리 })),
      ...lr.합.filter((h) => h.단계 !== "불성립").map((h) => ({ 종류: h.종류, 글자: h.글자.split("").map((x) => BR_KO[x]).join(""), 단계: h.단계, 오행: h.오행, 근거: h.근거 })),
      ...core.relations.hits.filter((h) => h.kind === "복음").map((h) => ({ 종류: "복음", 내자리: h.pos + "지", 내글자: BR_KO[h.chars], 오늘글자: BR_KO[h.chars], 생활: POS_LIFE[h.pos + "지"] })),
    ];
    const 영역구조 = core.areas.map((a) => ({ 기간: a.period, 영역: a.area, 말: AREA_WORD[a.area], 신호: a.signal, 왜: a.why }));
    const 오늘영역구조 = core.todayAreaProfile ? Object.entries(core.todayAreaProfile).map(([n, v]) => ({ 영역: n, 말: AREA_WORD[n], 합: v.strength, 활성: v.active, 섞임: v.mixed, 기여: v.contributions })) : [];
    const ctxObj = (이름: string, it?: { 간지: string; 판정: string | null; 플래그?: string[]; clash?: { 강도: number; 최고경보: boolean } }) => it ? { 이름, 간지한글: gjKo(it.간지), 간지한자: it.간지, 판정: it.판정 ?? "보류", 충: it.clash ? { 세기: it.clash.강도, 최고경보: it.clash.최고경보 } : null, 플래그: it.플래그 ?? [] } : null;
    const basis = {
      일진: { 간지: `${today.ko}(${g})`, 간지한글: today.ko, 간지한자: g, 천간: stem, 지지: branch, 합계: l.합계, 판정: l.판정, 확신도: l.확신도, 플래그: l.플래그 },
      일간: { 한글: STEM_KO[dayStem], 한자: dayStem, 오행: STEM_EL[dayStem] },
      관계구조, 영역구조, 오늘영역구조,
      맥락구조: [ctxObj("10년 운", ctx.daeun), ctxObj("올해 운", ctx.seun), ctxObj("이달 운", ctx.wolun)].filter(Boolean),
      한줄: `${today.ko}일. 천간 ${stem.십신}(${stem.라벨}) + 지지 ${branch.십신}(${branch.라벨}) = ${l.판정}${core.dayLuck.total !== l.판정 ? ` (앱 판정 ${core.dayLuck.total})` : ""}`,
      관계,
      영역, 오늘영역전부,
      맥락: [ctxLine("10년 운(대운)", ctx.daeun), ctxLine("올해 운(세운)", ctx.seun), ctxLine("이달 운(월운)", ctx.wolun)],
      점수: { 일진: core.parts.raw, 충합: core.parts.rel, 맥락: core.parts.ctx, 합계01: core.parts.score01, 열점: score10, 단계: band, 설명: `0.5가 보통. 일진 ${core.parts.raw} + 충합 ${core.parts.rel} + 맥락 ${core.parts.ctx} → ${core.parts.score01} → 10점 환산 ${score10} (${band})` },
      코어사실: core.facts,
      맥락사실: core.contextFacts,
      주의: core.caveats,
      ...(pl ? { 코드가고른것: { 핵심: `${pl.plan.core.part} ${pl.plan.core.tenGod} ${pl.plan.core.read}`, 보조: pl.plan.support ? `${pl.plan.support.kind}: ${pl.plan.support.text}` : "없음", 작가에게간핵심: pl.brief.핵심, 작가에게간보조: pl.brief.보조, 운영판점수: `${pl.score} (${pl.band})` } } : {}),
    };
    writeFileSync(path.join(OUT, `t${date.replace(/-/g, "")}.json`), JSON.stringify({ basis }, null, 1), "utf8");
    console.log(`${date} ${basis.한줄} | 영역 ${영역.join(" / ")} | 점수 ${score10} ${band}${pl ? ` | D12 ${pl.score} ${pl.band} 핵심 ${pl.plan.core.part} ${pl.plan.core.tenGod} ${pl.plan.core.read}` : ""}`);
  }
  console.log("저장:", OUT);
});

/**
 * 오늘 일진 구조 브리프 — 날마다 운세가 갈라지게 하는 "오늘 잠금".
 * ChatGPT식: 십신·합충·방합·일운 오행%를 짧은 사실로 고정한 뒤 LLM이 영역별로 푼다.
 */
import type { SajuProfile } from "@/lib/diary/types";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import { STEM_META, BRANCH_META } from "@/lib/saju/constants";
import {
  detectBranchRelations,
  detectStemRelations,
  type DetectedRelation,
} from "@/lib/saju/interpretation/relations";
import {
  calculateElementDistribution,
  type ElementKo,
  ELEMENT_ORDER,
} from "@/lib/saju/elementDistribution";
import { TEN_GOD_PLAIN, type NatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";
import type { FortuneLuckMaterials } from "@/lib/journal/fortune/luckMaterials";
import type { FortuneDomainCode } from "@/lib/journal/insight/types";
import type { TenGod } from "@/lib/saju/hiddenStems";

export const DAY_STRUCTURE_BRIEF_VERSION = "day-structure-brief-v1.1.0";

type PillarRole = "시" | "일" | "월" | "년";

type RelationHit = {
  withPillar: PillarRole | "일간";
  kind: string;
  label: string;
  pair: string;
  lifeHint: string;
};

type BanghapHit = {
  name: string;
  element: ElementKo;
  hit: number;
  sources: string[];
  lifeHint: string;
};

type RepeatHit = {
  kind: "stem_repeat" | "branch_repeat";
  detail: string;
  lifeHint: string;
};

export type DayStructureBrief = {
  version: string;
  today: {
    ganjiKo: string;
    stemGod: TenGod | null;
    stemGodPlain: string | null;
    moodLine: string;
  };
  relations: RelationHit[];
  repeats: RepeatHit[];
  banghap: BanghapHit[];
  luckBackground: {
    daeun: string | null;
    sewoon: string | null;
    wolun: string | null;
    oneLiner: string;
  };
  /** 일운 1기둥 luck_only 오행% */
  dayElementPct: Record<ElementKo, number> | null;
  dayElementTop: string[];
  /** 영역별로 오늘 반드시 건드릴 훅 (생활어) */
  domainHooks: Record<FortuneDomainCode, string>;
  /** 오늘이 어제와 갈라지는 핵심 한 줄 */
  dayContrast: string;
};

const BANGHAP_GROUPS = [
  { name: "해자축", element: "수" as ElementKo, branches: ["해", "자", "축"] },
  { name: "인묘진", element: "목" as ElementKo, branches: ["인", "묘", "진"] },
  { name: "사오미", element: "화" as ElementKo, branches: ["사", "오", "미"] },
  { name: "신유술", element: "금" as ElementKo, branches: ["신", "유", "술"] },
] as const;

const MOOD_BY_GOD: Record<TenGod, string> = {
  비견: "자기 페이스·동료·기준 지키기",
  겁재: "경쟁·속도·나누기",
  식신: "만들기·표현·여유 있는 실행",
  상관: "날카로운 표현·반발·예민한 집중",
  편재: "기회·이동·유연한 자원 감각",
  정재: "관리·책임·안정된 성취",
  편관: "압박·도전·집중·돌파",
  정관: "질서·기준·검증·책임",
  편인: "직감·아이디어·비정형 배움",
  정인: "학습·보호·정리·근본 쌓기",
};

const LIFE_BY_RELATION: Record<string, string> = {
  yukhap: "연결·협조가 붙기 쉬운 흐름",
  chung: "일정·방향이 한 번 흔들리거나 수정이 필요해질 수 있음",
  hyeong: "반복 자극·내부 긴장이 쌓이기 쉬움",
  pa: "계획이 어긋나 리듬을 다시 짜야 할 수 있음",
  hae: "말·감정·일정 변경에 평소보다 예민해질 수 있음",
  cheon_gan_hap: "외부 규칙·책임을 내 일처럼 받아들이기 쉬움",
};

const ELEMENT_LIFE: Record<ElementKo, string> = {
  목: "기준·목표·결정",
  화: "학습·표현·지원",
  토: "유지·현실화·책임",
  금: "결과물·정리·기술",
  수: "흐름·유연성·성과 이동",
};

const PILLAR_ORDER: Array<{ key: "hour" | "day" | "month" | "year"; role: PillarRole }> = [
  { key: "hour", role: "시" },
  { key: "day", role: "일" },
  { key: "month", role: "월" },
  { key: "year", role: "년" },
];

function branchKo(hanjaOrKo: string | null | undefined): string | null {
  if (!hanjaOrKo) return null;
  return BRANCH_META[hanjaOrKo]?.ko ?? (/^[가-힣]$/.test(hanjaOrKo) ? hanjaOrKo : null);
}

function stemKo(hanjaOrKo: string | null | undefined): string | null {
  if (!hanjaOrKo) return null;
  return STEM_META[hanjaOrKo]?.ko ?? (/^[가-힣]$/.test(hanjaOrKo) ? hanjaOrKo : null);
}

function ganjiFromLuckSlot(ganjiKo: string | null | undefined): {
  stemKo: string | null;
  branchKo: string | null;
} {
  if (!ganjiKo || ganjiKo.length < 2) return { stemKo: null, branchKo: null };
  return { stemKo: ganjiKo[0] ?? null, branchKo: ganjiKo[1] ?? null };
}

function relationLife(rel: DetectedRelation): string {
  return LIFE_BY_RELATION[rel.kind] ?? rel.description;
}

function collectNatalPillars(profile: SajuProfile): Array<{
  role: PillarRole;
  stemHanja: string;
  branchHanja: string;
  stemKo: string;
  branchKo: string;
}> {
  const out: Array<{
    role: PillarRole;
    stemHanja: string;
    branchHanja: string;
    stemKo: string;
    branchKo: string;
  }> = [];
  for (const { key, role } of PILLAR_ORDER) {
    const p = profile.pillars[key];
    if (!p?.stemHanja || !p?.branchHanja) continue;
    const sk = stemKo(p.stemHanja);
    const bk = branchKo(p.branchHanja);
    if (!sk || !bk) continue;
    out.push({
      role,
      stemHanja: p.stemHanja,
      branchHanja: p.branchHanja,
      stemKo: sk,
      branchKo: bk,
    });
  }
  return out;
}

function detectExpandedRelations(
  natal: ReturnType<typeof collectNatalPillars>,
  dayMasterHanja: string,
  todayStemHanja: string,
  todayBranchHanja: string
): RelationHit[] {
  const hits: RelationHit[] = [];
  const seen = new Set<string>();

  const push = (hit: RelationHit) => {
    const key = `${hit.kind}:${hit.withPillar}:${hit.pair}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };

  // 일간 ↔ 오늘 천간 (갑기합 등)
  for (const rel of detectStemRelations(dayMasterHanja, todayStemHanja)) {
    push({
      withPillar: "일간",
      kind: rel.kind,
      label: rel.label,
      pair: `${rel.left}-${rel.right}`,
      lifeHint: relationLife(rel),
    });
  }

  for (const p of natal) {
    for (const rel of detectStemRelations(p.stemHanja, todayStemHanja)) {
      // 일간 합은 위에서 이미 잡음
      if (p.role === "일" && rel.kind === "cheon_gan_hap") continue;
      push({
        withPillar: p.role,
        kind: rel.kind,
        label: rel.label,
        pair: `${rel.left}-${rel.right}`,
        lifeHint: relationLife(rel),
      });
    }
    for (const rel of detectBranchRelations(p.branchHanja, todayBranchHanja)) {
      push({
        withPillar: p.role,
        kind: rel.kind,
        label: rel.label,
        pair: `${rel.left}-${rel.right}`,
        lifeHint: relationLife(rel),
      });
    }
  }

  return hits;
}

function detectRepeats(
  natal: ReturnType<typeof collectNatalPillars>,
  todayStemKo: string,
  todayBranchKo: string,
  stemGod: TenGod | null,
  luck?: FortuneLuckMaterials
): RepeatHit[] {
  const out: RepeatHit[] = [];
  const stemHits = natal.filter((p) => p.stemKo === todayStemKo);
  if (stemHits.length > 0) {
    out.push({
      kind: "stem_repeat",
      detail: `오늘 천간(${todayStemKo})이 원국 ${stemHits
        .map((p) => p.role)
        .join("·")}과 같음`,
      lifeHint: stemGod
        ? `${MOOD_BY_GOD[stemGod]} 기운이 원국과 겹쳐 더 또렷해질 수 있음`
        : "원국과 같은 천간이 반복되어 주제가 선명해질 수 있음",
    });
  }
  const branchHits = natal.filter((p) => p.branchKo === todayBranchKo);
  if (branchHits.length > 0) {
    out.push({
      kind: "branch_repeat",
      detail: `오늘 지지(${todayBranchKo})가 원국 ${branchHits
        .map((p) => p.role)
        .join("·")}과 같음`,
      lifeHint: "익숙한 패턴이 다시 올라와 관리·책임이 커질 수 있음",
    });
  }

  // 대·세·월운 천간과 오늘 천간 반복 (같은 십신 주제 집중)
  if (luck && todayStemKo) {
    const luckHits: string[] = [];
    if (luck.wolun?.ganjiKo?.[0] === todayStemKo) luckHits.push("월운");
    if (luck.sewoon?.ganjiKo?.[0] === todayStemKo) luckHits.push("세운");
    if (luck.daeun?.ganjiKo?.[0] === todayStemKo) luckHits.push("대운");
    if (luckHits.length > 0) {
      out.push({
        kind: "stem_repeat",
        detail: `오늘 천간(${todayStemKo})이 ${luckHits.join("·")}과 같음`,
        lifeHint: stemGod
          ? `${MOOD_BY_GOD[stemGod]} 주제가 운에서 겹쳐 오늘 더 선명해질 수 있음`
          : "같은 천간이 운에서 반복되어 주제가 집중될 수 있음",
      });
    }
  }
  return out;
}

function detectBanghapWithLuck(input: {
  natalBranches: Array<{ role: PillarRole; ko: string }>;
  todayBranchKo: string;
  sewoonBranchKo: string | null;
  wolunBranchKo: string | null;
}): BanghapHit[] {
  const pool: Array<{ source: string; ko: string }> = [
    ...input.natalBranches.map((b) => ({ source: `원국${b.role}`, ko: b.ko })),
    { source: "오늘", ko: input.todayBranchKo },
  ];
  if (input.sewoonBranchKo) {
    pool.push({ source: "세운", ko: input.sewoonBranchKo });
  }
  if (input.wolunBranchKo) {
    pool.push({ source: "월운", ko: input.wolunBranchKo });
  }

  const uniqueKos = [...new Set(pool.map((p) => p.ko))];
  const hits: BanghapHit[] = [];

  for (const group of BANGHAP_GROUPS) {
    const groupBranches = group.branches as readonly string[];
    if (!groupBranches.includes(input.todayBranchKo)) continue;
    const matched = groupBranches.filter((b) => uniqueKos.includes(b));
    if (matched.length < 2) continue;
    const matchedSet = new Set(matched);
    const sources = pool
      .filter((p) => matchedSet.has(p.ko))
      .map((p) => `${p.source}:${p.ko}`);
    const full = matched.length >= 3;
    hits.push({
      name: group.name,
      element: group.element,
      hit: matched.length,
      sources,
      lifeHint: full
        ? `${group.name} 방합 완성 → ${ELEMENT_LIFE[group.element]} 기능이 강하게 모임`
        : `${group.name} 방합 부분(${matched.join("·")}) → ${ELEMENT_LIFE[group.element]} 기운이 붙는 편`,
    });
  }
  return hits;
}

function dayLuckElementPct(
  profile: SajuProfile,
  todayStemKo: string,
  todayBranchKo: string
): Record<ElementKo, number> | null {
  try {
    const order = ["hour", "day", "month", "year"] as const;
    let stems = "";
    let branches = "";
    for (const key of order) {
      const p = profile.pillars[key];
      if (!p?.stemHanja || !p?.branchHanja) continue;
      const sk = stemKo(p.stemHanja);
      const bk = branchKo(p.branchHanja);
      if (!sk || !bk) continue;
      stems += sk;
      branches += bk;
    }
    if (!stems) return null;
    const result = calculateElementDistribution({
      stems,
      branches,
      daily: { stem: todayStemKo, branch: todayBranchKo },
      calculationMode: "luck_only",
    });
    const pct = result.detail.luckOnly?.percentage ?? result.percentage;
    const out = {} as Record<ElementKo, number>;
    for (const el of ELEMENT_ORDER) {
      out[el] = Math.round((pct[el] ?? 0) * 100) / 100;
    }
    return out;
  } catch {
    return null;
  }
}

function topElements(pct: Record<ElementKo, number> | null, n = 3): string[] {
  if (!pct) return [];
  return [...ELEMENT_ORDER]
    .map((el) => ({ el, v: pct[el] ?? 0 }))
    .filter((x) => x.v > 0.5)
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .map((x) => `${x.el} ${x.v}% (${ELEMENT_LIFE[x.el]})`);
}

function buildDomainHooks(input: {
  stemGod: TenGod | null;
  relations: RelationHit[];
  banghap: BanghapHit[];
  dayElementTop: string[];
  moodLine: string;
}): Record<FortuneDomainCode, string> {
  const officer =
    input.stemGod === "정관" || input.stemGod === "편관";
  const wealth =
    input.stemGod === "정재" || input.stemGod === "편재";
  const output =
    input.stemGod === "식신" || input.stemGod === "상관";
  const resource =
    input.stemGod === "정인" || input.stemGod === "편인";
  const peer =
    input.stemGod === "비견" || input.stemGod === "겁재";
  const sensitive = input.relations.some(
    (r) => r.kind === "chung" || r.kind === "hae" || r.kind === "hyeong"
  );
  const fireBoost = input.banghap.some((b) => b.element === "화" && b.hit >= 2);
  const topEl = input.dayElementTop[0] ?? "";

  return {
    overall: `오늘 분위기: ${input.moodLine}. ${topEl ? `일운 강조: ${topEl}.` : ""}`.trim(),
    work: officer
      ? "역할·마감·평가·검증 장면. 우선순위 정해 진행 공유."
      : output
        ? "구현·문서·결과물로 출력하는 장면."
        : resource || fireBoost
          ? "학습·정리·체계화 후 작은 구현으로 확정."
          : "집중 업무 한 덩어리를 끝내는 장면.",
    relationships: sensitive
      ? "말·일정 변경에 예민. 즉시 반박 대신 의도 확인."
      : peer
        ? "자기 기준이 강해짐. 결론보다 고민 조건을 먼저 말하기."
        : "관찰 후 깊게 책임지는 관계 톤.",
    love: wealth || officer
      ? "감정보다 현실·책임 먼저 생각하기 쉬움. 솔직한 대화 필요."
      : sensitive
        ? "작은 서운함이 커지기 쉬움. 사실-감정 분리해 말하기."
        : "온도·연락의 리듬을 맞추는 장면.",
    money: wealth
      ? "기회·지출·조건을 점검. 충동보다 선별."
      : "큰 수익 단정보다 계획·도구·학습 지출 점검.",
    health: resource || fireBoost
      ? "생각·집중이 길어져 목·어깨·눈 피로. 짧은 휴식 필수."
      : sensitive || officer
        ? "긴장·피로 누적. 수분·수면·스트레칭."
        : "무리한 야근·과열 피하고 리듬 유지.",
  };
}

function buildContrast(input: {
  moodLine: string;
  relations: RelationHit[];
  banghap: BanghapHit[];
  repeats: RepeatHit[];
  dayElementTop: string[];
}): string {
  const bits: string[] = [`분위기=${input.moodLine}`];
  if (input.relations[0]) {
    bits.push(
      `관계=${input.relations[0].label}(${input.relations[0].withPillar}:${input.relations[0].lifeHint})`
    );
  }
  if (input.banghap[0]) {
    bits.push(`방합=${input.banghap[0].lifeHint}`);
  }
  if (input.repeats[0]) {
    bits.push(`반복=${input.repeats[0].lifeHint}`);
  }
  if (input.dayElementTop[0]) {
    bits.push(`일운오행=${input.dayElementTop[0]}`);
  }
  return bits.join(" · ");
}

function luckOneLiner(luck: FortuneLuckMaterials): string {
  const parts: string[] = [];
  if (luck.daeun) {
    parts.push(
      `대운 ${luck.daeun.ganjiKo}${
        luck.daeun.stemTenGod ? `(${luck.daeun.stemTenGod})` : ""
      }`
    );
  }
  if (luck.sewoon) {
    parts.push(
      `세운 ${luck.sewoon.ganjiKo}${
        luck.sewoon.stemTenGod ? `(${luck.sewoon.stemTenGod})` : ""
      }`
    );
  }
  if (luck.wolun) {
    parts.push(
      `월운 ${luck.wolun.ganjiKo}${
        luck.wolun.stemTenGod ? `(${luck.wolun.stemTenGod})` : ""
      }`
    );
  }
  if (parts.length === 0) return "대·세·월 배경 정보 부족. 일진 중심으로 서술.";
  return `${parts.join(" / ")} — 장기·연간·월간 배경 위에 오늘 일진이 촉발.`;
}

/**
 * 원국 × 오늘 일진 × 대세월 → LLM용 짧은 구조 브리프.
 */
export function buildDayStructureBrief(
  eventDate: string,
  sajuProfile: SajuProfile | null | undefined,
  natalDay: NatalDayInsight | null | undefined,
  luck: FortuneLuckMaterials
): DayStructureBrief | null {
  if (!sajuProfile?.pillars?.day?.stemHanja) return null;

  const { dayPillar } = getPillarsForDate(eventDate);
  const todayStemHanja = dayPillar.stem.hanja;
  const todayBranchHanja = dayPillar.branch.hanja;
  const todayStemKoVal = dayPillar.stem.ko;
  const todayBranchKoVal = dayPillar.branch.ko;
  const dayMasterHanja = sajuProfile.pillars.day.stemHanja;

  const natal = collectNatalPillars(sajuProfile);
  const stemGod = natalDay?.todayStemGod ?? null;
  const moodLine = stemGod ? MOOD_BY_GOD[stemGod] : "균형·조율";

  const relations = detectExpandedRelations(
    natal,
    dayMasterHanja,
    todayStemHanja,
    todayBranchHanja
  );
  const repeats = detectRepeats(
    natal,
    todayStemKoVal,
    todayBranchKoVal,
    stemGod,
    luck
  );

  const sewoon = ganjiFromLuckSlot(luck.sewoon?.ganjiKo);
  const wolun = ganjiFromLuckSlot(luck.wolun?.ganjiKo);
  const banghap = detectBanghapWithLuck({
    natalBranches: natal.map((p) => ({ role: p.role, ko: p.branchKo })),
    todayBranchKo: todayBranchKoVal,
    sewoonBranchKo: sewoon.branchKo,
    wolunBranchKo: wolun.branchKo,
  });

  const dayElementPct = dayLuckElementPct(
    sajuProfile,
    todayStemKoVal,
    todayBranchKoVal
  );
  const dayElementTop = topElements(dayElementPct);

  const domainHooks = buildDomainHooks({
    stemGod,
    relations,
    banghap,
    dayElementTop,
    moodLine,
  });

  const dayContrast = buildContrast({
    moodLine,
    relations,
    banghap,
    repeats,
    dayElementTop,
  });

  return {
    version: DAY_STRUCTURE_BRIEF_VERSION,
    today: {
      ganjiKo: dayPillar.ganjiKo,
      stemGod,
      stemGodPlain: stemGod ? TEN_GOD_PLAIN[stemGod] : null,
      moodLine,
    },
    relations,
    repeats,
    banghap,
    luckBackground: {
      daeun: luck.daeun
        ? `${luck.daeun.ganjiKo}${luck.daeun.stemTenGod ? `/${luck.daeun.stemTenGod}` : ""}`
        : null,
      sewoon: luck.sewoon
        ? `${luck.sewoon.ganjiKo}${luck.sewoon.stemTenGod ? `/${luck.sewoon.stemTenGod}` : ""}`
        : null,
      wolun: luck.wolun
        ? `${luck.wolun.ganjiKo}${luck.wolun.stemTenGod ? `/${luck.wolun.stemTenGod}` : ""}`
        : null,
      oneLiner: luckOneLiner(luck),
    },
    dayElementPct,
    dayElementTop,
    domainHooks,
    dayContrast,
  };
}

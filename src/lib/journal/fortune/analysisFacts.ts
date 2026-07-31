/**
 * 원국×운 4계층 분석 사실 — LLM 문장 생성 전에 코드로 고정.
 *
 * 계층1 원국 특징 → 계층2 오늘 운 특징 → 계층3 상호작용 → 계층4 카테고리 근거
 * 사례 문장을 복사하지 않고, 입력 원국·일진마다 새로 계산한다.
 */
import type { SajuProfile } from "@/lib/diary/types";
import { STEM_META, BRANCH_META } from "@/lib/saju/constants";
import {
  calculateElementDistribution,
  ELEMENT_ORDER,
  type ElementKo,
} from "@/lib/saju/elementDistribution";
import {
  getHiddenStemsByBranch,
  getTenGod,
  type StemHanja,
  type BranchHanja,
  type TenGod,
} from "@/lib/saju/hiddenStems";
import type { DayStructureBrief } from "@/lib/journal/fortune/dayStructureBrief";
import type { FortuneLuckMaterials } from "@/lib/journal/fortune/luckMaterials";
import type { NatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";
import type { FortuneDomainCode } from "@/lib/journal/insight/types";
import {
  DAY_MASTER_STEM_DICT,
  ELEMENT_DICT,
  TEN_GOD_DICT,
  isGodInFamily,
} from "@/lib/journal/fortune/dictionaries";

export const ANALYSIS_FACTS_VERSION = "analysis-facts-v1.0.0";

export type AnalysisFeature = {
  factor: string;
  meaning: string;
  positive: string[];
  risk: string[];
  evidence: string[];
};

export type AnalysisInteraction = {
  incomingFactor: string;
  natalFactor: string;
  relation: string;
  positiveExpression: string[];
  negativeExpression: string[];
  recommendedAction: string[];
};

export type FortuneAnalysisFacts = {
  version: string;
  calculationMode: "native_with_luck";
  dayMasterKo: string | null;
  gender: string | null;
  natalFeatures: AnalysisFeature[];
  todayFeatures: AnalysisFeature[];
  interactions: AnalysisInteraction[];
  categoryEvidence: Record<FortuneDomainCode, string[]>;
  /** LLM 압축 요약 — 없는 합·충·십신을 지어내지 못하게 잠금 */
  compressed: {
    natalSummary: {
      strongElements: ElementKo[];
      lessExpressedElements: ElementKo[];
      tZoneTenGods: string[];
      coreFeatures: string[];
    };
    todaySummary: {
      dayPillar: string;
      mainTenGod: string | null;
      dominantElements: ElementKo[];
      relations: string[];
      coreFeatures: string[];
    };
    interactions: Array<{
      cause: string;
      natalResponse: string;
      result: string;
    }>;
  };
};

type TZoneSlot = {
  slot: "월간" | "일지" | "시간";
  label: string;
  tenGod: TenGod | null;
};

function stemKo(hanjaOrKo: string | null | undefined): string | null {
  if (!hanjaOrKo) return null;
  return STEM_META[hanjaOrKo]?.ko ?? (/^[가-힣]$/.test(hanjaOrKo) ? hanjaOrKo : null);
}

function branchKo(hanjaOrKo: string | null | undefined): string | null {
  if (!hanjaOrKo) return null;
  return BRANCH_META[hanjaOrKo]?.ko ?? (/^[가-힣]$/.test(hanjaOrKo) ? hanjaOrKo : null);
}

function safeTenGod(day: StemHanja, target: string): TenGod | null {
  try {
    return getTenGod(day, target as StemHanja);
  } catch {
    return null;
  }
}

function natalStemsBranches(profile: SajuProfile): {
  stems: string;
  branches: string;
} | null {
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
  return { stems, branches };
}

function elementPct(
  profile: SajuProfile,
  mode: "native_only" | "luck_only",
  daily?: { stem: string; branch: string }
): Record<ElementKo, number> | null {
  const sb = natalStemsBranches(profile);
  if (!sb) return null;
  try {
    const result =
      mode === "luck_only" && daily
        ? calculateElementDistribution({
            stems: sb.stems,
            branches: sb.branches,
            daily,
            calculationMode: "luck_only",
          })
        : calculateElementDistribution({
            stems: sb.stems,
            branches: sb.branches,
            // 운 미입력 → 원국만
          });
    const pct =
      mode === "luck_only"
        ? (result.detail.luckOnly?.percentage ?? result.percentage)
        : result.percentage;
    const out = {} as Record<ElementKo, number>;
    for (const el of ELEMENT_ORDER) {
      out[el] = Math.round((pct[el] ?? 0) * 100) / 100;
    }
    return out;
  } catch {
    return null;
  }
}

function rankedElements(pct: Record<ElementKo, number> | null): ElementKo[] {
  if (!pct) return [];
  return [...ELEMENT_ORDER]
    .map((el) => ({ el, v: pct[el] ?? 0 }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.el);
}

function extractTZone(profile: SajuProfile, dayStem: StemHanja): TZoneSlot[] {
  const slots: TZoneSlot[] = [];
  const month = profile.pillars.month;
  if (month?.stemHanja) {
    const sk = stemKo(month.stemHanja);
    slots.push({
      slot: "월간",
      label: sk ? `월간 ${sk}` : "월간",
      tenGod: safeTenGod(dayStem, month.stemHanja),
    });
  }
  const day = profile.pillars.day;
  if (day?.branchHanja) {
    const bk = branchKo(day.branchHanja);
    try {
      const hidden = getHiddenStemsByBranch(day.branchHanja as BranchHanja);
      const main = hidden.find((h) => h.role === "main") ?? hidden[0];
      const god = main ? safeTenGod(dayStem, main.stem) : null;
      slots.push({
        slot: "일지",
        label: bk ? `일지 ${bk}` : "일지",
        tenGod: god,
      });
    } catch {
      slots.push({
        slot: "일지",
        label: bk ? `일지 ${bk}` : "일지",
        tenGod: null,
      });
    }
  }
  const hour = profile.pillars.hour;
  if (hour?.stemHanja) {
    const sk = stemKo(hour.stemHanja);
    slots.push({
      slot: "시간",
      label: sk ? `시간 ${sk}` : "시간",
      tenGod: safeTenGod(dayStem, hour.stemHanja),
    });
  }
  return slots;
}

function buildNatalFeatures(
  profile: SajuProfile,
  dayStemKoVal: string,
  natalPct: Record<ElementKo, number> | null,
  tZone: TZoneSlot[],
  natalDay: NatalDayInsight | null
): AnalysisFeature[] {
  const features: AnalysisFeature[] = [];
  const dm = DAY_MASTER_STEM_DICT[dayStemKoVal];
  if (dm) {
    features.push({
      factor: dm.title,
      meaning: dm.meaning,
      positive: dm.positive,
      risk: dm.risk,
      evidence: [`일간 ${dayStemKoVal}`],
    });
  }

  const ranked = rankedElements(natalPct);
  const strong = ranked[0];
  const weak = ranked[ranked.length - 1];
  if (strong && natalPct && (natalPct[strong] ?? 0) >= 22) {
    const dict = ELEMENT_DICT[strong];
    features.push({
      factor: `${strong} 기운이 원국에서 두드러짐`,
      meaning: `${strong}의 ${dict.positive.slice(0, 3).join("·")} 성향이 생활에서 먼저 드러날 수 있음`,
      positive: dict.positive.slice(0, 3),
      risk: dict.risk.slice(0, 3),
      evidence: [
        `원국 오행% ${strong} ${natalPct[strong]}%`,
        weak && weak !== strong
          ? `상대적 약세 ${weak} ${natalPct[weak]}%`
          : "",
      ].filter(Boolean),
    });
  }

  const tGods = tZone
    .map((s) => s.tenGod)
    .filter((g): g is TenGod => g != null);
  if (tGods.length > 0) {
    const unique = [...new Set(tGods)];
    const positives = unique.flatMap((g) => TEN_GOD_DICT[g].positive.slice(0, 2));
    const risks = unique.flatMap((g) => TEN_GOD_DICT[g].risk.slice(0, 2));
    features.push({
      factor: `T존 ${unique.join("·")}`,
      meaning: "일간 주변에서 바로 쓰기 쉬운 성향·도구",
      positive: [...new Set(positives)].slice(0, 4),
      risk: [...new Set(risks)].slice(0, 4),
      evidence: tZone.map(
        (s) => `${s.label}${s.tenGod ? `(${s.tenGod})` : ""}`
      ),
    });
  }

  const dominant = natalDay?.natalDominant?.[0];
  if (dominant && !tGods.includes(dominant) && features.length < 5) {
    const dict = TEN_GOD_DICT[dominant];
    features.push({
      factor: `원국에서 ${dominant} 기운이 두드러짐`,
      meaning: dict.positive.slice(0, 2).join("·"),
      positive: dict.positive.slice(0, 3),
      risk: dict.risk.slice(0, 3),
      evidence: [`원국 십신 분포 상위: ${dominant}`],
    });
  }

  return features.slice(0, 5);
}

function detectLuckStemRepeats(
  luck: FortuneLuckMaterials,
  todayStemGod: TenGod | null
): AnalysisFeature | null {
  if (!todayStemGod || !luck.ilun?.ganjiKo) return null;
  const todayStem = luck.ilun.ganjiKo[0];
  const slots: Array<{ name: string; ganji: string }> = [];
  if (luck.wolun?.ganjiKo?.[0] === todayStem) {
    slots.push({ name: "월운", ganji: luck.wolun.ganjiKo });
  }
  if (luck.sewoon?.ganjiKo?.[0] === todayStem) {
    slots.push({ name: "세운", ganji: luck.sewoon.ganjiKo });
  }
  if (luck.daeun?.ganjiKo?.[0] === todayStem) {
    slots.push({ name: "대운", ganji: luck.daeun.ganjiKo });
  }
  if (slots.length === 0) return null;
  const dict = TEN_GOD_DICT[todayStemGod];
  return {
    factor: `${todayStem}(${todayStemGod}) 반복`,
    meaning: "같은 십신 주제가 겹쳐 오늘 더 선명하게 활성화될 수 있음",
    positive: dict.positive.slice(0, 3),
    risk: dict.risk.slice(0, 3),
    evidence: [
      `일운 ${luck.ilun.ganjiKo}`,
      ...slots.map((s) => `${s.name} ${s.ganji}`),
    ],
  };
}

function buildTodayFeatures(
  dayBrief: DayStructureBrief | null,
  luck: FortuneLuckMaterials,
  dayPct: Record<ElementKo, number> | null
): AnalysisFeature[] {
  const features: AnalysisFeature[] = [];
  const stemGod = dayBrief?.today.stemGod ?? luck.ilun?.stemTenGod ?? null;
  if (stemGod && TEN_GOD_DICT[stemGod as TenGod]) {
    const god = stemGod as TenGod;
    const dict = TEN_GOD_DICT[god];
    features.push({
      factor: `오늘 천간 ${god}`,
      meaning: `${dict.positive.slice(0, 2).join("·")} 기능 활성화`,
      positive: dict.positive.slice(0, 3),
      risk: dict.risk.slice(0, 3),
      evidence: [
        `일운 ${dayBrief?.today.ganjiKo ?? luck.ilun?.ganjiKo ?? ""}`,
        dayBrief?.today.moodLine ?? "",
      ].filter(Boolean),
    });
  }

  const repeat = detectLuckStemRepeats(luck, stemGod as TenGod | null);
  if (repeat) features.push(repeat);

  for (const b of dayBrief?.banghap ?? []) {
    if (b.hit < 2) continue;
    const elDict = ELEMENT_DICT[b.element];
    features.push({
      factor: `${b.name} 방합${b.hit >= 3 ? " 완성" : " 부분"}`,
      meaning: `${b.element} 기운이 무리 지어 ${elDict.positive.slice(0, 2).join("·")} 방향이 강해질 수 있음`,
      positive: elDict.positive.slice(0, 3),
      risk: elDict.risk.slice(0, 3),
      evidence: b.sources,
    });
  }

  for (const r of (dayBrief?.relations ?? []).slice(0, 2)) {
    features.push({
      factor: `${r.label} (${r.withPillar})`,
      meaning: r.lifeHint,
      positive: ["사실 재확인", "계획 재조정"],
      risk:
        r.kind === "hae" || r.kind === "chung"
          ? ["예민함", "감정 동요", "방향 고민"]
          : ["리듬 흔들림", "수정 필요"],
      evidence: [r.pair, r.kind],
    });
  }

  const ranked = rankedElements(dayPct);
  if (ranked[0] && dayPct && (dayPct[ranked[0]] ?? 0) >= 25) {
    const el = ranked[0];
    features.push({
      factor: `일운 오행에서 ${el} 비중 높음`,
      meaning: `오늘 분위기 보조 지표 — ${ELEMENT_DICT[el].positive.slice(0, 2).join("·")}`,
      positive: ELEMENT_DICT[el].positive.slice(0, 2),
      risk: ELEMENT_DICT[el].risk.slice(0, 2),
      evidence: ELEMENT_ORDER.filter((e) => (dayPct[e] ?? 0) > 0.5).map(
        (e) => `${e} ${dayPct[e]}%`
      ),
    });
  }

  // 중복 factor 제거 후 최대 5
  const seen = new Set<string>();
  const unique: AnalysisFeature[] = [];
  for (const f of features) {
    if (seen.has(f.factor)) continue;
    seen.add(f.factor);
    unique.push(f);
    if (unique.length >= 5) break;
  }
  return unique;
}

function buildInteractions(
  natalFeatures: AnalysisFeature[],
  todayFeatures: AnalysisFeature[],
  tZone: TZoneSlot[],
  natalPct: Record<ElementKo, number> | null,
  dayBrief: DayStructureBrief | null
): AnalysisInteraction[] {
  const out: AnalysisInteraction[] = [];
  const stemGod = dayBrief?.today.stemGod ?? null;
  const tGods = tZone
    .map((s) => s.tenGod)
    .filter((g): g is TenGod => g != null);

  // 관성 + 식상 → 압박을 결과물로
  if (
    stemGod &&
    isGodInFamily(stemGod, "officer") &&
    tGods.some((g) => isGodInFamily(g, "output"))
  ) {
    out.push({
      incomingFactor: `오늘 ${stemGod}`,
      natalFactor: `T존 식상(${tGods.filter((g) => isGodInFamily(g, "output")).join("·")})`,
      relation: "관성을 식상으로 제어·전환",
      positiveExpression: [
        "압박을 문서·코드·체크리스트·결과물로 출력",
        "큰 일을 작은 작업으로 나누기",
      ],
      negativeExpression: [
        "머릿속에만 쌓아 두면 긴장이 커짐",
        "혼자 모든 책임을 떠안기",
      ],
      recommendedAction: [
        "완료된 부분부터 공유",
        "검증·테스트 기록을 남기기",
      ],
    });
  }

  // 관성 + 인성 → 분석·문서로 처리
  if (
    stemGod &&
    isGodInFamily(stemGod, "officer") &&
    tGods.some((g) => isGodInFamily(g, "resource"))
  ) {
    out.push({
      incomingFactor: `오늘 ${stemGod}`,
      natalFactor: `T존 인성(${tGods.filter((g) => isGodInFamily(g, "resource")).join("·")})`,
      relation: "압박을 학습·구조화로 처리",
      positiveExpression: ["구조 파악 후 우선순위 정리", "근거 있는 판단"],
      negativeExpression: ["준비만 길어짐", "실행 지연"],
      recommendedAction: ["분석 후 작은 실행 한 칸"],
    });
  }

  // 강한 오행 + 같은 오행 운 (방합 등)
  const strong = rankedElements(natalPct)[0];
  const banghap = dayBrief?.banghap?.[0];
  if (strong && banghap && banghap.element === strong) {
    out.push({
      incomingFactor: banghap.lifeHint,
      natalFactor: `원국 ${strong} 강세`,
      relation: "동일 오행 강화",
      positiveExpression: [
        `${ELEMENT_DICT[strong].positive.slice(0, 2).join("·")} 장점 확대`,
      ],
      negativeExpression: [
        `${ELEMENT_DICT[strong].risk.slice(0, 2).join("·")} 부담도 함께 커질 수 있음`,
      ],
      recommendedAction: ["장점을 쓰되 범위를 줄여 과열 방지"],
    });
  } else if (strong && banghap && banghap.element !== strong) {
    // 방합 오행이 원국 강세를 생하는 경우 (화생토 등) — 간단 생극
    const generates: Record<ElementKo, ElementKo> = {
      목: "화",
      화: "토",
      토: "금",
      금: "수",
      수: "목",
    };
    if (generates[banghap.element] === strong) {
      out.push({
        incomingFactor: `${banghap.element} 방합`,
        natalFactor: `원국 ${strong} 강세`,
        relation: `${banghap.element}이 ${strong}을 생함`,
        positiveExpression: ["기존 강점이 더 잘 쓰일 수 있음"],
        negativeExpression: ["강점이 과해져 고집·정체로 갈 수 있음"],
        recommendedAction: ["결과물로 끊고 다음 단계로 넘기기"],
      });
    }
  }

  // 방합 + 충/해 동시
  const sensitive = (dayBrief?.relations ?? []).find(
    (r) => r.kind === "chung" || r.kind === "hae" || r.kind === "hyeong"
  );
  if (banghap && banghap.hit >= 2 && sensitive) {
    out.push({
      incomingFactor: banghap.name,
      natalFactor: `${sensitive.label}(${sensitive.withPillar})`,
      relation: "방합과 충·해 동시",
      positiveExpression: ["특정 능력·활동 방향은 강하게 활성화"],
      negativeExpression: [
        "외부 변화·말에 민감해질 수 있음",
        "감정 자극과 방향 고민",
      ],
      recommendedAction: [
        "즉시 반박보다 사실 확인",
        "능력은 쓰되 감정은 한 박자 쉬기",
      ],
    });
  }

  // 인성이 식상을 억제할 수 있는 날 (오늘 인성 + T존 식상)
  if (
    stemGod &&
    isGodInFamily(stemGod, "resource") &&
    tGods.some((g) => isGodInFamily(g, "output"))
  ) {
    out.push({
      incomingFactor: `오늘 ${stemGod}`,
      natalFactor: "T존 식상",
      relation: "인성↔식상",
      positiveExpression: ["지식을 결과물로 변환하는 흐름"],
      negativeExpression: ["생각은 많지만 실행이 줄 수 있음"],
      recommendedAction: ["학습 후 작은 산출물로 마감"],
    });
  }

  // fallback: 원국 첫 특징 × 오늘 첫 특징
  if (out.length === 0 && natalFeatures[0] && todayFeatures[0]) {
    out.push({
      incomingFactor: todayFeatures[0].factor,
      natalFactor: natalFeatures[0].factor,
      relation: "원국×오늘 촉발",
      positiveExpression: todayFeatures[0].positive.slice(0, 2),
      negativeExpression: todayFeatures[0].risk.slice(0, 2),
      recommendedAction: ["강점은 쓰고, 과한 부분은 범위를 줄이기"],
    });
  }

  return out.slice(0, 5);
}

function pickCategoryEvidence(
  domain: FortuneDomainCode,
  natal: AnalysisFeature[],
  today: AnalysisFeature[],
  interactions: AnalysisInteraction[],
  dayBrief: DayStructureBrief | null,
  gender: string | null
): string[] {
  const evidence: string[] = [];
  const stemGod = dayBrief?.today.stemGod ?? null;

  const push = (s: string | null | undefined) => {
    if (!s || evidence.includes(s)) return;
    evidence.push(s);
  };

  // 공통: 일운 직접 관계 우선
  if (dayBrief?.relations[0]) {
    push(
      `일운×원국 ${dayBrief.relations[0].label}: ${dayBrief.relations[0].lifeHint}`
    );
  }
  if (dayBrief?.banghap[0]) {
    push(dayBrief.banghap[0].lifeHint);
  }
  if (dayBrief?.repeats[0]) {
    push(dayBrief.repeats[0].lifeHint);
  }

  switch (domain) {
    case "overall":
      push(dayBrief?.today.moodLine ?? null);
      push(interactions[0]?.recommendedAction[0] ?? null);
      push(today[0]?.factor ?? null);
      push(natal[0]?.factor ?? null);
      break;
    case "work":
      if (stemGod && isGodInFamily(stemGod, "officer")) {
        push("책임·마감·평가·난제 장면이 두드러질 수 있음");
      }
      if (stemGod && isGodInFamily(stemGod, "resource")) {
        push("분석·문서·학습 후 작은 구현으로 확정");
      }
      if (stemGod && isGodInFamily(stemGod, "output")) {
        push("구현·제작·결과물로 출력하는 흐름");
      }
      for (const ix of interactions) {
        if (ix.relation.includes("식상") || ix.relation.includes("인성")) {
          push(ix.recommendedAction[0]);
        }
      }
      break;
    case "relationships":
      if (stemGod && isGodInFamily(stemGod, "peer")) {
        push("자기 기준·동료 의식이 강해질 수 있음");
      }
      if (stemGod && isGodInFamily(stemGod, "officer")) {
        push("책임·보호 톤이 세지거나 강압으로 비칠 수 있음");
      }
      push(
        dayBrief?.relations.some((r) => r.kind === "hae" || r.kind === "chung")
          ? "일정·말에 예민 — 즉시 반박 대신 의도 확인"
          : null
      );
      push("사실→문제→해결 순서로 말하기");
      break;
    case "love": {
      const preferWealth =
        gender === "male" || gender === "남성" || gender === "남";
      const preferOfficer =
        gender === "female" || gender === "여성" || gender === "여";
      if (preferWealth && stemGod && isGodInFamily(stemGod, "wealth")) {
        push("이성·관계 활동 신호가 상대적으로 선명할 수 있음");
      } else if (preferOfficer && stemGod && isGodInFamily(stemGod, "officer")) {
        push("관계의 기준·책임이 선명해질 수 있음");
      } else if (stemGod && isGodInFamily(stemGod, "officer")) {
        push("감정보다 현실 책임·업무가 앞설 수 있음");
      } else if (stemGod && isGodInFamily(stemGod, "output")) {
        push("관심 표현이 실용·제작 톤으로 나타날 수 있음");
      } else {
        push("연애 사건을 확정하지 말고 온도·연락 리듬만 조율");
      }
      push("연인 유무를 가정하지 않음 — 있는 경우/없는 경우 모두 가능성으로만");
      break;
    }
    case "money":
      if (stemGod && isGodInFamily(stemGod, "wealth")) {
        push("기회·지출·조건을 선별해 점검");
      } else {
        push("큰 수익 단정보다 관리·점검 중심");
      }
      if (stemGod && isGodInFamily(stemGod, "resource")) {
        push("학습·도구 지출은 목적을 확인");
      }
      if (stemGod && isGodInFamily(stemGod, "officer")) {
        push("압박감으로 충동 결제·투자하지 않기");
      }
      push("계약·조건은 문서로 재확인");
      break;
    case "health":
      push("질병·사고·수술 단정 금지 — 생활 관리만");
      if (stemGod && isGodInFamily(stemGod, "officer")) {
        push("책임·집중으로 긴장·피로가 쌓일 수 있음");
      }
      if (
        dayBrief?.banghap.some((b) => b.element === "화") ||
        (stemGod && isGodInFamily(stemGod, "resource"))
      ) {
        push("생각·집중이 길어져 휴식·수면이 필요");
      }
      push("규칙적인 식사·수면·가벼운 움직임");
      break;
  }

  return evidence.slice(0, 4);
}

/**
 * 원국·일진·대세월 재료로 분석 사실을 고정한다.
 * LLM은 이 데이터에 없는 합·충·십신을 만들지 않는다.
 */
export function buildFortuneAnalysisFacts(input: {
  profile: SajuProfile | null | undefined;
  natalDay: NatalDayInsight | null | undefined;
  luck: FortuneLuckMaterials;
  dayBrief: DayStructureBrief | null;
}): FortuneAnalysisFacts | null {
  const profile = input.profile;
  if (!profile?.pillars?.day?.stemHanja) return null;

  const dayStemHanja = profile.pillars.day.stemHanja as StemHanja;
  const dayStemKoVal = stemKo(dayStemHanja);
  if (!dayStemKoVal) return null;

  const todayStem = input.dayBrief?.today.ganjiKo?.[0] ?? input.luck.ilun?.ganjiKo?.[0];
  const todayBranch =
    input.dayBrief?.today.ganjiKo?.[1] ?? input.luck.ilun?.ganjiKo?.[1];

  const natalPct = elementPct(profile, "native_only");
  const dayPct =
    todayStem && todayBranch
      ? elementPct(profile, "luck_only", {
          stem: todayStem,
          branch: todayBranch,
        })
      : input.dayBrief?.dayElementPct ?? null;

  const tZone = extractTZone(profile, dayStemHanja);
  const natalFeatures = buildNatalFeatures(
    profile,
    dayStemKoVal,
    natalPct,
    tZone,
    input.natalDay ?? null
  );
  const todayFeatures = buildTodayFeatures(
    input.dayBrief,
    input.luck,
    dayPct
  );
  const interactions = buildInteractions(
    natalFeatures,
    todayFeatures,
    tZone,
    natalPct,
    input.dayBrief
  );

  const gender = profile.gender ?? null;
  const domains: FortuneDomainCode[] = [
    "overall",
    "work",
    "relationships",
    "love",
    "money",
    "health",
  ];
  const categoryEvidence = Object.fromEntries(
    domains.map((d) => [
      d,
      pickCategoryEvidence(
        d,
        natalFeatures,
        todayFeatures,
        interactions,
        input.dayBrief,
        gender
      ),
    ])
  ) as Record<FortuneDomainCode, string[]>;

  const rankedNatal = rankedElements(natalPct);
  const rankedDay = rankedElements(dayPct);

  return {
    version: ANALYSIS_FACTS_VERSION,
    calculationMode: "native_with_luck",
    dayMasterKo: dayStemKoVal,
    gender,
    natalFeatures,
    todayFeatures,
    interactions,
    categoryEvidence,
    compressed: {
      natalSummary: {
        strongElements: rankedNatal.slice(0, 2),
        lessExpressedElements: rankedNatal.slice(-2).reverse(),
        tZoneTenGods: tZone
          .map((s) => (s.tenGod ? `${s.slot}:${s.tenGod}` : null))
          .filter((x): x is string => x != null),
        coreFeatures: natalFeatures.map((f) => f.factor),
      },
      todaySummary: {
        dayPillar:
          input.dayBrief?.today.ganjiKo ?? input.luck.ilun?.ganjiKo ?? "",
        mainTenGod: input.dayBrief?.today.stemGod ?? null,
        dominantElements: rankedDay.slice(0, 2),
        relations: [
          ...(input.dayBrief?.relations.map(
            (r) => `${r.label}(${r.withPillar})`
          ) ?? []),
          ...(input.dayBrief?.banghap.map(
            (b) => `${b.name}${b.hit >= 3 ? "완성" : "부분"}`
          ) ?? []),
          ...(input.dayBrief?.repeats.map((r) => r.detail) ?? []),
        ].slice(0, 6),
        coreFeatures: todayFeatures.map((f) => f.factor),
      },
      interactions: interactions.map((ix) => ({
        cause: ix.incomingFactor,
        natalResponse: ix.natalFactor,
        result: ix.recommendedAction[0] ?? ix.positiveExpression[0] ?? "",
      })),
    },
  };
}

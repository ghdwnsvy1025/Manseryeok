import {
  BRANCH_META,
  STEM_META,
  type Element,
} from "@/lib/saju/constants";
import {
  HIDDEN_STEMS_BY_BRANCH,
  type BranchHanja,
  type StemHanja,
} from "@/lib/saju/hiddenStems";
import {
  detectNatalRelations,
  type DetectedRelation,
} from "@/lib/saju/interpretation/relations";
import { isSajuRelationsScoringEnabled } from "@/lib/app/featureFlags";
import { SAJU_RULE_VERSION } from "./version";
import type {
  DayMasterStrength,
  ElementForce,
  Evidence,
  PillarRole,
  RootingLevel,
  Season,
  SajuRuleOutput,
  StemAnalysis,
  StrategyBlock,
} from "./types";
import { mapRuleToKeywords } from "./keywords";

const ELEMENTS: Element[] = ["wood", "fire", "earth", "metal", "water"];

const GENERATES: Record<Element, Element> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

const CONTROLS: Record<Element, Element> = {
  wood: "earth",
  fire: "metal",
  earth: "water",
  metal: "wood",
  water: "fire",
};

const ELEMENT_KO: Record<Element, string> = {
  wood: "목",
  fire: "화",
  earth: "토",
  metal: "금",
  water: "수",
};

const SEASON_BY_BRANCH: Record<string, { season: Season; commanding: Element }> =
  {
    寅: { season: "spring", commanding: "wood" },
    卯: { season: "spring", commanding: "wood" },
    辰: { season: "earth_transition", commanding: "earth" },
    巳: { season: "summer", commanding: "fire" },
    午: { season: "summer", commanding: "fire" },
    未: { season: "earth_transition", commanding: "earth" },
    申: { season: "autumn", commanding: "metal" },
    酉: { season: "autumn", commanding: "metal" },
    戌: { season: "earth_transition", commanding: "earth" },
    亥: { season: "winter", commanding: "water" },
    子: { season: "winter", commanding: "water" },
    丑: { season: "earth_transition", commanding: "earth" },
  };

/** 기둥 입력 — 한자 천간/지지 */
export type RulePillarInput = {
  year: { stem: string; branch: string };
  month: { stem: string; branch: string };
  day: { stem: string; branch: string };
  hour?: { stem: string; branch: string } | null;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function stemElement(stem: string): Element {
  const meta = STEM_META[stem];
  if (!meta) throw new Error(`Unknown stem: ${stem}`);
  return meta.element;
}

function stemKo(stem: string): string {
  return STEM_META[stem]?.ko ?? stem;
}

function branchKo(branch: string): string {
  return BRANCH_META[branch]?.ko ?? branch;
}

function normalizeStem(raw: string): string {
  if (STEM_META[raw]) return raw;
  const found = Object.entries(STEM_META).find(([, m]) => m.ko === raw);
  if (found) return found[0];
  throw new Error(`Unknown stem: ${raw}`);
}

function normalizeBranch(raw: string): string {
  if (BRANCH_META[raw]) return raw;
  const found = Object.entries(BRANCH_META).find(([, m]) => m.ko === raw);
  if (found) return found[0];
  throw new Error(`Unknown branch: ${raw}`);
}

function hiddenOf(branch: string) {
  return HIDDEN_STEMS_BY_BRANCH[branch as BranchHanja] ?? [];
}

/**
 * 통근: 천간이 지지 지장간에 뿌리를 두는가.
 * main → full, middle/residual → partial
 */
function assessRooting(
  stem: string,
  branches: Array<{ role: PillarRole; branch: string }>
): { level: RootingLevel; roots: string[] } {
  const roots: string[] = [];
  let best: RootingLevel = "none";
  for (const { branch } of branches) {
    for (const h of hiddenOf(branch)) {
      if (h.stem !== stem) continue;
      roots.push(branch);
      if (h.role === "main") best = "full";
      else if (best !== "full") best = "partial";
    }
  }
  return { level: best, roots: [...new Set(roots)] };
}

function seasonOf(monthBranch: string): {
  season: Season;
  commandingElement: Element;
} {
  const s = SEASON_BY_BRANCH[monthBranch];
  if (!s) {
    return { season: "earth_transition", commandingElement: "earth" };
  }
  return { season: s.season, commandingElement: s.commanding };
}

/**
 * 힘 점수 — 월령(계절)·통근·투출·동일 오행 세력·생조를 반영.
 * 가시성과 분리한다.
 */
function strengthForStem(opts: {
  element: Element;
  rooting: RootingLevel;
  projected: boolean;
  commanding: Element;
  sameElementCount: number;
  generatedByCount: number;
  controlledByCount: number;
}): number {
  let s = 0.35;
  if (opts.element === opts.commanding) s += 0.22;
  else if (GENERATES[opts.commanding] === opts.element) s += 0.1;
  else if (CONTROLS[opts.commanding] === opts.element) s -= 0.12;

  if (opts.rooting === "full") s += 0.2;
  else if (opts.rooting === "partial") s += 0.1;

  if (opts.projected) s += 0.08;
  s += Math.min(0.15, opts.sameElementCount * 0.05);
  s += Math.min(0.12, opts.generatedByCount * 0.04);
  s -= Math.min(0.15, opts.controlledByCount * 0.05);
  return clamp01(s);
}

/**
 * 행동 가시성 — 일지·월간·시간·T존·천간 노출 거리.
 * 힘과 독립적으로 계산한다.
 */
function visibilityForStem(opts: {
  role: PillarRole;
  projected: boolean;
  inTZone: boolean;
  rooting: RootingLevel;
}): number {
  let v = 0.2;
  if (opts.role === "day") v += 0.15;
  if (opts.role === "month") v += 0.2;
  if (opts.role === "hour") v += 0.18;
  if (opts.role === "year") v += 0.05;
  if (opts.inTZone) v += 0.15;
  if (opts.projected) v += 0.12;
  if (opts.rooting === "full") v += 0.08;
  else if (opts.rooting === "partial") v += 0.04;
  return clamp01(v);
}

function pickYongHeeGi(
  dayElement: Element,
  strength: DayMasterStrength,
  forces: ElementForce[]
): {
  yong: Element;
  hee: Element;
  gi: Element;
  confidence: number;
  notes: string[];
} {
  const byEl = Object.fromEntries(
    forces.map((f) => [f.element, f.strengthScore])
  ) as Record<Element, number>;

  const notes: string[] = [];
  let yong: Element;
  let confidence = 0.55;

  if (strength === "strong") {
    // 신강 → 설기(식상) 또는 극(재성)을 용으로. 과다한 오행은 피한다.
    const drain = GENERATES[dayElement];
    const wealth = CONTROLS[dayElement];
    yong = byEl[drain] <= byEl[wealth] + 0.05 ? drain : wealth;
    notes.push(
      `일간이 강해 ${ELEMENT_KO[yong]}을(를) 용신 후보로 둔다 (설기·극 중 세력이 덜한 쪽).`
    );
    confidence = 0.62;
  } else if (strength === "weak") {
    // 신약 → 인성(생) 또는 비겁(동오행)
    const resource = Object.entries(GENERATES).find(
      ([, to]) => to === dayElement
    )?.[0] as Element | undefined;
    const peer = dayElement;
    if (resource && byEl[resource] >= byEl[peer]) {
      yong = resource;
      notes.push(
        `일간이 약해 생조하는 ${ELEMENT_KO[yong]}을(를) 용신 후보로 둔다.`
      );
    } else {
      yong = peer;
      notes.push(
        `일간이 약해 같은 오행 ${ELEMENT_KO[yong]}을(를) 용신 후보로 둔다.`
      );
    }
    confidence = 0.6;
  } else {
    // 균형 → 월령 부족분을 채우거나 흐름을 잇는 쪽
    const weakest = [...ELEMENTS].sort((a, b) => byEl[a] - byEl[b])[0]!;
    yong = weakest;
    notes.push(
      `일간이 균형에 가까워 세력이 가장 약한 ${ELEMENT_KO[yong]}을(를) 조절 후보로 둔다.`
    );
    confidence = 0.5;
  }

  const hee = Object.entries(GENERATES).find(([, to]) => to === yong)?.[0] as
    | Element
    | undefined;
  const gi = CONTROLS[yong];

  notes.push(
    `희신은 용신을 생하는 ${ELEMENT_KO[hee ?? dayElement]}, 기신은 용신을 극하는 ${ELEMENT_KO[gi]}.`
  );
  notes.push(
    "용신이라도 무조건 좋은 날, 기신이라도 무조건 나쁜 날이 아니다. 힘과 가시성을 함께 본다."
  );

  return {
    yong,
    hee: hee ?? dayElement,
    gi,
    confidence,
    notes,
  };
}

function strategyFor(
  element: Element,
  plainLabel: string,
  rationale: string
): StrategyBlock {
  return { element, plainLabel, rationale };
}

function emptyForces(): ElementForce[] {
  return ELEMENTS.map((element) => ({
    element,
    strengthScore: 0,
    behaviorVisibilityScore: 0,
    reasons: [],
  }));
}

/**
 * 설명 가능한 사주 규칙 엔진.
 * RAG/LLM이 값을 자유 생성하지 않는다 — 입력 명식만으로 결정한다.
 */
export function runSajuRuleEngine(
  input: RulePillarInput,
  opts: { relationsScoringEnabled?: boolean } = {}
): SajuRuleOutput {
  const year = {
    stem: normalizeStem(input.year.stem),
    branch: normalizeBranch(input.year.branch),
  };
  const month = {
    stem: normalizeStem(input.month.stem),
    branch: normalizeBranch(input.month.branch),
  };
  const day = {
    stem: normalizeStem(input.day.stem),
    branch: normalizeBranch(input.day.branch),
  };
  const hour = input.hour
    ? {
        stem: normalizeStem(input.hour.stem),
        branch: normalizeBranch(input.hour.branch),
      }
    : null;

  const evidence: Evidence[] = [];
  const pillars: Array<{
    role: PillarRole;
    stem: string;
    branch: string;
  }> = [
    { role: "year", ...year },
    { role: "month", ...month },
    { role: "day", ...day },
  ];
  if (hour) pillars.push({ role: "hour", ...hour });

  const branches = pillars.map((p) => ({
    role: p.role,
    branch: p.branch,
  }));

  // 1. 일간
  const dayMasterElement = stemElement(day.stem);
  evidence.push({
    code: "day_master",
    detail: `일간 ${stemKo(day.stem)}(${ELEMENT_KO[dayMasterElement]})`,
  });

  // 2. T존 — 월간·일지·시간
  const tZoneLabels = [
    `월간 ${stemKo(month.stem)}`,
    `일지 ${branchKo(day.branch)}`,
  ];
  if (hour) tZoneLabels.push(`시간 ${stemKo(hour.stem)}${branchKo(hour.branch)}`);
  evidence.push({
    code: "t_zone",
    detail: `T존: ${tZoneLabels.join(" · ")}`,
  });

  // 3. 월지·계절
  const season = seasonOf(month.branch);
  evidence.push({
    code: "season",
    detail: `월지 ${branchKo(month.branch)} → ${season.season} / 월령 ${ELEMENT_KO[season.commandingElement]}`,
  });

  // 5. 투출 — 지장간이 천간에 나타남
  const projections: SajuRuleOutput["projections"] = [];
  const projectedStems = new Set<string>();
  for (const bp of branches) {
    for (const h of hiddenOf(bp.branch)) {
      const appears = pillars.some(
        (p) => p.stem === h.stem && p.role !== bp.role
      );
      // 같은 기둥의 천간=정기면 투출로 보지 않고, 다른 기둥에 나타날 때 투출
      const asOtherStem = pillars.find(
        (p) => p.stem === h.stem && p.branch !== bp.branch
      );
      if (!asOtherStem) continue;
      projections.push({
        stem: h.stem,
        fromBranch: bp.branch,
        fromPillar: bp.role,
        role: h.role,
      });
      projectedStems.add(h.stem);
    }
  }
  if (projections.length > 0) {
    evidence.push({
      code: "projection",
      detail: `투출 ${projections.length}건: ${projections
        .map((p) => `${stemKo(p.stem)}←${branchKo(p.fromBranch)}`)
        .join(", ")}`,
    });
  }

  // 오행 카운트 (천간 + 정기)
  const elementCounts: Record<Element, number> = {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  };
  for (const p of pillars) {
    elementCounts[stemElement(p.stem)] += 1;
    const main = hiddenOf(p.branch).find((h) => h.role === "main");
    if (main) elementCounts[main.element] += 0.7;
  }

  // 4·6·14. 글자별 통근·힘·가시성
  const stems: StemAnalysis[] = pillars.map((p) => {
    const el = stemElement(p.stem);
    const rooting = assessRooting(p.stem, branches);
    const projected = projectedStems.has(p.stem);
    const inTZone =
      (p.role === "month" && p.stem === month.stem) ||
      p.role === "day" ||
      p.role === "hour";

    const sameElementCount = pillars.filter(
      (x) => stemElement(x.stem) === el
    ).length;
    const generatedByCount = pillars.filter(
      (x) => GENERATES[stemElement(x.stem)] === el
    ).length;
    const controlledByCount = pillars.filter(
      (x) => CONTROLS[stemElement(x.stem)] === el
    ).length;

    const strengthScore = strengthForStem({
      element: el,
      rooting: rooting.level,
      projected,
      commanding: season.commandingElement,
      sameElementCount,
      generatedByCount,
      controlledByCount,
    });
    const behaviorVisibilityScore = visibilityForStem({
      role: p.role,
      projected,
      inTZone,
      rooting: rooting.level,
    });

    return {
      role: p.role,
      stem: p.stem,
      stemKo: stemKo(p.stem),
      element: el,
      rooting: rooting.level,
      rootBranches: rooting.roots,
      projected,
      strengthScore: round3(strengthScore),
      behaviorVisibilityScore: round3(behaviorVisibilityScore),
    };
  });

  const dayStem = stems.find((s) => s.role === "day")!;
  evidence.push({
    code: "rooting",
    detail: `일간 통근: ${dayStem.rooting}${
      dayStem.rootBranches.length
        ? ` (${dayStem.rootBranches.map(branchKo).join(",")})`
        : ""
    }`,
    weight: dayStem.strengthScore,
  });
  evidence.push({
    code: "visibility",
    detail: `일간 가시성 ${dayStem.behaviorVisibilityScore}`,
    weight: dayStem.behaviorVisibilityScore,
  });

  // 6. 오행별 세력
  const maxCount = Math.max(...ELEMENTS.map((e) => elementCounts[e]), 0.01);
  const elementForces: ElementForce[] = emptyForces().map((f) => {
    const stemVis = stems
      .filter((s) => s.element === f.element)
      .map((s) => s.behaviorVisibilityScore);
    const stemStr = stems
      .filter((s) => s.element === f.element)
      .map((s) => s.strengthScore);
    const strengthScore = round3(
      clamp01(
        (elementCounts[f.element] / maxCount) * 0.55 +
          (stemStr.length
            ? stemStr.reduce((a, b) => a + b, 0) / stemStr.length
            : 0) *
            0.45
      )
    );
    const behaviorVisibilityScore = round3(
      clamp01(
        stemVis.length
          ? stemVis.reduce((a, b) => a + b, 0) / Math.max(1, stemVis.length)
          : elementCounts[f.element] > 0
            ? 0.25
            : 0
      )
    );
    const reasons: string[] = [];
    if (f.element === season.commandingElement) reasons.push("월령");
    if (stemStr.length) reasons.push(`천간 ${stemStr.length}`);
    return { ...f, strengthScore, behaviorVisibilityScore, reasons };
  });
  evidence.push({
    code: "element_force",
    detail: elementForces
      .map((f) => `${ELEMENT_KO[f.element]}:${f.strengthScore}`)
      .join(" "),
  });

  // 7. 중심 기운 — 월령 + 세력 최대
  const central = [...elementForces].sort(
    (a, b) =>
      b.strengthScore +
      (b.element === season.commandingElement ? 0.15 : 0) -
      (a.strengthScore + (a.element === season.commandingElement ? 0.15 : 0))
  )[0]!;
  const centralQi = {
    element: central.element,
    score: round3(
      clamp01(
        central.strengthScore +
          (central.element === season.commandingElement ? 0.1 : 0)
      )
    ),
    reasons: [
      `세력 ${central.strengthScore}`,
      ...(central.element === season.commandingElement ? ["월령 일치"] : []),
    ],
  };
  evidence.push({
    code: "central_qi",
    detail: `중심 기운 ${ELEMENT_KO[centralQi.element]} (${centralQi.score})`,
  });

  // 8. 오행 흐름
  const flow = {
    generating: ELEMENTS.map((from) => ({
      from,
      to: GENERATES[from],
      strength: round3(
        (elementForces.find((f) => f.element === from)?.strengthScore ?? 0) *
          (elementForces.find((f) => f.element === GENERATES[from])
            ?.strengthScore ?? 0)
      ),
    })).filter((x) => x.strength > 0.05),
    controlling: ELEMENTS.map((from) => ({
      from,
      to: CONTROLS[from],
      strength: round3(
        (elementForces.find((f) => f.element === from)?.strengthScore ?? 0) *
          (elementForces.find((f) => f.element === CONTROLS[from])
            ?.strengthScore ?? 0)
      ),
    })).filter((x) => x.strength > 0.05),
  };
  evidence.push({
    code: "flow",
    detail: `생 ${flow.generating.length} · 극 ${flow.controlling.length}`,
  });

  // 9. 고립 — 통근 없고 생조도 약한 천간
  const isolated: SajuRuleOutput["isolated"] = [];
  for (const s of stems) {
    if (s.rooting !== "none") continue;
    const helped = elementForces.some(
      (f) =>
        GENERATES[f.element] === s.element && f.strengthScore >= 0.35
    );
    if (helped) continue;
    isolated.push({
      char: s.stem,
      role: s.role,
      reason: "통근 없고 생조 세력 약함",
    });
  }
  if (isolated.length) {
    evidence.push({
      code: "isolation",
      detail: `고립 ${isolated.map((i) => stemKo(i.char)).join(",")}`,
    });
  }

  // 일간 신강/신약
  let dmStrength: DayMasterStrength = "balanced";
  if (dayStem.strengthScore >= 0.62) dmStrength = "strong";
  else if (dayStem.strengthScore <= 0.42) dmStrength = "weak";

  // 11–13. 용희기신
  const yongHeeGi = pickYongHeeGi(
    dayMasterElement,
    dmStrength,
    elementForces
  );
  evidence.push({
    code: "yong",
    detail: `용신 ${ELEMENT_KO[yongHeeGi.yong]}`,
    weight: yongHeeGi.confidence,
  });
  evidence.push({
    code: "hee",
    detail: `희신 ${ELEMENT_KO[yongHeeGi.hee]}`,
  });
  evidence.push({
    code: "gi",
    detail: `기신 ${ELEMENT_KO[yongHeeGi.gi]}`,
  });

  const defaultStrategy = strategyFor(
    yongHeeGi.yong,
    `${ELEMENT_KO[yongHeeGi.yong]} 기운을 오늘의 기본 방향으로`,
    yongHeeGi.notes[0] ?? "용신 후보를 기본 전략으로 둔다."
  );
  const overuseRisk = strategyFor(
    yongHeeGi.gi,
    `${ELEMENT_KO[yongHeeGi.gi]} 기운의 과사용에 주의`,
    "기신 오행을 과하게 쓰면 균형이 깨질 수 있다. 무조건 나쁜 날은 아니다."
  );
  const regulationResource = strategyFor(
    yongHeeGi.hee,
    `${ELEMENT_KO[yongHeeGi.hee]} 기운으로 조절`,
    "희신 오행은 용신을 돕는 조절 자원이다."
  );

  // 합·충·형·파·해 — 특징 저장, 점수 반영은 플래그
  const stemsHanja = pillars.map((p) => p.stem as StemHanja);
  const branchesHanja = pillars.map((p) => p.branch as BranchHanja);
  const detected: DetectedRelation[] = detectNatalRelations({
    stems: stemsHanja,
    branches: branchesHanja,
  });
  const scoringEnabled =
    opts.relationsScoringEnabled ?? isSajuRelationsScoringEnabled();
  let scoreDelta = 0;
  if (scoringEnabled) {
    // MVP: 충·형은 소폭 감점, 합은 소폭 가점 — 실험용이며 기본 OFF
    for (const r of detected) {
      if (r.kind === "chung" || r.kind === "hyeong") scoreDelta -= 0.03;
      else if (r.kind === "yukhap" || r.kind === "cheon_gan_hap")
        scoreDelta += 0.02;
    }
    scoreDelta = round3(clamp01(0.5 + scoreDelta) - 0.5);
  }
  evidence.push({
    code: scoringEnabled ? "relations_stored" : "relations_scoring_off",
    detail: scoringEnabled
      ? `합충 점수 반영 ON (Δ ${scoreDelta})`
      : `합충 ${detected.length}건 저장만 (점수 반영 OFF)`,
  });

  const keywords = mapRuleToKeywords({
    dayMasterElement,
    strength: dmStrength,
    yong: yongHeeGi.yong,
    hee: yongHeeGi.hee,
    gi: yongHeeGi.gi,
    central: centralQi.element,
    isolatedCount: isolated.length,
  });

  const confidence = round3(
    clamp01(
      0.35 +
        yongHeeGi.confidence * 0.35 +
        (hour ? 0.1 : 0) +
        (dayStem.rooting !== "none" ? 0.1 : 0) -
        isolated.length * 0.03
    )
  );

  return {
    ruleVersion: SAJU_RULE_VERSION,
    dayMaster: {
      stem: day.stem,
      stemKo: stemKo(day.stem),
      element: dayMasterElement,
      strength: dmStrength,
      strengthScore: dayStem.strengthScore,
    },
    tZone: {
      monthStem: month.stem,
      dayBranch: day.branch,
      hourGanji: hour ? `${hour.stem}${hour.branch}` : null,
      labels: tZoneLabels,
    },
    season: {
      monthBranch: month.branch,
      season: season.season,
      commandingElement: season.commandingElement,
    },
    stems,
    projections,
    elementForces,
    centralQi,
    flow,
    isolated,
    yongHeeGi: {
      yong: yongHeeGi.yong,
      hee: yongHeeGi.hee,
      gi: yongHeeGi.gi,
      confidence: yongHeeGi.confidence,
      notes: yongHeeGi.notes,
    },
    defaultStrategy,
    overuseRisk,
    regulationResource,
    keywords,
    relations: {
      detected,
      scoringEnabled,
      scoreDelta,
    },
    confidence,
    evidence,
  };
}

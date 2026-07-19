import { getTenGod } from "@/lib/saju/hiddenStems";
import { BRANCH_META, STEM_META, STEMS, type Element } from "@/lib/saju/constants";
import type { DiaryDayPillar, DiaryEntry, SajuProfile } from "@/lib/diary/types";
import { getSampleLevel, SAMPLE_LEVEL_LABELS } from "@/lib/diary/types";
import { detectDayRelations } from "./relations";
import type {
  BeginnerFlowCard,
  BeginnerTodayFlow,
  ExpertInsightSection,
  RecordPatternInsight,
} from "./types";

const ELEMENT_FLOW: Record<Element, { energy: string; relation: string; focus: string; condition: string }> = {
  wood: {
    energy: "시작하는 기운이 느껴질 수 있어요",
    relation: "대화와 협업이 도움이 될 수 있어요",
    focus: "새로운 아이디어를 메모해두면 좋아요",
    condition: "무리한 확장보다 리듬을 지키는 편이 좋아요",
  },
  fire: {
    energy: "표현·활동 에너지가 높은 편일 수 있어요",
    relation: "감정 표현이 평소보다 선명해질 수 있어요",
    focus: "한 가지에 집중해 마무리하면 좋아요",
    condition: "과열되지 않도록 짧은 휴식을 끼워보세요",
  },
  earth: {
    energy: "안정적으로 유지하려는 흐름이에요",
    relation: "신뢰를 쌓는 대화가 중요할 수 있어요",
    focus: "정리와 점검에 에너지가 모일 수 있어요",
    condition: "생활 리듬을 일정하게 가져가면 좋아요",
  },
  metal: {
    energy: "정리·결단의 기운이 있을 수 있어요",
    relation: "경계와 약속을 분명히 하면 편해질 수 있어요",
    focus: "불필요한 일을 줄이면 집중도가 올라가요",
    condition: "긴장되면 호흡을 천천히 가다듬어보세요",
  },
  water: {
    energy: "유연하게 흐르는 기운이에요",
    relation: "깊이 있는 대화가 도움이 될 수 있어요",
    focus: "혼자 정리할 시간을 조금 확보해보세요",
    condition: "수면과 회복을 우선해도 좋아요",
  },
};

function stemHanjaFromKo(ko: string): (typeof STEMS)[number] | null {
  for (const stem of STEMS) {
    if (STEM_META[stem].ko === ko) return stem;
  }
  return null;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function findSameGanjiEntries(
  entries: DiaryEntry[],
  ganjiKo: string,
  excludeDate?: string
): DiaryEntry[] {
  return entries
    .filter((e) => e.dayPillar.ganjiKo === ganjiKo && e.date !== excludeDate)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function buildRecordPatternInsight(
  entries: DiaryEntry[],
  ganjiKo: string,
  excludeDate?: string
): RecordPatternInsight | null {
  const matched = findSameGanjiEntries(entries, ganjiKo, excludeDate);
  if (matched.length === 0) return null;
  const happiness = matched
    .map((e) => e.happinessRating)
    .filter((v): v is NonNullable<typeof v> => typeof v === "number");
  const condition = matched
    .map((e) => e.conditionRating)
    .filter((v): v is NonNullable<typeof v> => typeof v === "number");
  const avgH = avg(happiness);
  const avgC = avg(condition);
  const level = SAMPLE_LEVEL_LABELS[getSampleLevel(matched.length)];

  let summary = `같은 일진(${ganjiKo}) 기록이 ${matched.length}회 있어요. (${level})`;
  if (avgH != null) summary += ` 평균 행복도는 ${avgH}점.`;
  if (avgC != null) summary += ` 평균 컨디션은 ${avgC}점.`;
  summary += " 미래의 결과를 확정하지 않으며, 내 과거 경험을 참고하는 용도예요.";

  return {
    title: "지난번 비슷한 날",
    summary,
    sampleSize: matched.length,
    dates: matched.slice(0, 5).map((e) => e.date),
  };
}

export function buildBeginnerTodayFlow(input: {
  dayPillar: DiaryDayPillar;
  sajuProfile?: SajuProfile | null;
  entries?: DiaryEntry[];
  todayDate?: string;
}): BeginnerTodayFlow {
  const { dayPillar, sajuProfile, entries = [], todayDate } = input;
  const stemEl = STEM_META[dayPillar.stem.hanja as keyof typeof STEM_META]?.element;
  const branchEl = BRANCH_META[dayPillar.branch.hanja as keyof typeof BRANCH_META]?.element;
  const flow = stemEl ? ELEMENT_FLOW[stemEl] : ELEMENT_FLOW.earth;
  const relations =
    sajuProfile?.pillars.day
      ? detectDayRelations({
          natalStemHanja: sajuProfile.pillars.day.stemHanja,
          natalBranchHanja: sajuProfile.pillars.day.branchHanja,
          todayStemHanja: dayPillar.stem.hanja,
          todayBranchHanja: dayPillar.branch.hanja,
        })
      : [];

  const changeRelation = relations.find((r) => r.kind === "chung" || r.kind === "hyeong");
  const emotionStatus = changeRelation
    ? "변화가 있을 수 있어요"
    : relations.length > 0
      ? "조율과 연결이 중요해 보여요"
      : "비교적 담담한 흐름일 수 있어요";

  const cards: BeginnerFlowCard[] = [
    {
      id: "emotion",
      title: "감정 흐름",
      status: emotionStatus,
      evidence: [
        `오늘 일진 ${dayPillar.ganjiKo}`,
        ...(changeRelation
          ? [`원국 일지와 오늘 일지의 ${changeRelation.label} 관계`]
          : [`오늘 천간 오행: ${stemEl ?? "참고값 없음"}`]),
      ],
      observationQuestion: "오늘 감정 변화가 컸던 순간이 있었나요?",
    },
    {
      id: "energy",
      title: "활동 에너지",
      status: flow.energy,
      evidence: [`일간 오행 경향(${stemEl ?? "-"})`],
    },
    {
      id: "relation",
      title: "관계 흐름",
      status: flow.relation,
      evidence: relations[0]
        ? [relations[0].description]
        : [`지지 오행 경향(${branchEl ?? "-"})`],
    },
    {
      id: "focus",
      title: "집중도 / 휴식",
      status: flow.focus,
      evidence: ["오행 흐름을 생활 언어로 바꾼 참고 해석"],
    },
    {
      id: "condition",
      title: "생활 컨디션",
      status: flow.condition,
      evidence: [
        "의료적 건강 예측이 아닙니다.",
        "생활 리듬을 스스로 관찰하기 위한 참고 문장입니다.",
      ],
      observationQuestion: "오늘 몸과 마음의 피로도는 어땠나요?",
    },
  ];

  const record = buildRecordPatternInsight(entries, dayPillar.ganjiKo, todayDate);
  if (record) {
    cards.push({
      id: "record",
      title: "내 과거 기록 경향",
      status: record.summary,
      evidence: [
        `표본 ${record.sampleSize}회`,
        ...record.dates.map((d) => `기록일 ${d}`),
      ],
    });
  }

  const headline = changeRelation
    ? "오늘은 감정이나 일정의 변화가 평소보다 크게 느껴질 수 있어요. 중요한 반응은 잠시 생각해보세요."
    : `오늘은 ${dayPillar.ganjiKo} 흐름으로, ${flow.energy.replace("이에요", "인 날이에요").replace("있어요", "인 날이에요")}`;

  return {
    headline,
    cards,
    analysisKind: record ? "mixed" : "basic_saju",
    disclaimer:
      "사주와 오늘의 간지를 바탕으로 본 기본 흐름입니다. 미래의 사건이나 결과를 확정하지 않습니다.",
  };
}

export function buildExpertInsights(input: {
  dayPillar: DiaryDayPillar;
  sajuProfile?: SajuProfile | null;
  entries?: DiaryEntry[];
  todayDate?: string;
}): ExpertInsightSection[] {
  const { dayPillar, sajuProfile, entries = [], todayDate } = input;
  const sections: ExpertInsightSection[] = [];
  const natal = sajuProfile?.pillars.day;
  const relations = natal
    ? detectDayRelations({
        natalStemHanja: natal.stemHanja,
        natalBranchHanja: natal.branchHanja,
        todayStemHanja: dayPillar.stem.hanja,
        todayBranchHanja: dayPillar.branch.hanja,
      })
    : [];

  sections.push({
    id: "daily_relation",
    category: "daily_relation",
    title: "오늘의 명리 관계",
    summary: natal
      ? `원국 일주 ${natal.ganjiKo}와 오늘 일진 ${dayPillar.ganjiKo}의 관계를 참고합니다.`
      : `오늘 일진 ${dayPillar.ganjiKo} 정보입니다. 원국이 없으면 일진 단독으로 표시합니다.`,
    evidence: [
      `오늘 일진: ${dayPillar.ganji} (${dayPillar.ganjiKo})`,
      natal ? `원국 일주: ${natal.stemHanja}${natal.branchHanja} (${natal.ganjiKo})` : "원국 미등록",
      ...relations.map((r) => `${r.label}: ${r.description}`),
    ],
    recordBased: false,
    caution:
      "아래 내용은 현재 만세력 정보와 사용자의 과거 기록을 바탕으로 제공하는 참고 해석입니다. 미래의 사건이나 결과를 확정하지 않습니다.",
  });

  if (relations.length > 0) {
    sections.push({
      id: "interaction",
      category: "interaction",
      title: "합·충·형·파·해 보조 설명",
      summary: relations.map((r) => r.label).join(" · "),
      evidence: relations.map((r) => r.description),
      recordBased: false,
    });
  }

  if (natal) {
    const dayStem = natal.stemHanja as (typeof STEMS)[number];
    const todayStem = stemHanjaFromKo(dayPillar.stem.ko);
    if (todayStem) {
      const tenGod = getTenGod(dayStem, todayStem);
      sections.push({
        id: "ten_gods",
        category: "ten_gods",
        title: "십성 참고",
        summary: `내 일간 기준 오늘 천간은 ${tenGod}에 해당합니다.`,
        evidence: [
          `원국 일간 ${natal.stemKo}(${natal.stemHanja})`,
          `오늘 천간 ${dayPillar.stem.ko}(${dayPillar.stem.hanja})`,
          `십성: ${tenGod}`,
        ],
        recordBased: false,
      });
    }
  }

  const stemEl = STEM_META[dayPillar.stem.hanja as keyof typeof STEM_META]?.element;
  const branchEl = BRANCH_META[dayPillar.branch.hanja as keyof typeof BRANCH_META]?.element;
  sections.push({
    id: "five_elements",
    category: "five_elements",
    title: "오행 흐름 의견",
    summary: `오늘 천간 ${stemEl ?? "-"} / 지지 ${branchEl ?? "-"} 흐름을 생활 관찰 관점으로 참고하세요.`,
    evidence: [
      `천간 오행: ${stemEl ?? "없음"}`,
      `지지 오행: ${branchEl ?? "없음"}`,
      "기존 오행 분포 점수 모델을 변경하지 않은 별도 의견입니다.",
    ],
    recordBased: false,
  });

  const record = buildRecordPatternInsight(entries, dayPillar.ganjiKo, todayDate);
  if (record) {
    sections.push({
      id: "record_pattern",
      category: "record_pattern",
      title: "기록 기반 분석",
      summary: record.summary,
      evidence: [
        `표본 수: ${record.sampleSize}`,
        SAMPLE_LEVEL_LABELS[getSampleLevel(record.sampleSize)],
        ...record.dates.map((d) => `과거 기록 ${d}`),
      ],
      recordBased: true,
      sampleSize: record.sampleSize,
      caution: "표본이 적을수록 경향으로만 참고하세요.",
    });
  } else {
    sections.push({
      id: "record_pattern_empty",
      category: "record_pattern",
      title: "기록 기반 분석",
      summary: "아직 같은 일진 기록이 없어 기본 사주 분석을 중심으로 보여드려요.",
      evidence: ["기록할수록 내 실제 경험이 분석에 더 많이 반영돼요."],
      recordBased: true,
      sampleSize: 0,
    });
  }

  sections.push({
    id: "observation",
    category: "observation_question",
    title: "오늘 관찰해볼 질문",
    summary: "오늘 실제로 어땠는지 짧게 남겨두면 비슷한 날과 비교할 수 있어요.",
    evidence: [
      "감정 변화가 컸던 순간이 있었나요?",
      "관계에서 조율이 필요했던 장면이 있었나요?",
      "활동 에너지와 휴식의 균형은 어땠나요?",
    ],
    recordBased: false,
  });

  return sections;
}

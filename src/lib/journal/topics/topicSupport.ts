/**
 * 화제가 등장한 각 기록(횟수)의 상태값 평균 → 위로+조언 한 문장
 * (홈에는 수치를 노출하지 않고 supportLine만 씀)
 */
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import {
  CORE_STATE_CODES,
  DOMAIN_POOL_CODES,
} from "@/lib/journal/checkin/catalog";
import { dayHappiness } from "@/lib/journal/homeStats";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import type { WeekTopicHit } from "./weekTopics";

export type NamedScore = {
  code: CategoryCode;
  name: string;
  score: number;
};

export type TopicStateSnapshot = {
  /** 화제가 나온 각 날의 행복도 산술평균 */
  avgHappiness: number | null;
  /** 평균에 들어간 기록 횟수(=등장 일수) */
  sampleCount: number;
  coreGood: NamedScore | null;
  coreWatch: NamedScore | null;
  domainGood: NamedScore | null;
  domainWatch: NamedScore | null;
};

export type WeekTopicInsight = WeekTopicHit & {
  state: TopicStateSnapshot;
  /** 위로 + 앞길 조언, 수치 없이 한 문장 */
  supportLine: string;
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function scoreOnEntry(
  entry: JournalEntry,
  code: CategoryCode
): number | null {
  const s = entry.scores.find((x) => x.categoryCode === code);
  if (!s || s.isNotApplicable || s.finalScore == null) return null;
  return s.finalScore;
}

/**
 * 화제가 등장한 날마다 1회씩 모아, 그 횟수만큼의 점수를 산술평균.
 */
function averageAcrossOccurrences(
  dayEntries: JournalEntry[],
  codes: readonly CategoryCode[]
): { good: NamedScore | null; watch: NamedScore | null } {
  const rows: NamedScore[] = [];
  for (const code of codes) {
    const vals: number[] = [];
    for (const e of dayEntries) {
      const v = scoreOnEntry(e, code);
      if (v != null) vals.push(v);
    }
    const a = avg(vals);
    if (a == null) continue;
    rows.push({
      code,
      name: getCategoryByCode(code)?.name ?? code,
      score: a,
    });
  }
  if (rows.length === 0) return { good: null, watch: null };
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const good = sorted[0]!;
  const watch = sorted[sorted.length - 1]!;
  if (good.code === watch.code) return { good, watch: null };
  return { good, watch };
}

/** 화제 등장일 각각을 1회로 보고 상태 평균 */
export function snapshotTopicState(
  topic: WeekTopicHit,
  entries: JournalEntry[]
): TopicStateSnapshot {
  const dateSet = new Set(topic.dates);
  const onTopic = entries.filter((e) => dateSet.has(e.entryDate));
  const byDate = new Map<string, JournalEntry>();
  for (const e of onTopic) {
    const prev = byDate.get(e.entryDate);
    if (!prev || e.updatedAt >= prev.updatedAt) byDate.set(e.entryDate, e);
  }
  // 등장 일수(=횟수)만큼의 기록
  const dayEntries = topic.dates
    .map((d) => byDate.get(d))
    .filter((e): e is JournalEntry => Boolean(e));

  const happinessVals = dayEntries
    .map((e) => dayHappiness(e))
    .filter((v): v is number => v != null);

  const core = averageAcrossOccurrences(dayEntries, CORE_STATE_CODES);
  const domain = averageAcrossOccurrences(dayEntries, DOMAIN_POOL_CODES);

  return {
    avgHappiness: avg(happinessVals),
    sampleCount: dayEntries.length,
    coreGood: core.good,
    coreWatch: core.watch,
    domainGood: domain.good,
    domainWatch: domain.watch,
  };
}

function happinessTone(h: number | null): "high" | "mid" | "low" | "none" {
  if (h == null) return "none";
  if (h >= 6.5) return "high";
  if (h >= 4.5) return "mid";
  return "low";
}

/** 화제별: 위로 조각 / 앞길 조언 조각 */
const TOPIC_LINES: Record<
  string,
  {
    comfort: { low: string; mid: string; high: string };
    advice: { low: string; mid: string; high: string };
  }
> = {
  boss_relation: {
    comfort: {
      low: "상사와의 사이에서 마음이 자주 무거웠던 주였어요",
      mid: "상사와의 관계가 이번 주 마음에 계속 남았어요",
      high: "상사와의 사이에서도 스스로를 지키며 지나온 주였어요",
    },
    advice: {
      low: "내일은 눈치를 한 칸만 내려놓고 나를 위한 경계를 짧게 세워 보세요",
      mid: "다음엔 말하기 전에 숨 한 번만 고른 뒤 응해 보세요",
      high: "그 리듬을 유지하되, 무리한 맞장구는 조금만 줄여 보세요",
    },
  },
  coworker: {
    comfort: {
      low: "동료와의 호흡에서 피로가 쌓인 주였어요",
      mid: "동료와의 관계가 이번 주 이야기의 중심이었어요",
      high: "동료와의 연결이 비교적 든든했던 주였어요",
    },
    advice: {
      low: "다음은 부탁과 거절의 선을 한 문장으로만 분명히 해 보세요",
      mid: "필요한 말만 짧게 전하는 연습을 한 번 해보세요",
      high: "좋은 호흡은 지키되, 혼자 다 안지 않도록 나눠 보세요",
    },
  },
  partner: {
    comfort: {
      low: "가까운 사람과의 마음이 흔들렸던 주였어요",
      mid: "연인·파트너와의 결이 일기 속에 자주 남았어요",
      high: "가까운 사람과의 온기가 이번 주를 밝혀 준 편이었어요",
    },
    advice: {
      low: "오늘은 상대보다 먼저 내 기분을 한 줄로만 적어 두세요",
      mid: "다음 대화에선 감정 이름 하나만 붙여 말해 보세요",
      high: "그 온기를 짧게라도 감사로 남겨 두면 좋아요이 길어져요",
    },
  },
  family: {
    comfort: {
      low: "가족 사이에서 마음이 답답했던 순간이 많았어요",
      mid: "가족 이야기가 이번 주를 자주 채웠어요",
      high: "가족과 나 사이에서 온기를 찾은 주였어요",
    },
    advice: {
      low: "다음엔 거리를 존중하는 짧은 한 문장만 준비해 두세요",
      mid: "오늘은 가족보다 나를 위한 시간을 짧게라도 남겨 보세요",
      high: "좋은 결은 유지하되, 과한 책임은 내려놓아도 돼요",
    },
  },
  friend: {
    comfort: {
      low: "친구와의 사이에서 외로움이 스며든 주였어요",
      mid: "친구 이야기가 이번 주 마음에 자주 닿았어요",
      high: "우정이 이번 주를 부드럽게 받쳐 준 편이었어요",
    },
    advice: {
      low: "먼저 안부를 묻기보다, 내가 편한 방식으로 연결을 이어 보세요",
      mid: "다음엔 짧은 만남이나 메시지로 부담을 낮춰 보세요",
      high: "그 연결을 가볍게 유지하는 쪽을 선택해 보세요",
    },
  },
  work_pressure: {
    comfort: {
      low: "일과 부담이 어깨를 눌렀던 주였어요",
      mid: "업무 리듬이 이번 주 이야기의 중심이었어요",
      high: "바쁜 속에서도 버텨 낸 하루들이 쌓인 주였어요",
    },
    advice: {
      low: "내일 할 일 목록에서 하나만 남기고 나머지는 미뤄도 돼요",
      mid: "다음엔 끝낼 일 하나를 짧게 표시해 두고 시작하세요",
      high: "성과는 지키되, 휴식 칸을 일정에 먼저 적어 두세요",
    },
  },
  money: {
    comfort: {
      low: "돈·생활비 걱정이 마음을 조이던 주였어요",
      mid: "돈의 흐름이 이번 주 화제로 자주 올라왔어요",
      high: "자원을 의식하며 하루를 조율한 주였어요",
    },
    advice: {
      low: "오늘은 큰 계획 대신 지출 한 줄만 정리해 보세요",
      mid: "다음엔 쓸 것과 아낄 것을 딱 두 칸으로만 나눠 보세요",
      high: "좋은 흐름은 유지하고, 충동 지출만 한 번 멈춰 보세요",
    },
  },
  health: {
    comfort: {
      low: "몸과 컨디션이 힘들었던 흔적이 남은 주였어요",
      mid: "몸의 신호가 이번 주 이야기의 중심이었어요",
      high: "몸의 리듬을 살피며 지나온 주였어요",
    },
    advice: {
      low: "내일은 회복을 위한 작은 휴식부터 일정에 넣어 보세요",
      mid: "다음엔 수면이나 움직임 중 하나만 부드럽게 챙겨 보세요",
      high: "컨디션이 좋을 때도 무리한 확장은 반 박자 늦춰 보세요",
    },
  },
  rest: {
    comfort: {
      low: "쉬고 싶었지만 여유가 부족했던 주였어요",
      mid: "휴식과 여유를 찾는 말이 자주 남았어요",
      high: "스스로에게 쉼을 허락한 주였어요",
    },
    advice: {
      low: "오늘은 완벽히 쉬지 못해도, 십 분의 멈춤만 가져가 보세요",
      mid: "다음엔 쉬는 시간을 약속처럼 짧게 막아 두세요",
      high: "그 여유를 작은 루틴으로 이어가 보세요",
    },
  },
  self: {
    comfort: {
      low: "나 자신의 마음이 많이 흔들렸던 주였어요",
      mid: "내면의 이야기가 이번 주 화제의 중심이었어요",
      high: "스스로를 들여다본 용기가 남은 주였어요",
    },
    advice: {
      low: "오늘은 자책 대신, 괜찮다고 한 번만 말해 주세요",
      mid: "다음엔 감정을 이름 붙여 한 줄로만 적어 보세요",
      high: "그 알아차림을 유지하며 작은 돌봄을 이어가 보세요",
    },
  },
  decision: {
    comfort: {
      low: "선택 앞에서 마음이 무거웠던 주였어요",
      mid: "고민과 결정이 이번 주를 이끌었어요",
      high: "서두르지 않고 머무른 용기가 보인 주였어요",
    },
    advice: {
      low: "내일은 결정을 미뤄도 되고, 선택지 하나만 적어 두세요",
      mid: "다음엔 장단을 세 줄 이내로만 정리해 보세요",
      high: "좋은 속도로 가되, 최종 확정은 하루만 더 두어도 돼요",
    },
  },
  study: {
    comfort: {
      low: "공부·성장 압박이 느껴진 주였어요",
      mid: "배우고 성장하려는 말이 자주 남았어요",
      high: "배우는 길 위에서 스스로를 밀어 올린 주였어요",
    },
    advice: {
      low: "내일은 분량보다 집중 이십 분만 목표로 잡아 보세요",
      mid: "다음엔 끝낼 단원 하나만 표시해 두고 시작하세요",
      high: "페이스는 지키되, 쉬는 칸도 함께 남겨 두세요",
    },
  },
};

function defaultLines(label: string) {
  return {
    comfort: {
      low: `「${label}」이(가) 마음에 무겁게 남았던 주였어요`,
      mid: `「${label}」이(가) 이번 주 이야기의 중심이었어요`,
      high: `「${label}」을(를) 비교적 잘 다뤄 온 주였어요`,
    },
    advice: {
      low: "오늘은 그 무게를 인정한 뒤, 작은 한 걸음만 골라 보세요",
      mid: "다음엔 같은 주제를 조금 더 부드럽게 다루어 보세요",
      high: "그 리듬을 유지하며 무리만 조금 덜어 보세요",
    },
  };
}

/**
 * 등장 횟수 평균 상태를 반영하되, 수치는 넣지 않는 위로+조언 한 문장
 */
export function buildTopicSupportLine(
  topic: WeekTopicHit,
  state: TopicStateSnapshot
): string {
  const pack = TOPIC_LINES[topic.topicId] ?? defaultLines(topic.label);
  const tone = happinessTone(state.avgHappiness);
  const key = tone === "none" ? "mid" : tone;

  // 특히 낮은 핵심/선택이 있으면 조언 톤만 soft(low) 쪽으로
  const watchLow =
    (state.coreWatch && state.coreWatch.score <= 4.5) ||
    (state.domainWatch && state.domainWatch.score <= 4.5);
  const adviceKey = watchLow && key === "high" ? "mid" : watchLow ? "low" : key;

  return `${pack.comfort[key]}, ${pack.advice[adviceKey]}`;
}

export function enrichTopicsWithSupport(
  topics: WeekTopicHit[],
  entries: JournalEntry[]
): WeekTopicInsight[] {
  return topics.map((t) => {
    const state = snapshotTopicState(t, entries);
    return {
      ...t,
      state,
      supportLine: buildTopicSupportLine(t, state),
    };
  });
}

export type TopicDiaryExcerpt = {
  date: string;
  text: string;
};

export type WeekTopicSupportItem = {
  topicId: string;
  label: string;
  dayCount: number;
  /** 등장한 각 날의 일기 본문(횟수만큼) */
  excerpts: TopicDiaryExcerpt[];
  /** 템플릿 폴백 */
  fallbackLine: string;
};

const EXCERPT_MAX = 420;

function clipText(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** 화제가 나온 날마다 일기 본문 1건씩 수집 (1~7일 전 구간, 등장한 날 전부) */
export function collectTopicExcerpts(
  topic: WeekTopicHit,
  entries: JournalEntry[]
): TopicDiaryExcerpt[] {
  const byDate = new Map<string, JournalEntry>();
  for (const e of entries) {
    if (!topic.dates.includes(e.entryDate)) continue;
    const prev = byDate.get(e.entryDate);
    if (!prev || e.updatedAt >= prev.updatedAt) byDate.set(e.entryDate, e);
  }
  return topic.dates
    .map((date) => {
      const e = byDate.get(date);
      if (!e) return null;
      const raw = [e.content, e.mainEventText ?? ""].filter(Boolean).join("\n");
      const text = clipText(raw, EXCERPT_MAX);
      if (!text) return null;
      return { date, text };
    })
    .filter((x): x is TopicDiaryExcerpt => Boolean(x));
}

/** LLM 요청용 페이로드 — 홈 상위 화제 각각에 등장 횟수만큼의 글 */
export function buildWeekTopicSupportItems(
  topics: WeekTopicHit[],
  entries: JournalEntry[]
): WeekTopicSupportItem[] {
  return topics.map((t) => {
    const state = t.state ?? snapshotTopicState(t, entries);
    return {
      topicId: t.topicId,
      label: t.label,
      dayCount: t.dayCount,
      excerpts: collectTopicExcerpts(t, entries),
      fallbackLine: t.supportLine ?? buildTopicSupportLine(t, state),
    };
  });
}

export function weekTopicSupportFingerprint(
  items: WeekTopicSupportItem[]
): string {
  return items
    .map((it) => {
      const body = it.excerpts
        .map((x) => `${x.date}:${x.text.slice(0, 48)}`)
        .join(";");
      return `${it.topicId}|${it.dayCount}|${body}`;
    })
    .join("||");
}

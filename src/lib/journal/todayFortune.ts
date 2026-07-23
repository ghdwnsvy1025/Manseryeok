/**
 * C-3 오늘의 운세 — B 기반 5영역 × 2줄
 */
import OpenAI from "openai";
import type { BTheme } from "./bTheme";
import type { OpenAiCallStatus } from "./openaiStatus";

export type FortuneSection = {
  id: "personality" | "work" | "love" | "health" | "social";
  title: string;
  lines: [string, string];
};

export type TodayFortuneResult = {
  sections: FortuneSection[];
  openAi: OpenAiCallStatus;
};

const TITLES: Record<FortuneSection["id"], string> = {
  personality: "종합 성격",
  work: "직장",
  love: "연애",
  health: "건강",
  social: "대인관계",
};

export function buildFortuneTemplate(b: BTheme): FortuneSection[] {
  const kw = b.keywords.slice(0, 2).join("·") || "균형";
  return [
    {
      id: "personality",
      title: TITLES.personality,
      lines: [
        `오늘은 ${kw} 기운이 성향의 중심에 가깝습니다.`,
        b.plainSummary,
      ],
    },
    {
      id: "work",
      title: TITLES.work,
      lines: [
        "일의 속도를 한 칸만 조절해도 집중이 살아날 수 있어요.",
        "완벽한 결과보다 오늘의 한 걸음 마무리를 우선해보세요.",
      ],
    },
    {
      id: "love",
      title: TITLES.love,
      lines: [
        "마음 거리 조절이 관계의 핵심 키워드입니다.",
        "표현은 짧게, 진심은 분명하게 전해보세요.",
      ],
    },
    {
      id: "health",
      title: TITLES.health,
      lines: [
        "에너지와 회복의 균형을 먼저 살피세요.",
        "무리한 추진보다 호흡과 휴식이 도움이 됩니다.",
      ],
    },
    {
      id: "social",
      title: TITLES.social,
      lines: [
        "사람 사이에서는 비교보다 내 리듬이 중요합니다.",
        `${kw}가 느껴질 때 한 박자 쉬어가도 괜찮아요.`,
      ],
    },
  ];
}

function parseSections(raw: unknown, fallback: FortuneSection[]): FortuneSection[] {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  const arr = Array.isArray(obj.sections) ? obj.sections : null;
  if (!arr) return fallback;

  const out: FortuneSection[] = [];
  for (const id of Object.keys(TITLES) as FortuneSection["id"][]) {
    const found = arr.find(
      (s) => s && typeof s === "object" && (s as { id?: string }).id === id
    ) as { lines?: unknown } | undefined;
    const fb = fallback.find((f) => f.id === id)!;
    const lines = Array.isArray(found?.lines)
      ? found!.lines.filter((l): l is string => typeof l === "string").slice(0, 2)
      : [];
    out.push({
      id,
      title: TITLES[id],
      lines: [lines[0] ?? fb.lines[0], lines[1] ?? fb.lines[1]],
    });
  }
  return out.length === 5 ? out : fallback;
}

export async function generateTodayFortune(b: BTheme): Promise<TodayFortuneResult> {
  const fallback = buildFortuneTemplate(b);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      sections: fallback,
      openAi: { kind: "skipped", detail: "no_api_key" },
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 사주 일기 앱의 '오늘의 운세' 작성자입니다.
규칙:
- 영역 5개: personality, work, love, health, social
- 각 영역 한국어 문장 정확히 2줄
- 미래 확정·사고 예고·의료 진단·비난 금지
- 건강은 에너지·피로·회복으로만
- JSON: { "sections": [ { "id": "...", "lines": ["...", "..."] } ] }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            bTheme: b,
            requiredIds: Object.keys(TITLES),
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return {
        sections: fallback,
        openAi: { kind: "failed", reason: "missing_required" },
      };
    }
    const parsed = JSON.parse(raw);
    return {
      sections: parseSections(parsed, fallback),
      openAi: { kind: "used" },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      sections: fallback,
      openAi: { kind: "failed", reason: "request_failed", detail: msg },
    };
  }
}

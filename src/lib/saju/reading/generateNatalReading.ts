/**
 * 원국 종합풀이 생성 — 고정 digest + RAG 보조
 */
import OpenAI from "openai";
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";
import {
  loadTheoryContext,
  theoryUsageRules,
  type TheoryEvidence,
} from "@/lib/journal/theoryContext";
import {
  FORTUNE_THEORY_DIGEST,
  FORTUNE_THEORY_DIGEST_VERSION,
  fortuneTheoryDigestAvailable,
} from "@/lib/journal/fortune/theoryDigest";
import type { BTheme } from "@/lib/journal/bTheme";
import type { NatalReadingMaterials } from "./natalMaterials";
import {
  NATAL_READING_PROMPT_VERSION,
  NATAL_READING_SYSTEM_PROMPT,
} from "./natalReadingPrompt";
import type {
  NatalReadingResult,
  NatalReadingSection,
} from "./natalReadingTypes";

export type { NatalReadingResult, NatalReadingSection } from "./natalReadingTypes";

function section(
  title: string,
  body: string,
  fallbackTitle: string,
  fallbackBody: string
): NatalReadingSection {
  return {
    title: title.trim() || fallbackTitle,
    body: body.trim() || fallbackBody,
  };
}

function buildFallback(materials: NatalReadingMaterials): NatalReadingResult {
  const dm = `${materials.dayMaster.ko}(${materials.dayMaster.hanja})`;
  const current = materials.daeun.current;
  return {
    version: "natal-v1",
    promptVersion: NATAL_READING_PROMPT_VERSION,
    headline: `${dm} 일간의 원국 구조`,
    overview: {
      oneLiner: `${dm}을 중심으로 한 원국입니다.`,
      longForm:
        "상세 해석을 준비하지 못했어요. 만세력 차트를 먼저 보시고, 잠시 후 다시 시도해 주세요.",
    },
    dayMaster: {
      title: "일간·일주",
      body: `일간은 ${dm}입니다. 일주 ${materials.pillars.day.ganjiKo}를 중심으로 읽습니다.`,
    },
    pillars: {
      year: {
        title: "연주",
        body: `${materials.pillars.year.ganjiKo} — 배경·초년 환경의 재료입니다.`,
      },
      month: {
        title: "월주",
        body: `${materials.pillars.month.ganjiKo} — 사회성·성장 계절의 재료입니다.`,
      },
      day: {
        title: "일주",
        body: `${materials.pillars.day.ganjiKo} — 나와 생활 방식의 중심입니다.`,
      },
      hour: materials.pillars.hour
        ? {
            title: "시주",
            body: `${materials.pillars.hour.ganjiKo} — 표현·결과 쪽 재료입니다.`,
          }
        : {
            title: "시주",
            body: "출생 시각이 없어 시주 해석은 생략합니다.",
          },
    },
    domains: {
      personality: {
        title: "성격·기질",
        body: "해석 생성 전 미리보기입니다.",
      },
      work: { title: "일·커리어", body: "해석 생성 전 미리보기입니다." },
      relationships: {
        title: "대인관계",
        body: "해석 생성 전 미리보기입니다.",
      },
      love: { title: "연애·친밀", body: "해석 생성 전 미리보기입니다." },
      money: { title: "재물", body: "해석 생성 전 미리보기입니다." },
      health: {
        title: "건강·에너지",
        body: "해석 생성 전 미리보기입니다.",
      },
    },
    daeun: {
      title: "대운",
      narrative: current
        ? `현재 대운은 ${current.ganjiKo} 구간입니다.`
        : "현재 대운 구간을 특정하지 못했어요.",
      chapters: materials.daeun.cycles.slice(0, 4).map((c) => ({
        label: c.isCurrent ? `현재 · ${c.ganjiKo}` : c.ganjiKo,
        body: `${c.ganjiKo} 대운 재료`,
      })),
    },
    growthFormula: [
      "원국을 중심에 두고 읽기",
      "대운은 배경으로 보기",
      "경향으로만 활용하기",
    ],
    summary: "잠시 후 다시 불러오면 상세 종합풀이를 볼 수 있어요.",
    openAi: { kind: "skipped", detail: "fallback" },
    theoryUsed: fortuneTheoryDigestAvailable(),
    theoryEvidence: [],
    digestVersion: FORTUNE_THEORY_DIGEST_VERSION,
  };
}

function asObj(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

function pickSection(
  raw: unknown,
  fallbackTitle: string,
  fallbackBody: string
): NatalReadingSection {
  const o = asObj(raw);
  return section(
    typeof o?.title === "string" ? o.title : "",
    typeof o?.body === "string" ? o.body : "",
    fallbackTitle,
    fallbackBody
  );
}

function parseReading(
  raw: unknown,
  fallback: NatalReadingResult
): Omit<
  NatalReadingResult,
  "openAi" | "theoryUsed" | "theoryEvidence" | "digestVersion" | "promptVersion" | "version"
> {
  const root = asObj(raw);
  if (!root) {
    const { openAi: _a, theoryUsed: _b, theoryEvidence: _c, digestVersion: _d, promptVersion: _e, version: _f, ...rest } = fallback;
    return rest;
  }

  const overview = asObj(root.overview);
  const pillars = asObj(root.pillars);
  const domains = asObj(root.domains);
  const daeun = asObj(root.daeun);
  const chaptersRaw = Array.isArray(daeun?.chapters) ? daeun!.chapters : [];

  return {
    headline:
      typeof root.headline === "string" && root.headline.trim()
        ? root.headline.trim()
        : fallback.headline,
    overview: {
      oneLiner:
        typeof overview?.oneLiner === "string" && overview.oneLiner.trim()
          ? overview.oneLiner.trim()
          : fallback.overview.oneLiner,
      longForm:
        typeof overview?.longForm === "string" && overview.longForm.trim()
          ? overview.longForm.trim()
          : fallback.overview.longForm,
    },
    dayMaster: pickSection(
      root.dayMaster,
      fallback.dayMaster.title,
      fallback.dayMaster.body
    ),
    pillars: {
      year: pickSection(pillars?.year, "연주", fallback.pillars.year.body),
      month: pickSection(pillars?.month, "월주", fallback.pillars.month.body),
      day: pickSection(pillars?.day, "일주", fallback.pillars.day.body),
      hour: pickSection(pillars?.hour, "시주", fallback.pillars.hour.body),
    },
    domains: {
      personality: pickSection(
        domains?.personality,
        "성격·기질",
        fallback.domains.personality.body
      ),
      work: pickSection(domains?.work, "일·커리어", fallback.domains.work.body),
      relationships: pickSection(
        domains?.relationships,
        "대인관계",
        fallback.domains.relationships.body
      ),
      love: pickSection(domains?.love, "연애·친밀", fallback.domains.love.body),
      money: pickSection(domains?.money, "재물", fallback.domains.money.body),
      health: pickSection(
        domains?.health,
        "건강·에너지",
        fallback.domains.health.body
      ),
    },
    daeun: {
      title:
        typeof daeun?.title === "string" && daeun.title.trim()
          ? daeun.title.trim()
          : fallback.daeun.title,
      narrative:
        typeof daeun?.narrative === "string" && daeun.narrative.trim()
          ? daeun.narrative.trim()
          : fallback.daeun.narrative,
      chapters:
        chaptersRaw.length > 0
          ? chaptersRaw
              .filter((c) => c && typeof c === "object")
              .map((c) => {
                const o = c as Record<string, unknown>;
                return {
                  label:
                    typeof o.label === "string" ? o.label : "대운",
                  body: typeof o.body === "string" ? o.body : "",
                };
              })
              .filter((c) => c.body)
              .slice(0, 6)
          : fallback.daeun.chapters,
    },
    growthFormula: Array.isArray(root.growthFormula)
      ? root.growthFormula
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, 8)
      : fallback.growthFormula,
    summary:
      typeof root.summary === "string" && root.summary.trim()
        ? root.summary.trim()
        : fallback.summary,
  };
}

function natalBTheme(materials: NatalReadingMaterials): BTheme {
  const tenGod =
    materials.daeun.current?.stemTenGod ??
    materials.pillars.day.stemTenGod ??
    null;
  return {
    tenGod,
    keywords: [
      materials.dayMaster.ko,
      materials.pillars.day.ganjiKo,
      materials.daeun.current?.ganjiKo ?? "",
      "원국",
      "대운",
      "성격",
      "적성",
    ].filter(Boolean),
    focusCategoryHints: [],
    plainSummary: `${materials.dayMaster.ko} 일간 ${materials.pillars.day.ganjiKo} 원국 종합 해석`,
  };
}

export async function generateNatalReading(
  materials: NatalReadingMaterials,
  opts?: { skipLlm?: boolean }
): Promise<NatalReadingResult> {
  const fallback = buildFallback(materials);
  const digestOn = fortuneTheoryDigestAvailable();

  if (opts?.skipLlm) {
    return {
      ...fallback,
      openAi: { kind: "skipped", detail: "skip_llm" },
      theoryUsed: digestOn,
    };
  }

  const b = natalBTheme(materials);
  const theory = await loadTheoryContext({
    b,
    ganjiKo: materials.pillars.day.ganjiKo,
    purpose: "fortune",
    matchCount: 8,
    extraHints: [
      materials.dayMaster.ko,
      materials.daeun.current?.ganjiKo ?? "",
      materials.daeun.current?.stemTenGod ?? "",
      "원국 종합 대운 성격 적성",
    ],
  });

  const theoryEvidence: TheoryEvidence[] = [
    ...(digestOn
      ? [
          {
            content: `[고정이론 ${FORTUNE_THEORY_DIGEST_VERSION}] ${FORTUNE_THEORY_DIGEST.slice(0, 240)}…`,
            similarity: 1,
            chunkIndex: -1,
          },
        ]
      : []),
    ...theory.evidence,
  ];
  const theoryUsed = digestOn || theory.used;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ...fallback,
      openAi: { kind: "skipped", detail: "no_api_key" },
      theoryUsed,
      theoryEvidence,
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.65,
      max_tokens: 5500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${NATAL_READING_SYSTEM_PROMPT}\n${theoryUsageRules("fortune")}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            mode: "natal_comprehensive_reading",
            fixedTheoryDigest: digestOn ? FORTUNE_THEORY_DIGEST : null,
            fixedTheoryDigestVersion: FORTUNE_THEORY_DIGEST_VERSION,
            theoryAssistChunks: theory.chunks,
            natalMaterials: materials,
            instruction:
              "채팅 종합풀이처럼 길게, 여러 방면으로 서술하세요. 원국이 본체, 대운은 챕터, 일기는 없습니다.",
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return {
        ...fallback,
        openAi: { kind: "failed", reason: "missing_required" },
        theoryUsed,
        theoryEvidence,
      };
    }

    const parsed = parseReading(JSON.parse(raw), fallback);
    return {
      version: "natal-v1",
      promptVersion: NATAL_READING_PROMPT_VERSION,
      ...parsed,
      openAi: { kind: "used" },
      theoryUsed,
      theoryEvidence,
      digestVersion: FORTUNE_THEORY_DIGEST_VERSION,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ...fallback,
      openAi: { kind: "failed", reason: "request_failed", detail: msg },
      theoryUsed,
      theoryEvidence,
    };
  }
}

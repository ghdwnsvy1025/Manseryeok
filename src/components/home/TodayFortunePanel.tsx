"use client";

import { useEffect, useRef, useState } from "react";
import {
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import type { FortuneSection } from "@/lib/journal/todayFortune";
import type {
  FortuneDomainCode,
  FortuneDomainResult,
  FortunePresentationMeta,
} from "@/lib/journal/insight/types";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import {
  isDailyFortuneV2Enabled,
} from "@/lib/app/featureFlags";
import { trackContentExposure } from "@/lib/journal/exposure";
import ContentFeedbackButtons from "@/components/journal/ContentFeedbackButtons";
import OpenAiOriginHint from "@/components/journal/OpenAiOriginHint";
import type { FortuneEvidence } from "@/lib/journal/fortune/evidence";
import { sajuProfileFortuneFingerprint } from "@/lib/journal/fortune/profileFingerprint";
import type { SajuProfile } from "@/lib/diary/types";
import { isGuestMode } from "@/lib/auth/guestMode";
import EmotionalLoadingHint from "@/components/ui/EmotionalLoadingHint";
import CherryBlossomLayer from "@/components/motion/CherryBlossomLayer";

type Props = {
  todayDate: string;
  sajuProfile: unknown | null;
  entries?: JournalEntry[];
  enabledCodes?: CategoryCode[];
};

const EMPTY_ENTRIES: JournalEntry[] = [];
const EMPTY_CODES: CategoryCode[] = [];

/** 0~1 점수를 1.0~10.0 기운 점수로 (표시용) */
function fortuneScoreOutOf10(score: number | null | undefined): string | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  const n = Math.round(Math.max(0, Math.min(1, score)) * 100) / 10;
  return n.toFixed(1);
}

function FortuneLoadingHint() {
  return <EmotionalLoadingHint status="오늘의 결을 고르는 중…" />;
}

function FortuneScoreChip({ score }: { score: number | null | undefined }) {
  const label = fortuneScoreOutOf10(score);
  if (!label) return null;
  return (
    <span
      className="text-[14px] font-black tabular-nums px-2.5 py-1 border-2"
      style={{
        color: "var(--px-text-on-panel)",
        borderColor: "var(--px-border2)",
        background: "var(--px-bg3)",
      }}
      title="오늘 기운 (10점 만점, 참고용)"
    >
      {label}
      <span className="font-bold opacity-60 text-[12px]">/10</span>
    </span>
  );
}

/** 흐름 라벨 색 — 원활=초록, 안정=노랑, 혼합=파랑, 관리=주황 */
function flowTone(flow: string | null | undefined): {
  color: string;
  border: string;
  bg: string;
} {
  switch (flow) {
    case "원활":
      return {
        color: "#4ade80",
        border: "#4ade8077",
        bg: "color-mix(in srgb, #4ade80 14%, var(--px-bg3))",
      };
    case "안정":
      return {
        color: "#fbbf24",
        border: "#fbbf2477",
        bg: "color-mix(in srgb, #fbbf24 14%, var(--px-bg3))",
      };
    case "혼합":
      return {
        color: "#60a5fa",
        border: "#60a5fa77",
        bg: "color-mix(in srgb, #60a5fa 14%, var(--px-bg3))",
      };
    case "관리":
      return {
        color: "#fb923c",
        border: "#fb923c77",
        bg: "color-mix(in srgb, #fb923c 14%, var(--px-bg3))",
      };
    default:
      return {
        color: "var(--px-accent)",
        border: "var(--px-accent)",
        bg: "color-mix(in srgb, var(--px-accent) 12%, var(--px-bg3))",
      };
  }
}

function displayHeadline(headline: string): string | null {
  const h = headline.trim();
  if (!h) return null;
  const compact = h.replace(/\s/g, "");
  if (
    /^(종합|종합운|오늘의흐름을살펴보기|오늘의운세|핵심|요약)$/.test(compact)
  ) {
    return null;
  }
  return h;
}

function FortuneActionBoxes({
  action,
  caution,
}: {
  action: string;
  caution: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5" aria-label="오늘 행동">
      <div
        className="p-3.5 border-2"
        style={{
          borderColor: "var(--px-accent)",
          background:
            "color-mix(in srgb, var(--px-accent) 12%, var(--px-bg3))",
          boxShadow: "2px 2px 0 #000",
        }}
      >
        <p
          className="text-[12px] font-black mb-1.5 tracking-wide"
          style={{ color: "var(--px-accent)" }}
        >
          하기
        </p>
        <p
          className="text-[15px] font-bold leading-snug"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          {action}
        </p>
      </div>
      <div
        className="p-3.5 border-2"
        style={{
          borderColor: "var(--px-border2)",
          background: "var(--px-bg3)",
          boxShadow: "2px 2px 0 #000",
        }}
      >
        <p
          className="text-[12px] font-black mb-1.5 tracking-wide"
          style={{ color: "var(--px-text2)" }}
        >
          줄이기
        </p>
        <p
          className="text-[15px] font-medium leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          {caution}
        </p>
      </div>
    </div>
  );
}

/** 설렘 유도 CTA — 클릭 전에 "오늘 어떨까?" 호기심을 만든다 */
const FORTUNE_TEASE_LINES = [
  {
    title: "오늘, 어떤 하루가 올까요?",
    sub: "문을 살짝 열면 오늘의 결이 보여요",
  },
  {
    title: "두근두근, 오늘의 한 줄",
    sub: "당신만을 위한 흐름이 기다리고 있어요",
  },
  {
    title: "이 하루의 온도는 어떨까?",
    sub: "눌러서 오늘의 기운을 만나보세요",
  },
  {
    title: "준비된 오늘의 이야기",
    sub: "가벼운 마음으로 펼쳐볼까요?",
  },
] as const;

function FortuneTeaseButton({
  onClick,
  ready,
}: {
  onClick: () => void;
  /** 이미 생성된 운세가 있으면 true */
  ready?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % FORTUNE_TEASE_LINES.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, []);
  const line = FORTUNE_TEASE_LINES[idx]!;
  return (
    <button
      type="button"
      onClick={onClick}
      className="fortune-tease w-full py-5 px-3 flex flex-col items-center text-center gap-2"
      aria-label={ready ? "오늘의 운세 펼치기" : "오늘의 운세 보기"}
    >
      <span className="fortune-tease-pulse" aria-hidden />
      <p
        key={line.title}
        className="fortune-tease-title text-[1.05rem] font-black leading-snug tracking-tight"
        style={{ color: "var(--px-accent)" }}
      >
        {line.title}
      </p>
      <p
        key={line.sub}
        className="fortune-tease-sub text-[12px] font-medium leading-relaxed max-w-[18rem]"
        style={{ color: "var(--px-text2)" }}
      >
        {line.sub}
      </p>
      <span
        className="mt-1 text-[11px] font-black tracking-wide fortune-tease-hint"
        style={{ color: "var(--px-text-on-panel)" }}
      >
        {ready ? "살짝 펼쳐보기 ↓" : "두근거리는 하루 열기 ↓"}
      </span>
    </button>
  );
}

/** 요약·영역 공통 읽기 구조 — 등장 시 순차 연출 */
function FortuneReadingBlock({
  sectionLabel,
  flow,
  score,
  headline,
  body,
  action,
  caution,
  animateKey,
}: {
  sectionLabel: string;
  flow?: string | null;
  score?: number | null;
  headline?: string | null;
  body: string;
  action: string;
  caution: string;
  animateKey?: string;
}) {
  const tone = flowTone(flow);
  const lead = headline ? displayHeadline(headline) : null;
  return (
    <div
      className="space-y-3.5 fortune-reading"
      key={animateKey ?? sectionLabel}
    >
      <p
        className="text-[1.35rem] font-black leading-[1.3] tracking-tight text-center fortune-reveal-title"
        style={{ color: "var(--px-accent)", animationDelay: "80ms" }}
      >
        {sectionLabel}
      </p>

      <div
        className="flex items-center justify-center gap-2.5 flex-wrap fortune-reveal"
        style={{ animationDelay: "160ms" }}
      >
        {flow && (
          <span
            className="text-[14px] font-black px-2.5 py-1 border-2"
            style={{
              color: tone.color,
              borderColor: tone.border,
              background: tone.bg,
            }}
          >
            {flow}
          </span>
        )}
        <FortuneScoreChip score={score} />
      </div>

      {lead ? (
        <p
          className="text-[15px] font-bold leading-snug text-center fortune-reveal"
          style={{
            color: "var(--px-text-on-panel)",
            animationDelay: "240ms",
          }}
        >
          {lead}
        </p>
      ) : null}

      <FortuneBody text={body} reveal />

      <div className="fortune-reveal" style={{ animationDelay: "520ms" }}>
        <FortuneActionBoxes action={action} caution={caution} />
      </div>
    </div>
  );
}

/** 확신도를 숫자 대신 쉬운 말로 */
function confidencePlain(
  confidence: number | null | undefined,
  label?: string | null
): string {
  if (label === "높음" || label === "보통" || label === "낮음") {
    if (label === "높음") return "꽤 확실해요";
    if (label === "보통") return "참고해도 좋아요";
    return "참고용";
  }
  const c = confidence ?? 0;
  if (c >= 0.7) return "꽤 확실해요";
  if (c >= 0.45) return "참고해도 좋아요";
  return "참고용";
}

function domainBodyText(d: FortuneDomainResult): string {
  return d.interpretation || d.summary || "";
}

/** 긴 본문을 문장 단위로 나눠 읽기 리듬을 만든다 */
function splitFortuneSentences(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const byPeriod = t
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byPeriod.length >= 2) return byPeriod;
  const byKorean = t
    .split(/(?<=(?:다|요|죠|네|음))\s+(?=[가-힣A-Za-z0-9“"‘'])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return byKorean.length >= 2 ? byKorean : [t];
}

function FortuneBody({
  text,
  compact,
  reveal,
}: {
  text: string;
  compact?: boolean;
  reveal?: boolean;
}) {
  const parts = splitFortuneSentences(text);
  if (parts.length === 0) return null;
  return (
    <div className={`fortune-body ${compact ? "fortune-body--compact" : ""}`}>
      {parts.map((p, i) => (
        <p
          key={`${i}-${p.slice(0, 12)}`}
          className={reveal ? "fortune-reveal" : undefined}
          style={
            reveal
              ? { animationDelay: `${280 + Math.min(i, 5) * 90}ms` }
              : undefined
          }
        >
          {p}
        </p>
      ))}
    </div>
  );
}

const DOMAIN_TAB_ORDER = [
  "work",
  "relationships",
  "love",
  "money",
  "health",
] as const;

const DOMAIN_TAB_SHORT: Record<(typeof DOMAIN_TAB_ORDER)[number], string> = {
  work: "직장",
  relationships: "대인",
  love: "연애",
  money: "재물",
  health: "건강",
};

type V2Payload = {
  version?: string;
  overall?: FortuneDomainResult;
  domains?: FortuneDomainResult[];
  openAi?: OpenAiCallStatus;
  evidence?: FortuneEvidence | null;
  presentation?: FortunePresentationMeta;
  cached?: boolean;
  /** 접기/펼치기 유지 */
  panelOpen?: boolean;
  revealed?: boolean;
  insight?: {
    primaryKeyword?: string | null;
    tensionKeyword?: string | null;
    overallConfidence?: number;
  };
};

function fortuneLocalKey(date: string, profileCacheKey: string) {
  return `manseryeok:today-fortune-v2.5:${date}:${profileCacheKey}`;
}

/** 비로그인/구글을 나누고, 프로필 id 로딩 레이스에 안 깨지는 안정 키 */
function fortuneStableKey(
  date: string,
  workspace: "guest" | "account",
  fingerprint: string
) {
  return fortuneLocalKey(date, `${workspace}:${fingerprint || "none"}`);
}

function parseFortunePayload(raw: string | null): V2Payload | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as V2Payload;
    if (data.version !== "v2" || !data.overall) return null;
    return data;
  } catch {
    return null;
  }
}

/** 프로필 로드 전에도 당일 운세를 동기 복원 (첫 페인트 지연 제거) */
function peekFortuneForDate(date: string): V2Payload | null {
  if (typeof window === "undefined") return null;
  const workspace: "guest" | "account" = isGuestMode() ? "guest" : "account";
  const prefix = `manseryeok:today-fortune-v2.5:${date}:`;
  const preferred: string[] = [];
  const fallback: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      if (key.includes(`:${workspace}:`)) preferred.push(key);
      else fallback.push(key);
    }
  } catch {
    return null;
  }
  for (const key of [...preferred, ...fallback]) {
    const hit = parseFortunePayload(window.localStorage.getItem(key));
    if (hit) return hit;
  }
  return null;
}

function readLocalFortune(
  date: string,
  opts: {
    profileCacheKey: string;
    fingerprint: string;
    workspace: "guest" | "account";
  }
): V2Payload | null {
  if (typeof window === "undefined") return null;
  const { profileCacheKey, fingerprint, workspace } = opts;
  const fp = fingerprint || "none";
  const candidates = [
    fortuneStableKey(date, workspace, fp),
    fortuneLocalKey(date, profileCacheKey),
    fortuneLocalKey(date, `none:${fp}`),
    fortuneLocalKey(date, fp),
  ];
  for (const key of candidates) {
    try {
      const hit = parseFortunePayload(window.localStorage.getItem(key));
      if (hit) return hit;
    } catch {
      /* try next */
    }
  }
  // 프로필 id 만 바뀐 옛 키 · 워크스페이스 스캔
  const scanned = peekFortuneForDate(date);
  if (scanned) return scanned;
  try {
    const prefix = `manseryeok:today-fortune-v2.5:${date}:`;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      if (!key.endsWith(`:${fp}`) && !key.endsWith(`:${workspace}:${fp}`)) {
        continue;
      }
      const hit = parseFortunePayload(window.localStorage.getItem(key));
      if (hit) return hit;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeLocalFortune(
  date: string,
  opts: {
    profileCacheKey: string;
    fingerprint: string;
    workspace: "guest" | "account";
  },
  data: V2Payload,
  panelOpen = true
) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    version: "v2",
    overall: data.overall,
    domains: data.domains ?? [],
    presentation: data.presentation ?? null,
    evidence: data.evidence ?? null,
    cached: true,
    revealed: true,
    panelOpen,
  });
  const { profileCacheKey, fingerprint, workspace } = opts;
  const fp = fingerprint || "none";
  const keys = [
    fortuneStableKey(date, workspace, fp),
    fortuneLocalKey(date, profileCacheKey),
  ];
  for (const key of keys) {
    try {
      window.localStorage.setItem(key, payload);
    } catch {
      /* ignore quota */
    }
  }
}

/** 0~1 값을 가로 막대로 표시 */
function MeterBar({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className="h-1.5 w-full border"
      style={{ borderColor: "var(--px-border2)", background: "var(--px-bg3)" }}
    >
      <div
        className="h-full"
        style={{
          width: `${pct}%`,
          background: color ?? "var(--px-accent)",
        }}
      />
    </div>
  );
}

function WeightRow({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color?: string;
  hint: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[11px] font-black"
          style={{ color: "var(--px-text)" }}
        >
          {label}
        </span>
        <span
          className="text-[11px] font-black tabular-nums"
          style={{ color: "var(--px-accent)" }}
        >
          {pct}%
        </span>
      </div>
      <MeterBar value={value} color={color} />
      <p className="text-[10px] leading-tight" style={{ color: "var(--px-text2)" }}>
        {hint}
      </p>
    </div>
  );
}

function FortuneEvidencePanel({ evidence }: { evidence: FortuneEvidence }) {
  const maturityPct = Math.round(evidence.maturity * 100);
  return (
    <div
      className="mt-1 p-2.5 space-y-3 border"
      style={{ borderColor: "var(--px-border2)", background: "var(--px-bg3)" }}
    >
      <div
        className="p-2 border-2 flex items-center justify-center gap-1 text-center"
        style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}
      >
        <span className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          지금 운세 = 내 기록 반영{" "}
          {Math.round(
            evidence.weights.recent * 100 + evidence.weights.keyword * 100
          )}
          %
        </span>
        <span className="text-sm font-black" style={{ color: "var(--px-text2)" }}>
          + 사주 {Math.round(evidence.weights.natal * 100)}%
        </span>
      </div>
      <p className="text-[10px] leading-relaxed text-center" style={{ color: "var(--px-text2)" }}>
        {evidence.dayPhaseLabel} · 기록 {evidence.priorUniqueDays}일
        {evidence.journalShareCap < 1
          ? ` · 일수 상한 ${Math.round(evidence.journalShareCap * 100)}%`
          : ""}
      </p>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-black" style={{ color: "var(--px-text)" }}>
            운세 맞춤 · {evidence.tierLabel}
          </span>
          <span
            className="text-[11px] font-black tabular-nums"
            style={{ color: "var(--px-accent)" }}
          >
            {maturityPct}%
          </span>
        </div>
        <MeterBar value={evidence.maturity} />
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
          Lv{evidence.level} · XP {evidence.effectiveXp}
          {evidence.onboardingCompleted ? " (온보딩 보정 포함)" : ""}.{" "}
          {evidence.guideKo}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
          신호 혼합 비율
        </p>
        <WeightRow
          label="최근 상태(내 기록)"
          value={evidence.weights.recent}
          color="var(--px-accent)"
          hint="일기·체크인에서 뽑은 최근 카테고리 점수"
        />
        <WeightRow
          label="키워드 흐름"
          value={evidence.weights.keyword}
          color="var(--px-text)"
          hint="요즘 자주 올라오는 주제(현저성)"
        />
        <WeightRow
          label="사주×오늘 일진"
          value={evidence.weights.natal}
          color="var(--px-text2)"
          hint="원국 특징과 오늘 간지를 엮은 이론 신호"
        />
      </div>

      {evidence.natalDay && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
            원국 × 오늘 ({evidence.natalDay.ganjiKo})
          </p>
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text)" }}>
            {evidence.natalDay.overallTraitPlain}
          </p>
          {evidence.natalDay.domains.map((d) => (
            <div key={d.domain} className="space-y-0.5">
              <p className="text-[10px] font-black" style={{ color: "var(--px-text2)" }}>
                {d.domain} · {d.tensionKind}
                {d.keywordLabels.length > 0
                  ? ` · ${d.keywordLabels.join("·")}`
                  : ""}
              </p>
              <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
                {d.tensionPlain}
              </p>
            </div>
          ))}
        </div>
      )}

      {evidence.topKeywords.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
            지금 뜨는 키워드
          </p>
          <div className="space-y-1">
            {evidence.topKeywords.map((k) => (
              <div key={k.code} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold shrink-0 w-16 truncate"
                  style={{ color: "var(--px-text)" }}
                >
                  {k.plainLabel}
                </span>
                <div className="flex-1">
                  <MeterBar value={Math.min(1, k.score / 6)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
        {confidencePlain(evidence.overallConfidence)} · 표본이 적으면 해석이
        가운데(균형) 쪽으로 당겨집니다.
      </p>
    </div>
  );
}

export default function TodayFortunePanel({
  todayDate,
  sajuProfile,
  entries = EMPTY_ENTRIES,
  enabledCodes = EMPTY_CODES,
}: Props) {
  const v2 = isDailyFortuneV2Enabled();
  const cachedBoot =
    typeof window !== "undefined" && v2
      ? peekFortuneForDate(todayDate)
      : null;
  const [open, setOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() =>
    cachedBoot?.overall ? cachedBoot.panelOpen !== false : false
  );
  const [sections, setSections] = useState<FortuneSection[]>([]);
  const [overall, setOverall] = useState<FortuneDomainResult | null>(
    () => cachedBoot?.overall ?? null
  );
  const [domains, setDomains] = useState<FortuneDomainResult[]>(
    () => cachedBoot?.domains ?? []
  );
  const [presentation, setPresentation] =
    useState<FortunePresentationMeta | null>(
      () => cachedBoot?.presentation ?? null
    );
  const [openAi, setOpenAi] = useState<OpenAiCallStatus | null>(null);
  const [evidence, setEvidence] = useState<FortuneEvidence | null>(
    () => cachedBoot?.evidence ?? null
  );
  const [showEvidence, setShowEvidence] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(() => Boolean(cachedBoot?.overall));
  const [hydrating, setHydrating] = useState(
    () => v2 && !cachedBoot?.overall
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blossomToken, setBlossomToken] = useState(0);
  const profile = (sajuProfile ?? null) as SajuProfile | null;
  const profileId =
    profile && typeof profile === "object" && profile.id
      ? String(profile.id)
      : "none";
  const profileFp = sajuProfileFortuneFingerprint(profile);
  /** 생일·일주가 바뀌면 캐시 키도 바뀜 */
  const profileCacheKey = `${profileId}:${profileFp}`;
  const fortuneWorkspace: "guest" | "account" = isGuestMode()
    ? "guest"
    : "account";
  const cacheOpts = {
    profileCacheKey,
    fingerprint: profileFp,
    workspace: fortuneWorkspace,
  };

  const entriesRef = useRef(entries);
  const codesRef = useRef(enabledCodes);
  const profileRef = useRef(sajuProfile);
  const analyseGenRef = useRef(0);
  const panelOpenRef = useRef(panelOpen);
  entriesRef.current = entries;
  codesRef.current = enabledCodes;
  profileRef.current = sajuProfile;
  panelOpenRef.current = panelOpen;

  const persistFortune = (
    data: V2Payload,
    nextPanelOpen: boolean = panelOpenRef.current
  ) => {
    writeLocalFortune(todayDate, cacheOpts, data, nextPanelOpen);
  };

  const applyPayload = (
    data: V2Payload,
    opts?: { impress?: boolean; persistLocal?: boolean; openPanel?: boolean }
  ) => {
    if (data.version !== "v2" || !data.overall) return false;
    setOverall(data.overall);
    setDomains(data.domains ?? []);
    setPresentation(data.presentation ?? null);
    setOpenAi(data.openAi ?? null);
    setEvidence(data.evidence ?? null);
    setLoaded(true);
    setOpen(false);
    const nextOpen =
      typeof opts?.openPanel === "boolean"
        ? opts.openPanel
        : data.panelOpen !== false;
    setPanelOpen(nextOpen);
    panelOpenRef.current = nextOpen;
    if (opts?.persistLocal) {
      persistFortune(data, nextOpen);
    }
    if (opts?.impress) {
      void trackContentExposure({
        eventDate: todayDate,
        contentType: "daily_fortune",
        contentId: "overall",
        eventType: "fortune_summary_impression",
      });
    }
    return true;
  };

  /**
   * 날짜·사주 프로필이 바뀌면 당일 캐시 복원.
   * 펼침/접힘 상태까지 그대로 유지 (비로그인·구글).
   */
  useEffect(() => {
    if (!v2) return;
    const gen = ++analyseGenRef.current;
    setLoadError(null);

    const local = readLocalFortune(todayDate, cacheOpts);
    if (local?.overall) {
      applyPayload(local, {
        openPanel: local.panelOpen !== false,
        persistLocal: true,
      });
      setLoading(false);
      setHydrating(false);
      void (async () => {
        try {
          const res = await fetch("/api/journal/today-fortune", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              todayDate,
              sajuProfile: profileRef.current,
              entries: entriesRef.current.slice(-60),
              enabledCodes: codesRef.current,
              cacheOnly: true,
            }),
          });
          if (gen !== analyseGenRef.current || !res.ok) return;
          const data = (await res.json()) as V2Payload & { cached?: boolean };
          if (gen !== analyseGenRef.current) return;
          if (data.cached && data.overall) {
            applyPayload(
              { ...data, panelOpen: panelOpenRef.current },
              { persistLocal: true, openPanel: panelOpenRef.current }
            );
          }
        } catch {
          /* keep local */
        }
      })();
      return;
    }

    // 이미 첫 페인트에 캐시가 있으면 비우지 않음
    if (overall) {
      setHydrating(false);
      return;
    }

    setOverall(null);
    setDomains([]);
    setPresentation(null);
    setOpenAi(null);
    setEvidence(null);
    setShowEvidence(false);
    setLoaded(false);
    setLoading(false);
    setOpen(false);
    setPanelOpen(false);
    setHydrating(true);

    void (async () => {
      try {
        const res = await fetch("/api/journal/today-fortune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            todayDate,
            sajuProfile: profileRef.current,
            entries: entriesRef.current.slice(-60),
            enabledCodes: codesRef.current,
            cacheOnly: true,
          }),
        });
        if (gen !== analyseGenRef.current) return;
        if (!res.ok) {
          setHydrating(false);
          return;
        }
        const data = (await res.json()) as V2Payload & { error?: string };
        if (gen !== analyseGenRef.current) return;
        if (
          data.cached &&
          applyPayload(data, { persistLocal: true, openPanel: true })
        ) {
          setHydrating(false);
          return;
        }
      } catch {
        /* idle CTA */
      } finally {
        if (gen === analyseGenRef.current) setHydrating(false);
      }
    })();
    // cacheOpts fields listed explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v2, todayDate, profileCacheKey, profileFp, fortuneWorkspace]);

  const startAnalysis = () => {
    if (!v2 || loading || hydrating) return;

    // 당일 이미 본 운세 → 로딩 없이 즉시 펼침 (비로그인·구글 로컬 캐시)
    if (overall) {
      setPanelOpen(true);
      setLoadError(null);
      return;
    }
    const local = readLocalFortune(todayDate, cacheOpts);
    if (local?.overall) {
      applyPayload(local, { openPanel: true, persistLocal: true });
      setLoadError(null);
      return;
    }

    if (loaded) return;

    const gen = ++analyseGenRef.current;
    setLoadError(null);
    // overall을 미리 비우지 않음 — 로딩 중 깜빡임 방지 (없을 때만 로딩 UI)
    setLoading(true);
    setOpen(true);

    void (async () => {
      try {
        const { ANALYTICS_EVENTS, captureEvent } = await import(
          "@/lib/analytics/posthog"
        );
        captureEvent(ANALYTICS_EVENTS.fortuneOpened);
      } catch {
        /* analytics optional */
      }
      try {
        const res = await fetch("/api/journal/today-fortune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            todayDate,
            sajuProfile: profileRef.current,
            entries: entriesRef.current.slice(-60),
            enabledCodes: codesRef.current,
            skipLlm: false,
          }),
        });
        if (gen !== analyseGenRef.current) return;

        let data: V2Payload & { error?: string } = {};
        try {
          data = (await res.json()) as V2Payload & { error?: string };
        } catch {
          if (gen === analyseGenRef.current) {
            setLoadError(
              `운세 응답을 읽지 못했어요 (${res.status}). 잠시 후 다시 시도해주세요.`
            );
          }
          return;
        }
        if (gen !== analyseGenRef.current) return;
        if (
          !res.ok ||
          !applyPayload(data, {
            impress: true,
            persistLocal: true,
            openPanel: true,
          })
        ) {
          const authHint =
            res.status === 401 || data.error?.includes("로그인")
              ? " 잠시 후 다시 눌러주세요."
              : "";
          setLoadError(
            (data.error ||
              `오늘의 운세를 불러오지 못했어요 (${res.status}).`) + authHint
          );
          void import("@/lib/analytics/posthog").then(({ captureFlowError }) => {
            captureFlowError({
              step: "fortune_load",
              errorCode: res.status === 401 ? "AUTH_REQUIRED" : "REQUEST_FAILED",
              recoverable: true,
            });
          });
        } else if (gen === analyseGenRef.current) {
          setBlossomToken((n) => n + 1);
        }
      } catch (err) {
        if (gen === analyseGenRef.current) {
          const detail =
            err instanceof Error ? err.message : "알 수 없는 오류";
          setLoadError(
            detail.includes("fetch")
              ? "서버 연결이 끊겼어요. 개발 서버가 켜져 있는지 확인해주세요."
              : `운세를 불러오지 못했어요: ${detail}`
          );
          void import("@/lib/analytics/posthog").then(({ captureFlowError }) => {
            captureFlowError({
              step: "fortune_load",
              errorCode: "NETWORK",
              recoverable: true,
            });
          });
        }
      } finally {
        if (gen === analyseGenRef.current) setLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (v2 || !open || loaded) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/journal/today-fortune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ todayDate, sajuProfile }),
        });
        const data = (await res.json()) as {
          sections?: FortuneSection[];
          openAi?: OpenAiCallStatus;
        };
        if (cancelled) return;
        setSections(data.sections ?? []);
        setOpenAi(data.openAi ?? null);
        setLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setOpenAi({
            kind: "failed",
            reason: "network",
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [v2, open, loaded, todayDate, sajuProfile]);

  if (v2) {
    const idle = !hydrating && !loading && !loaded && !loadError && !overall;
    return (
      <section className="space-y-2" aria-label="오늘의 운세">
        <CherryBlossomLayer playToken={blossomToken} />
        <div className="ui-emphasize-head">
          <p className="ui-emphasize-title">오늘의 운세</p>
          {overall && (
            <button
              type="button"
              className="text-xs font-bold underline shrink-0"
              style={{ color: "var(--px-text2)" }}
              onClick={() => {
                const next = !panelOpen;
                setPanelOpen(next);
                panelOpenRef.current = next;
                if (overall) {
                  persistFortune(
                    {
                      version: "v2",
                      overall,
                      domains,
                      presentation: presentation ?? undefined,
                      evidence,
                    },
                    next
                  );
                }
                void import("@/lib/analytics/posthog").then(
                  ({ ANALYTICS_EVENTS, captureUiClick, captureEvent }) => {
                    if (next) {
                      captureUiClick(ANALYTICS_EVENTS.fortuneOpened, "fortune_open");
                    } else {
                      captureEvent(ANALYTICS_EVENTS.fortuneCollapsed);
                    }
                  }
                );
              }}
              aria-expanded={panelOpen}
            >
              {panelOpen ? "접기" : "펼치기"}
            </button>
          )}
        </div>

        <div
          className="p-3 border-2 space-y-2"
          style={{
            borderColor: "var(--px-border)",
            background: "var(--px-bg2)",
            boxShadow: "2px 2px 0 #000",
          }}
        >
          {hydrating && !overall && (
            <p
              className="text-[11px] font-bold text-center py-2"
              style={{ color: "var(--px-text2)" }}
            >
              오늘 운세를 확인하는 중…
            </p>
          )}

          {idle && (
            <FortuneTeaseButton onClick={startAnalysis} />
          )}

          {loading && !overall && <FortuneLoadingHint />}
          {loading && overall && (
            <p
              className="text-[11px] font-bold text-center"
              style={{ color: "var(--px-text2)" }}
            >
              문장을 다듬는 중…
            </p>
          )}

          {loadError && !overall && (
            <div className="space-y-3 py-2 text-center">
              <p
                className="text-xs font-bold leading-relaxed"
                style={{ color: "#f87171" }}
              >
                {loadError}
              </p>
              <button
                type="button"
                onClick={startAnalysis}
                className="text-xs font-black underline"
                style={{ color: "var(--px-accent)" }}
              >
                다시 시도
              </button>
            </div>
          )}

          {overall && !panelOpen && (
            <FortuneTeaseButton
              ready
              onClick={() => {
                startAnalysis();
                void trackContentExposure({
                  eventDate: todayDate,
                  contentType: "daily_fortune",
                  contentId: "detail",
                  eventType: "fortune_detail_opened",
                });
                void import("@/lib/analytics/posthog").then(
                  ({ ANALYTICS_EVENTS, captureUiClick }) => {
                    captureUiClick(ANALYTICS_EVENTS.fortuneOpened, "fortune_open");
                  }
                );
              }}
            />
          )}

          {overall && panelOpen && (
            <div className="fortune-readable space-y-4">
              <FortuneReadingBlock
                sectionLabel="오늘의 핵심"
                flow={overall.flow}
                score={overall.score}
                headline={overall.headline}
                body={domainBodyText(overall)}
                action={presentation?.todayFocus || overall.action}
                caution={presentation?.todayAvoid || overall.caution}
                animateKey="fortune-core"
              />

              {presentation?.signatureEcho && (
                <p
                  className="text-[13px] leading-relaxed pl-2.5"
                  style={{
                    color: "var(--px-accent)",
                    borderLeft: "2px solid var(--px-accent)",
                    opacity: 0.95,
                  }}
                >
                  {presentation.signatureEcho}
                </p>
              )}

              {/* 영역별 메뉴 — 당분간 잠금 (나중에 열 예정) */}
              <div
                className="pt-2 space-y-2 border-t"
                style={{ borderColor: "var(--px-border)" }}
                aria-label="영역별 운세 (잠금)"
              >
                <p
                  className="text-[11px] font-bold text-center"
                  style={{ color: "var(--px-text2)" }}
                >
                  영역별로 더 보기 · 곧 열려요
                </p>
                <div className="grid grid-cols-5 gap-1 opacity-55 pointer-events-none select-none">
                  {DOMAIN_TAB_ORDER.map((code) => (
                    <span
                      key={code}
                      className="relative py-2.5 text-[12px] font-black border-2 text-center"
                      style={{
                        color: "var(--px-text2)",
                        background: "var(--px-bg3)",
                        borderColor: "var(--px-border)",
                      }}
                    >
                      {DOMAIN_TAB_SHORT[code]}
                      <span
                        className="absolute -top-1 -right-1 text-[9px] leading-none px-1 border"
                        style={{
                          color: "var(--px-text2)",
                          background: "var(--px-bg2)",
                          borderColor: "var(--px-border)",
                        }}
                        aria-hidden
                      >
                        잠금
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="pt-1 border-t"
                style={{ borderColor: "var(--px-border)" }}
              >
                <ContentFeedbackButtons
                  eventDate={todayDate}
                  contentType="daily_fortune"
                  contentId="overall"
                  mode="match"
                  prompt="이 문장이 오늘과 맞았나요?"
                />
                {presentation?.notice && (
                  <p
                    className="mt-1 text-[11px] leading-relaxed"
                    style={{ color: "var(--px-text2)", opacity: 0.85 }}
                  >
                    {presentation.notice}
                  </p>
                )}
                <OpenAiOriginHint status={openAi} className="mt-1 text-[10px] leading-relaxed" />
              </div>

              {evidence && (
                <button
                  type="button"
                  className="block w-full text-center text-[11px] font-medium underline"
                  style={{ color: "var(--px-text2)", opacity: 0.8 }}
                  onClick={() => {
                    setShowEvidence(true);
                    void trackContentExposure({
                      eventDate: todayDate,
                      contentType: "daily_fortune",
                      contentId: "evidence",
                      eventType: "fortune_evidence_opened",
                    });
                  }}
                  aria-expanded={showEvidence}
                >
                  근거 보기
                </button>
              )}
            </div>
          )}
        </div>

        {showEvidence && evidence && (
          <div
            className="fixed inset-0 z-[88] flex items-end justify-center motion-modal-backdrop"
            style={{ background: "rgba(0,0,0,0.55)" }}
            role="dialog"
            aria-modal="true"
            aria-label="운세 근거"
            onClick={() => setShowEvidence(false)}
          >
            <div
              className="w-full max-w-md max-h-[75dvh] overflow-y-auto border-2 p-3 space-y-2 motion-bottom-sheet"
              style={{
                background: "var(--px-bg2)",
                borderColor: "var(--px-accent)",
                boxShadow: "0 -4px 0 #000",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-sm font-black"
                  style={{ color: "var(--px-accent)" }}
                >
                  근거 보기
                </p>
                <button
                  type="button"
                  className="text-xs font-bold"
                  style={{ color: "var(--px-text2)" }}
                  onClick={() => setShowEvidence(false)}
                >
                  닫기
                </button>
              </div>
              <FortuneEvidencePanel evidence={evidence} />
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-2" aria-label="오늘의 운세">
      <div className="ui-emphasize-head">
        <p className="ui-emphasize-title">오늘의 운세</p>
        <button
          type="button"
          className="text-xs font-bold underline shrink-0"
          style={{ color: "var(--px-text2)" }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "접기" : "펼치기"}
        </button>
      </div>
      <div className="motion-expand" data-open={open ? "true" : "false"}>
        <div className="motion-expand-inner">
          {open && (
            <div
              className="p-3 border-2 space-y-2"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg2)",
                boxShadow: "2px 2px 0 #000",
              }}
            >
              {loading && <FortuneLoadingHint />}
              {!loading &&
                sections.map((s) => (
                  <div key={s.id} className="space-y-0.5">
                    <p
                      className="text-[11px] font-black"
                      style={{ color: "var(--px-accent)" }}
                    >
                      {s.title}
                    </p>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--px-text)" }}
                    >
                      {s.lines[0]}
                    </p>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--px-text2)" }}
                    >
                      {s.lines[1]}
                    </p>
                  </div>
                ))}
              <OpenAiOriginHint status={openAi} className="text-[10px] pt-1 leading-relaxed" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PersonalizationLevelCard from "@/components/product/PersonalizationLevelCard";
import EmptyState from "@/components/product/EmptyState";
import DataCountBadge from "@/components/product/DataCountBadge";
import { getPatternInsightService } from "@/services/analysis";
import type { PatternSummaryResult } from "@/services/analysis";
import type { DiaryEntry, SajuProfile } from "@/lib/diary/types";
import { loadExperienceModeLocal } from "@/lib/app/experienceMode";
import {
  DEFAULT_EXPERIENCE_MODE,
  prefersPlainLanguage,
  type UserExperienceMode,
} from "@/lib/product/modes";
import {
  aggregateByBranch,
  aggregateByStem,
  aggregateByTenGod,
  type AbReactionStats,
} from "@/lib/diary/abStats";
import {
  MOCK_EFFECTIVE_ACTIONS,
  MOCK_HAPPINESS_CONDITIONS,
} from "@/mocks/users";
import { loadPrimarySajuProfile } from "@/lib/diary/profileStorage";

type PatternExtraTab =
  | "overview"
  | "stems"
  | "branches"
  | "tengods"
  | "conditions"
  | "actions";

type Props = {
  entries: DiaryEntry[];
  sajuProfile?: SajuProfile | null;
};

function ReactionCard({
  stats,
  plain,
}: {
  stats: AbReactionStats;
  plain: boolean;
}) {
  return (
    <div
      className="p-2 border-2 space-y-1"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
    >
      <p className="text-xs font-black" style={{ color: "var(--px-accent)" }}>
        {plain ? stats.key : stats.label}
      </p>
      {stats.uniqueDays === 0 ? (
        <p className="ui-hint">아직 기록이 없어요.</p>
      ) : (
        <>
          <DataCountBadge count={stats.uniqueDays} label="기록일" />
          <p className="ui-hint">
            행복 {stats.avgHappiness ?? "-"} · 에너지 {stats.avgEnergy ?? "-"}
            {stats.avgFocus != null ? ` · 집중 ${stats.avgFocus}` : ""}
          </p>
          {(stats.topTags.length > 0 || stats.topEmotions.length > 0) && (
            <p className="ui-hint">
              {stats.topEmotions[0] ? `감정 ${stats.topEmotions.slice(0, 2).join(", ")}` : ""}
              {stats.topEmotions[0] && stats.topTags[0] ? " · " : ""}
              {stats.topTags[0] ? `태그 ${stats.topTags.slice(0, 2).join(", ")}` : ""}
            </p>
          )}
          {stats.insufficient && (
            <p className="ui-hint">데이터가 적어 참고용으로만 보세요.</p>
          )}
        </>
      )}
    </div>
  );
}

export default function PatternOverviewSection({ entries, sajuProfile: sajuProp }: Props) {
  const [summary, setSummary] = useState<PatternSummaryResult | null>(null);
  const [tab, setTab] = useState<PatternExtraTab>("overview");
  const [sajuProfile, setSajuProfile] = useState<SajuProfile | null>(sajuProp ?? null);
  const mode: UserExperienceMode =
    loadExperienceModeLocal() ?? DEFAULT_EXPERIENCE_MODE;
  const plain = prefersPlainLanguage(mode);

  useEffect(() => {
    if (sajuProp !== undefined) {
      setSajuProfile(sajuProp);
      return;
    }
    void loadPrimarySajuProfile().then(setSajuProfile);
  }, [sajuProp]);

  useEffect(() => {
    void getPatternInsightService()
      .createPatternSummary({
        entries,
        sajuProfile: sajuProfile ?? null,
        mode,
      })
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [entries, sajuProfile, mode]);

  const stemStats = useMemo(() => aggregateByStem(entries), [entries]);
  const branchStats = useMemo(() => aggregateByBranch(entries), [entries]);
  const tenGodStats = useMemo(
    () => aggregateByTenGod(entries, sajuProfile),
    [entries, sajuProfile]
  );

  if (!summary) {
    return (
      <p className="ui-hint" aria-live="polite">
        패턴 요약 불러오는 중…
      </p>
    );
  }

  if (summary.state === "empty") {
    return (
      <EmptyState
        title="아직 기록이 없어요"
        description="오늘의 기분부터 가볍게 남겨보세요."
        actionLabel="첫 기록 남기기"
        actionHref="/diary"
      />
    );
  }

  return (
    <section className="space-y-3" aria-label="패턴 개요">
      <h2 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
        ■ {plain ? "나의 패턴" : "패턴 · A×B"}
      </h2>
      <PersonalizationLevelCard
        level={summary.personalization}
        recordCount={summary.totalDays}
      />
      <div
        className="p-3 border-2 grid grid-cols-2 gap-2 text-xs font-bold"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
      >
        <p>총 기록 {summary.totalDays}일</p>
        <p>이번 달 {summary.monthDays}일</p>
        <p>
          평균 행복도{" "}
          {summary.avgHappiness != null ? summary.avgHappiness.toFixed(1) : "-"}
        </p>
        <p>
          평균 에너지{" "}
          {summary.avgEnergy != null ? summary.avgEnergy.toFixed(1) : "-"}
        </p>
        <p>자주 나온 감정 {summary.topEmotion ?? "-"}</p>
        <p>자주 나온 영역 {summary.topArea ?? "-"}</p>
      </div>
      <p className="ui-hint">{summary.summary}</p>

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["overview", "개요"],
            ["stems", plain ? "흐름(천간)" : "천간"],
            ["branches", plain ? "리듬(지지)" : "지지"],
            ["tengods", plain ? "역할(십신)" : "십신"],
            ["conditions", "행복 조건"],
            ["actions", "효과 행동"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="px-2 py-1 text-[11px] font-bold border"
            style={{
              borderColor: tab === id ? "var(--px-accent)" : "var(--px-border)",
              color: tab === id ? "var(--px-accent)" : "var(--px-text2)",
            }}
            aria-pressed={tab === id}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <p className="ui-hint">
          아래 탭에서 천간·지지·십신별 내 반응을 볼 수 있어요. 기존 간지별 행복도는 이
          페이지 하단에 그대로 있습니다.
        </p>
      )}

      {tab === "stems" && (
        <div className="grid grid-cols-2 gap-2">
          {stemStats.map((s) => (
            <ReactionCard key={s.key} stats={s} plain={plain} />
          ))}
        </div>
      )}

      {tab === "branches" && (
        <div className="grid grid-cols-2 gap-2">
          {branchStats.map((s) => (
            <ReactionCard key={s.key} stats={s} plain={plain} />
          ))}
        </div>
      )}

      {tab === "tengods" && (
        <div className="space-y-2">
          {!sajuProfile ? (
            <EmptyState
              title="사주를 연결하면 십신별 반응을 볼 수 있어요"
              description="일간 기준으로 비슷한 역할의 날을 묶어 보여드려요."
              actionLabel="사주 연결하기"
              actionHref="/saju"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {tenGodStats.map((s) => (
                <ReactionCard key={s.key} stats={s} plain={plain} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "conditions" && (
        <div className="space-y-2">
          {MOCK_HAPPINESS_CONDITIONS.map((c) => (
            <div
              key={c.id}
              className="p-3 border-2 space-y-1"
              style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
            >
              <p className="text-sm font-bold">{c.title}</p>
              <p className="ui-hint">
                상태: {c.status} · 근거 {c.evidenceCount}회 · {c.tags.join(", ")}
              </p>
            </div>
          ))}
          <p className="ui-hint">목업 조건입니다. 나중에 기록 기반으로 제안됩니다.</p>
        </div>
      )}

      {tab === "actions" && (
        <div className="space-y-2">
          {MOCK_EFFECTIVE_ACTIONS.map((a) => (
            <div
              key={a.id}
              className="p-3 border-2 space-y-1"
              style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
            >
              <p className="text-sm font-bold">{a.title}</p>
              <p className="ui-hint">
                실행 {a.executed}회 · 도움 됨 {a.helped}회
              </p>
            </div>
          ))}
          <Link href="/" className="ui-hint underline">
            예보에서 행동을 실행·피드백하면 여기에 쌓여요 →
          </Link>
        </div>
      )}
    </section>
  );
}

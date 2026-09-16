"use client";

/**
 * 홈 — 운세 맞춤도
 *
 * 기존 "맞춤 레벨(XP)" 자리를 대신한다.
 * 그 자리는 "레벨이 높아질수록 운세가 더 정확해져요"라고 약속하면서
 * 근거로 XP를 보여주고 있었다. XP는 그 약속을 뒷받침하지 못한다.
 * 여기 들어가는 네 축은 실제로 운세 개인화에 쓰이는 재료다.
 */
import Link from "next/link";
import WaveText from "@/components/motion/WaveText";
import { completionHeadline } from "@/lib/hypothesis/completion";
import type { HomeCompletion } from "@/lib/hypothesis/homeCompletion";

type Props = {
  data: HomeCompletion;
  /** 가설 카드 덱 열기 */
  onOpenCards: () => void;
};

export default function FortuneFitBlock({ data, onOpenCards }: Props) {
  const { completion, cards, waitingCount } = data;
  const settled = cards.length - waitingCount;

  return (
    <section className="home-section home-section--level">
      <div className="home-section__label">
        <WaveText className="home-section__title">운세 맞춤도</WaveText>
        <Link
          href="/stats"
          className="text-xs font-bold underline shrink-0"
          style={{ color: "#60a5fa" }}
        >
          기록 · 추이 보기
        </Link>
      </div>

      <button
        type="button"
        className="home-section__body w-full text-left p-3 space-y-2"
        aria-label={`운세 맞춤도 ${completion.percent} 퍼센트, 나에게 오는 날들 보기`}
        onClick={onOpenCards}
      >
        <div className="flex items-baseline justify-between gap-2">
          <p
            className="text-sm font-bold leading-snug"
            style={{ color: "var(--px-text)" }}
          >
            {completionHeadline(completion.percent)}
          </p>
          <span
            className="text-lg font-black tabular-nums shrink-0"
            style={{ color: "var(--px-accent)" }}
          >
            {completion.percent}%
          </span>
        </div>

        {/* 진행 막대 */}
        <div
          className="h-3 overflow-hidden"
          style={{
            border: "2px solid var(--px-border)",
            background: "var(--px-bg3)",
          }}
        >
          <div
            className="h-full"
            style={{
              width: `${completion.percent}%`,
              background: "var(--px-accent)",
            }}
          />
        </div>

        {/* 네 축 — 무엇이 이 숫자를 만들었는지 */}
        <div className="grid grid-cols-4 gap-1">
          {completion.axes.map((axis) => (
            <div key={axis.key} className="min-w-0">
              <p className="ui-hint truncate">{axis.label}</p>
              <p
                className="text-xs font-bold tabular-nums truncate"
                style={{ color: "var(--px-text2)" }}
              >
                {axis.detail}
              </p>
            </div>
          ))}
        </div>

        <p className="ui-hint">{completion.nextStep}</p>

        <p
          className="text-xs font-bold pt-1"
          style={{ color: "var(--px-accent)" }}
        >
          {waitingCount > 0
            ? `${waitingCount}가지 날이 확인을 기다리는 중 →`
            : settled > 0
              ? `나에게 오는 날들 · ${settled}가지 확인됨 →`
              : "나에게 오는 날들 보기 →"}
        </p>
      </button>
    </section>
  );
}

"use client";

/**
 * 깔끔한 홈 — 지금 할 일 하나만 크게.
 *
 * 기존 홈은 덩어리가 아홉 개였는데 하는 말은 셋뿐이었다.
 * "기록해라"가 네 번, "오늘은 이런 날"이 세 번, "진행 상태"가 세 번.
 * 중복이 번잡함의 정체였다.
 *
 * 여기서는 세 층만 둔다.
 *   1층 인사 — 오늘이 어떤 날인지 (숫자 0개)
 *   2층 할 일 — 지금 할 것 하나 (버튼 1개)
 *   3층 진행 — 맞춤도 한 줄 (숫자 1개)
 *
 * 나머지는 지우지 않고 접거나 다른 탭으로 옮긴다.
 * 시간 판정이 사용자 상황과 어긋날 수 있으므로 반대쪽으로 가는 문을 항상 열어 둔다.
 *
 * 기록을 마친 뒤(done)에는 **내일**을 보여준다.
 * 계획서는 여기에 "맞춤도 51% → 53%"와 "패턴이 방금 확인됐습니다"를 쓰자고 했는데,
 * 둘 다 **이전 상태를 저장해야** 쓸 수 있는 말이다. 이 앱은 아무것도 저장하지 않고
 * 매번 계산하는 쪽을 택했으므로 그 원칙을 깨게 된다.
 * 상승분은 저장 직후 화면(FortuneFitGain)이 이미 맡고 있으니, 홈은 **내일**을 맡는다.
 * 저장 없이 계산되고, 다음에 앱을 열 이유가 되고, `/forecast` 를 진짜로 대신한다.
 */
import Link from "next/link";
import type { HomeCompletion } from "@/lib/hypothesis/homeCompletion";
import {
  greeting,
  phaseHint,
  resolveHomePhase,
  type HomePhase,
} from "@/lib/hypothesis/homePhase";
import TodayGanjiLine from "./TodayGanjiLine";
import PetalLayer from "./PetalLayer";

type Props = {
  /** 0~23 — 테스트·촬영에서 시간을 고정할 수 있게 받는다 */
  hour: number;
  hasTodayEntry: boolean;
  fortuneFit: HomeCompletion | null;
  ganjiKo: string;
  stemHanja?: string;
  branchHanja?: string;
  tenGods?: string[];
  /** 오늘 기록 화면으로 */
  writeHref: string;
  /** 운세를 펼친다 */
  onOpenFortune: () => void;
  /** 나에게 오는 날들을 연다 */
  onOpenCards: () => void;
  /** 운세가 지금 펼쳐져 있는가 */
  fortuneOpen: boolean;
};

export default function CalmHome({
  hour,
  hasTodayEntry,
  fortuneFit,
  ganjiKo,
  stemHanja,
  branchHanja,
  tenGods,
  writeHref,
  onOpenFortune,
  onOpenCards,
  fortuneOpen,
}: Props) {
  const phase: HomePhase = resolveHomePhase({ hour, hasTodayEntry });
  const hint = phaseHint(phase);
  const percent = fortuneFit?.completion.percent ?? 0;
  const todayLine = fortuneFit?.todayLine ?? null;
  const dayTitle = fortuneFit?.todayPatterns[0]?.dayTitle ?? null;
  const tomorrow = fortuneFit?.tomorrow ?? null;
  /**
   * 확인된 패턴이 없을 때만 쓴다.
   * 기록으로 확인된 말이 있으면 그게 먼저다 — 이 앱은 이론보다 기록을 앞세운다.
   */
  const yongsinToday =
    !todayLine && fortuneFit?.todayYongsin?.isYongsinDay
      ? fortuneFit.todayYongsin
      : null;

  return (
    // 꽃잎은 글 뒤로 깐다 — isolate 로 겹침 순서를 이 안에 가둔다
    <div className="relative isolate">
      <PetalLayer variant="ambient" />
      <section className="relative z-[1] space-y-5 py-2">
        {/* 오늘 간지 — 한 줄로 접어 둔다 */}
        <TodayGanjiLine
          ganjiKo={ganjiKo}
          stemHanja={stemHanja}
          branchHanja={branchHanja}
          tenGods={tenGods}
        />

        {/* 1층 — 인사 */}
        <div className="space-y-2 px-1">
          <p className="ui-hint">{greeting(hour, hasTodayEntry)}</p>

          {phase === "day" && todayLine ? (
            <>
              <h2
                className="text-2xl font-black leading-snug"
                style={{ color: "var(--px-accent)" }}
              >
                {todayLine}
              </h2>
              {dayTitle && <p className="ui-hint">{dayTitle}</p>}
            </>
          ) : phase === "day" && yongsinToday?.headline ? (
            <>
              <h2
                className="text-2xl font-black leading-snug whitespace-pre-line"
                style={{ color: "var(--px-accent)" }}
              >
                {yongsinToday.headline}
              </h2>
              <p className="ui-hint">{yongsinToday.subline}</p>
            </>
          ) : phase === "day" ? (
            <h2
              className="text-2xl font-black leading-snug"
              style={{ color: "var(--px-text)" }}
            >
              오늘의 결을
              <br />
              읽어 드릴게요
            </h2>
          ) : phase === "night" ? (
            <h2
              className="text-2xl font-black leading-snug"
              style={{ color: "var(--px-text)" }}
            >
              오늘 하루,
              <br />
              어땠어요?
            </h2>
          ) : tomorrow?.line ? (
            <>
              <h2
                className="text-2xl font-black leading-snug"
                style={{ color: "var(--px-accent)" }}
              >
                내일은
                <br />
                {tomorrow.line}
              </h2>
              <p className="ui-hint">
                {tomorrow.ganjiKo ? `${tomorrow.ganjiKo}일 · ` : ""}
                {tomorrow.dayTitle}
              </p>
            </>
          ) : (
            <>
              <h2
                className="text-2xl font-black leading-snug"
                style={{ color: "var(--px-accent)" }}
              >
                오늘도 한 줄
                <br />
                남기셨어요
              </h2>
              {/* 아직 확인된 날이 없어 내일을 말할 수 없다 — 대신 왜 없는지 말한다 */}
              <p className="ui-hint">
                {tomorrow?.ganjiKo
                  ? `내일은 ${tomorrow.ganjiKo}일이에요. `
                  : ""}
                며칠 더 쌓이면 내일이 어떤 날인지 알려드릴게요.
              </p>
            </>
          )}

          {phase === "night" && (
            <p className="ui-guide">
              30초면 됩니다. 내일 운세가 오늘보다 정확해져요.
            </p>
          )}
        </div>

        {/* 2층 — 지금 할 일 하나 */}
        <div className="space-y-2">
          {phase === "day" ? (
            <button
              type="button"
              className="ui-primary-btn block w-full py-4 text-center text-[1.05rem] font-black"
              onClick={onOpenFortune}
            >
              {fortuneOpen ? "오늘의 운세 접기" : "오늘의 운세 열기"}
            </button>
          ) : (
            <Link
              href={writeHref}
              className="ui-primary-btn block w-full py-4 text-center text-[1.05rem] font-black"
            >
              {hasTodayEntry ? "오늘 기록 고치기" : "오늘 기록하기"}
            </Link>
          )}

          {/* 시간 판정이 틀렸을 때 빠져나갈 문 */}
          <div className="flex items-center justify-between gap-2 px-1">
            {hint.text ? (
              <span className="ui-hint">{hint.text}</span>
            ) : (
              <span className="ui-hint">아직 오늘 기록 전이에요</span>
            )}
            {phase === "day" ? (
              <Link href={writeHref} className="ui-hint underline shrink-0">
                {hint.toggleLabel}
              </Link>
            ) : (
              <button
                type="button"
                className="ui-hint underline shrink-0"
                onClick={onOpenFortune}
              >
                {hint.toggleLabel}
              </button>
            )}
          </div>
        </div>

        {/* 3층 — 진행 한 줄 */}
        {fortuneFit && (
          <button
            type="button"
            onClick={onOpenCards}
            className="w-full text-left space-y-1.5 pt-1"
            aria-label={`운세 맞춤도 ${percent} 퍼센트, 나에게 오는 날들 보기`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="ui-hint">운세 맞춤도</span>
              <span
                className="text-sm font-black tabular-nums"
                style={{ color: "var(--px-accent)" }}
              >
                {percent}%
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden"
              style={{ background: "var(--px-bg3)" }}
            >
              <div
                className="h-full"
                style={{ width: `${percent}%`, background: "var(--px-accent)" }}
              />
            </div>
            <p className="ui-hint">
              {fortuneFit.waitingCount > 0
                ? `${fortuneFit.waitingCount}가지 날이 확인을 기다리는 중 →`
                : "나에게 오는 날들 보기 →"}
            </p>
          </button>
        )}
      </section>
    </div>
  );
}

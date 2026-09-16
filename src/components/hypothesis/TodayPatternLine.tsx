"use client";

/**
 * 홈 — 운세 바로 위에 뜨는 한 줄.
 *
 * "오늘의 운세가 내 기록으로 정확해진다"를 **사용자가 처음으로 눈으로 보는 자리**다.
 * 지금까지는 카드를 다 뒤집어도 아무 데도 안 쓰였고, 그래서 그 약속이
 * 말로만 있었다. 이 한 줄이 그걸 매일 증명한다.
 *
 * 확인된 날이 오늘 하나도 없으면 아무것도 그리지 않는다.
 */
import type { TodayPattern } from "@/lib/hypothesis/todayPattern";

type Props = {
  line: string | null;
  patterns: TodayPattern[];
  /** 근거를 보려면 나에게 오는 날들을 연다 */
  onOpenCards: () => void;
};

export default function TodayPatternLine({ line, patterns, onOpenCards }: Props) {
  if (!line || patterns.length === 0) return null;

  const shown = patterns.slice(0, 2);
  const hasException = shown.some((p) => p.isException);

  return (
    <button
      type="button"
      onClick={onOpenCards}
      className="w-full text-left p-3 space-y-1"
      style={{
        background: "var(--px-bg3)",
        border: "2px solid var(--px-accent)",
        boxShadow: "var(--sh-3)",
      }}
      aria-label={`오늘의 내 패턴: ${line}. 근거 보기`}
    >
      <p className="ui-hint">내 기록으로 본 오늘</p>

      <p
        className="text-base font-black leading-snug"
        style={{ color: "var(--px-accent)" }}
      >
        {line}
      </p>

      {/* 근거 일수는 여기 쓰지 않는다 — 눌러서 들어간 카드에 이미 있다.
          첫 화면에 숫자가 늘수록 감성은 줄어든다. */}
      <p className="ui-hint">
        {shown.map((p) => p.dayTitle).join(" · ")}
        {hasException && (
          <span style={{ color: "#60a5fa" }}> · 사주 예상과 반대</span>
        )}
      </p>
    </button>
  );
}

"use client";

type Props = {
  onStart: () => void;
};

export default function DiaryValueIntro({ onStart }: Props) {
  return (
    <div className="space-y-6 py-8 px-2 text-center">
      <div className="space-y-3">
        <h1 className="ui-page-title text-lg">■ 일진 기록</h1>
        <p className="ui-guide leading-relaxed max-w-xs mx-auto">
          <strong style={{ color: "var(--px-accent)" }}>이 간지 날의 기분</strong>을 모아 두면,
          나중에 통계로 패턴을 볼 수 있어요.
        </p>
        <p className="ui-hint">행복도와 기분만 남겨도 됩니다. 일기는 선택이에요.</p>
      </div>
      <button type="button" onClick={onStart} className="ui-primary-btn px-8 py-3 text-sm">
        시작하기
      </button>
    </div>
  );
}

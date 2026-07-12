"use client";

type Props = {
  onStart: () => void;
};

export default function DiaryValueIntro({ onStart }: Props) {
  return (
    <div className="space-y-6 py-8 px-2 text-center">
      <div className="space-y-3">
        <h1 className="ui-page-title text-lg">■ 만세력 일기</h1>
        <p className="ui-guide leading-relaxed max-w-xs mx-auto">
          매일 30초만 기록하면,{" "}
          <strong style={{ color: "var(--px-accent)" }}>이 간지 날에 내 기분이 어땠는지</strong>{" "}
          나중에 통계로 볼 수 있어요.
        </p>
        <p className="ui-hint">
          사주를 몰라도 괜찮아요. 오늘의 년·월·일 기운부터 시작해요.
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="ui-primary-btn px-8 py-3 text-sm"
      >
        시작하기
      </button>
    </div>
  );
}

"use client";

export type FortuneTab = "year" | "month" | "day";
export type DaySubTab = "ganji" | "stem" | "branch";

const FORTUNE_TABS: { id: FortuneTab; label: string }[] = [
  { id: "year", label: "년" },
  { id: "month", label: "월" },
  { id: "day", label: "일" },
];

const DAY_SUB_TABS: { id: DaySubTab; label: string }[] = [
  { id: "ganji", label: "간지" },
  { id: "stem", label: "천간" },
  { id: "branch", label: "지지" },
];

const GUIDE_TEXT: Record<FortuneTab, string> = {
  year: "올해·작년 같은 년의 기운 아래 기록한 날들의 평균 기분이에요.",
  month: "그 달의 월의 기운 아래 기록한 날들의 평균 기분이에요.",
  day: "60일 주기로 돌아오는 그날의 간지와 내 기분을 비교해요.",
};

const DAY_SUB_GUIDE: Record<DaySubTab, string> = {
  ganji: "천간+지지 합친 간지(예: 임오일)별 평균 기분이에요.",
  stem: "간지의 하늘 글자(천간)만 모아 본 패턴이에요.",
  branch: "간지의 땅 글자(지지)만 모아 본 패턴이에요.",
};

type Props = {
  fortuneTab: FortuneTab;
  daySubTab: DaySubTab;
  onFortuneChange: (tab: FortuneTab) => void;
  onDaySubChange: (tab: DaySubTab) => void;
};

export default function StatsFortuneTabs({
  fortuneTab,
  daySubTab,
  onFortuneChange,
  onDaySubChange,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {FORTUNE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onFortuneChange(tab.id)}
            className={`flex-1 py-2 text-sm font-black border-2 ${fortuneTab === tab.id ? "ui-mode-btn-selected" : "ui-mode-btn"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {fortuneTab === "day" && (
        <div className="flex gap-1">
          {DAY_SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onDaySubChange(tab.id)}
              className={`flex-1 py-1.5 text-xs font-bold border ${daySubTab === tab.id ? "" : ""}`}
              style={{
                borderColor: daySubTab === tab.id ? "var(--px-accent)" : "var(--px-border)",
                background: daySubTab === tab.id ? "var(--px-bg3)" : "var(--px-bg2)",
                color: daySubTab === tab.id ? "var(--px-accent)" : "var(--px-text2)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <p className="ui-guide px-0.5">
        {fortuneTab === "day" ? DAY_SUB_GUIDE[daySubTab] : GUIDE_TEXT[fortuneTab]}
      </p>
    </div>
  );
}
